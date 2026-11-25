import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
export const dataDir = path.resolve(process.env.DATA_DIR || './data');
for (const d of ['', 'auth','media','thumbnails','downloads','temp']) fs.mkdirSync(path.join(dataDir,d), {recursive:true,mode:0o700});
process.env.DATABASE_URL = `file:${path.join(dataDir,'statusvault.db')}`;
export const adminUser = process.env.ADMIN_USERNAME || '';
export const adminPassword = process.env.ADMIN_PASSWORD || '';
export const secret = process.env.SESSION_SECRET || '';
if (!adminUser || adminPassword.length < 12 || secret.length < 32) throw new Error('Set ADMIN_USERNAME, ADMIN_PASSWORD (minimum 12 characters) and SESSION_SECRET (minimum 32 characters).');
export const port = Number(process.env.PORT || 3000);
export const allowedOrigins = (process.env.PUBLIC_ORIGIN || '').split(',').map(x=>x.trim()).filter(Boolean);
export const safePath = (folder:string, name:string) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === '.' || name === '..') throw new Error('Invalid file name');
  return path.join(dataDir,folder,name);
};
