import makeWASocket, {useMultiFileAuthState, DisconnectReason, downloadMediaMessage, Browsers, type WASocket, type WAMessage} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileTypeFromBuffer} from 'file-type';
import sharp from 'sharp';
import {db} from './db';
import {dataDir,safePath} from './config';
const logger = pino({level:'silent'});
const limit=100*1024*1024;
export class WhatsAppService {
 private inFlight = new Set<string>(); private sock?: WASocket; private generation=0; private timer?:NodeJS.Timeout; private pairing=false; private busy=false;
 public state='disconnected'; public error:string|null=null; private emit:()=>void;
 constructor(emit:()=>void){this.emit=emit}
 private async setState(s:string,phone?:string){this.state=s; await db.whatsAppSession.upsert({where:{id:'primary'},create:{id:'primary',connectionStatus:s,phoneNumber:phone,lastConnectedAt:s==='connected'?new Date():undefined},update:{connectionStatus:s,...(phone?{phoneNumber:phone}:{}),...(s==='connected'?{lastConnectedAt:new Date()}:{})}});this.emit()}
 async restore(){if(fs.existsSync(path.join(dataDir,'auth','creds.json'))){const {state}=await useMultiFileAuthState(path.join(dataDir,'auth'));if(state.creds.registered) await this.connect(); else await this.setState('disconnected')}else await this.setState('disconnected')}
 async connect(phone?:string):Promise<string|undefined>{
  if(this.busy || this.state==='connected' || this.state==='connecting' || this.state==='reconnecting') throw new Error('Koneksi sedang aktif atau dalam proses.');
  if(!phone && !fs.existsSync(path.join(dataDir,'auth','creds.json'))) throw new Error('Belum ada sesi tersimpan. Generate pairing code terlebih dahulu.');
  this.busy=true; this.error=null; const gen=++this.generation; clearTimeout(this.timer); await this.setState('connecting',phone);
  try {
   const {state,saveCreds}=await useMultiFileAuthState(path.join(dataDir,'auth'));
   if(!phone && !state.creds.registered) throw new Error('Sesi belum terdaftar. Generate pairing code terlebih dahulu.');
   if(phone && state.creds.registered) throw new Error('Sesi sudah ada. Hapus sesi terlebih dahulu untuk memasangkan nomor lain.');
   const sock=makeWASocket({auth:state,logger,browser:Browsers.ubuntu('Chrome'),printQRInTerminal:false, syncFullHistory:false, markOnlineOnConnect:false}); this.sock=sock;
   sock.ev.on('creds.update',()=>{saveCreds().catch(()=>{this.error='Gagal menyimpan kredensial';this.emit()})});
   sock.ev.on('messages.upsert',({messages})=>{for(const m of messages) void this.ingest(m,sock)});
   sock.ev.on('connection.update',({connection,lastDisconnect})=>{if(gen!==this.generation)return;
    if(connection==='open'){this.pairing=false;this.error=null;void this.setState('connected',sock.user?.id?.split(':')[0]?.split('@')[0]);}
    if(connection==='close') {const code=(lastDisconnect?.error as {output?:{statusCode?:number}})?.output?.statusCode; this.sock=undefined;
     if(code===DisconnectReason.loggedOut){this.error='Sesi keluar dari WhatsApp. Hapus sesi lalu pasangkan kembali.';void this.setState('disconnected');}
     else if(this.pairing && !state.creds.registered){this.error='Koneksi pairing terputus. Coba lagi.';this.pairing=false;void this.setState('error');}
     else {void this.setState('reconnecting');this.timer=setTimeout(()=>{if(gen!==this.generation)return;this.state='disconnected';void this.connect().catch(()=>{this.error='Gagal menyambung kembali.';void this.setState('error')})},3000)}
    }
   });
   if(phone && !state.creds.registered){this.pairing=true;
    const code=await new Promise<string>((resolve,reject)=>{const timeout=setTimeout(()=>{sock.ev.off('connection.update',listener);reject(new Error('Waktu tunggu pairing habis. Coba lagi.'))},45000);
     const listener=(u:{qr?:string;connection?:string})=>{if(u.qr){clearTimeout(timeout);sock.ev.off('connection.update',listener);sock.requestPairingCode(phone).then(resolve,reject)}else if(u.connection==='close'){clearTimeout(timeout);sock.ev.off('connection.update',listener);reject(new Error('Koneksi WhatsApp terputus saat pairing.'))}};
     sock.ev.on('connection.update',listener);
    }); return code;
   }
  } catch(e){if(gen===this.generation){this.generation++;this.sock?.end(undefined);this.sock=undefined;this.pairing=false;this.error=e instanceof Error?e.message:'Gagal memulai koneksi';await this.setState('error')} throw e} finally {this.busy=false}
 }
 async disconnect(remove=false){++this.generation;clearTimeout(this.timer);this.pairing=false;const sock=this.sock;this.sock=undefined; if(sock){if(remove){try{await sock.logout()}catch{sock.end(undefined)}}else sock.end(undefined)} if(remove){await fsp.rm(path.join(dataDir,'auth'),{recursive:true,force:true});await fsp.mkdir(path.join(dataDir,'auth'),{recursive:true,mode:0o700})}this.error=null;await this.setState('disconnected');if(remove) await db.whatsAppSession.update({where:{id:'primary'},data:{phoneNumber:null}});this.emit()}
 async shutdown(){++this.generation;clearTimeout(this.timer);this.sock?.end(undefined)}
 private async ingest(m:WAMessage,sock:WASocket){
  if(m.key.remoteJid!=='status@broadcast'||!m.key.id||!m.message)return;
  const image=m.message.imageMessage; const video=m.message.videoMessage;const content=image||video;if(!content)return;
  const unique=`${m.key.remoteJid}:${m.key.participant||''}:${m.key.id}`;
  if(this.inFlight.has(unique))return; this.inFlight.add(unique);
  if(await db.statusMedia.findUnique({where:{whatsappId:unique}})){this.inFlight.delete(unique);return;}
  const name=crypto.createHash('sha256').update(unique).digest('hex');const temp=safePath('temp',`${name}.part`);let mediaPath='';
  try{
   if(Number(content.fileLength||0)>limit)throw new Error('Media exceeds size limit');
   await fsp.rm(temp,{force:true});
   const stream=await downloadMediaMessage(m,'stream',{}, {logger,reuploadRequest:sock.updateMediaMessage});let size=0;
   const limiter=new Transform({transform(chunk,_enc,cb){size+=chunk.length;if(size>limit)cb(new Error('Media exceeds size limit'));else cb(null,chunk)}});
   await pipeline(stream,limiter,fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
   const fh=await fsp.open(temp,'r');const header=Buffer.alloc(4100);const {bytesRead}=await fh.read(header,0,header.length,0);await fh.close();const type=await fileTypeFromBuffer(header.subarray(0,bytesRead));const accepted=image?['image/jpeg','image/png','image/webp']:['video/mp4'];
   if(!type||!accepted.includes(type.mime)) throw new Error('Unsupported media format');
   mediaPath=`${name}.${type.ext}`; await fsp.rename(temp,safePath('media',mediaPath));let thumbnailPath:string|null=null;
   if(image){try{thumbnailPath=`${name}.webp`;await sharp(safePath('media',mediaPath)).rotate().resize(600,600,{fit:'inside',withoutEnlargement:true}).webp({quality:75}).toFile(safePath('thumbnails',thumbnailPath))}catch{thumbnailPath=null}}
   const raw=Number(m.messageTimestamp||0);const timestamp=raw>0?new Date(raw*1000):new Date();
   await db.statusMedia.create({data:{whatsappId:unique,mediaType:image?'image':'video',contactName:m.pushName || m.key.participant?.split('@')[0] || 'Kontak',caption:content.caption || null,mediaPath,thumbnailPath,mimeType:type.mime,fileSize:size,timestamp}});this.emit();
  }catch(e){await fsp.rm(temp,{force:true}).catch(()=>{});if(mediaPath)await fsp.rm(safePath('media',mediaPath),{force:true}).catch(()=>{});console.warn('Status media gagal disimpan:',e instanceof Error?e.message:'unknown')} finally {this.inFlight.delete(unique)}
 }
}
