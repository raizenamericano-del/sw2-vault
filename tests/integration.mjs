import { strict as assert } from 'node:assert';
import { PrismaClient } from '@prisma/client';
import {io} from 'socket.io-client';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
const data=process.env.DATA_DIR;if(!data)throw Error('Set DATA_DIR to a disposable test directory');
process.env.DATABASE_URL=`file:${path.resolve(data,'statusvault.db')}`;
const db=new PrismaClient();let cookie='';
async function request(url,options={}){let headers={'content-type':'application/json',origin:base,...options.headers};if(cookie)headers.cookie=cookie;return fetch(base+url,{...options,headers})}
try{
 assert.equal((await fetch(base+'/health')).status,200);
 assert.equal((await request('/api/overview')).status,401);
 assert.equal((await request('/api/login',{method:'POST',body:JSON.stringify({username:'wrong',password:'wrong'})})).status,401);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:'{}'})).status,403);
 let r=await request('/api/login',{method:'POST',body:JSON.stringify({username:'admin',password:'test-password-123456'})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/api/overview');assert.equal(r.status,200);let o=await r.json();assert.equal(o.total,0);
 const socket=io(base,{extraHeaders:{Cookie:cookie,Origin:base},transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{socket.on('connect',resolve);socket.on('connect_error',reject);setTimeout(()=>reject(Error('socket timeout')),5000)});socket.close();
 r=await request('/api/connection/pair',{method:'POST',body:JSON.stringify({phone:'not-a-number'})});assert.equal(r.status,400);
 const buffer=await sharp({create:{width:10,height:10,channels:3,background:'#abc'}}).png().toBuffer();await fs.writeFile(path.join(data,'media','test.png'),buffer);
 const item=await db.statusMedia.create({data:{whatsappId:'test-message',mediaType:'image',contactName:'Test contact',caption:'Test caption',mediaPath:'test.png',mimeType:'image/png',fileSize:buffer.length,timestamp:new Date()}});
 r=await request('/api/statuses?filter=image&q=Test');assert.equal((await r.json()).items.length,1);
 r=await request(`/api/statuses/${item.id}/saved`,{method:'PATCH',body:JSON.stringify({saved:true})});assert.equal(r.status,200);
 r=await request('/api/statuses?filter=saved');assert.equal((await r.json()).items.length,1);
 r=await request(`/api/media/${item.id}/original`);assert.equal(r.headers.get('content-type'),'image/png');assert.equal((await r.arrayBuffer()).byteLength,buffer.length);
 r=await request(`/api/download/${item.id}`,{method:'POST'});assert.equal(r.status,200);const dl=await r.json();r=await request(dl.url);assert.equal((await r.arrayBuffer()).byteLength,buffer.length);
 r=await request('/api/downloads');assert.equal((await r.json()).length,1);
 r=await request('/api/settings',{method:'PUT',body:JSON.stringify({compact:true})});assert.equal(r.status,200);r=await request('/api/settings');assert.equal((await r.json()).compact,'true');
 r=await request('/api/downloads',{method:'DELETE'});assert.equal(r.status,200);r=await request('/api/downloads');assert.equal((await r.json()).length,0);
 r=await request('/api/logout',{method:'POST'});assert.equal(r.status,200);console.log('Integration checks passed.');
}finally{await db.$disconnect()}
