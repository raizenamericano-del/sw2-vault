import crypto from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import {adminUser,adminPassword,secret,allowedOrigins} from './config';
const key = crypto.createHash('sha256').update(secret).update('\0').update(adminUser).update('\0').update(adminPassword).digest();
const sign = (payload:string)=>crypto.createHmac('sha256',key).update(payload).digest('base64url');
export function same(a:string,b:string) {const x=crypto.createHash('sha256').update(a).digest(),y=crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x,y)}
export function validCredentials(u:string,p:string){ return same(u,adminUser) && same(p,adminPassword) }
export function createToken(){const p=Buffer.from(JSON.stringify({exp:Date.now()+12*60*60*1000, nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');return `${p}.${sign(p)}`}
export function validToken(token?:string){try{if(!token)return false;const [p,s,...rest]=token.split('.');if(!p||!s||rest.length||!same(sign(p),s)) return false;return JSON.parse(Buffer.from(p,'base64url').toString()).exp>Date.now()}catch{return false}}
export function requireAuth(req:Request,res:Response,next:NextFunction){if(!validToken(req.cookies?.sv_session))return res.status(401).json({error:'Silakan masuk terlebih dahulu.'});next()}
export function checkOrigin(req:Request,res:Response,next:NextFunction){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origin=req.get('origin');
 if (!origin) return res.status(403).json({error:'Origin diperlukan.'});
 const expected = `${req.protocol}://${req.get('host')}`;
 if (origin!==expected && !allowedOrigins.includes(origin)) return res.status(403).json({error:'Origin tidak diizinkan.'});
 next();
}
