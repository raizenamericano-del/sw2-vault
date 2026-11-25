import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
const root=path.resolve(process.env.DATA_DIR || (process.env.NODE_ENV==='production'?'/data':'./data'));
for(const dir of ['','auth','downloads','temp','media','thumbnails']){const target=path.join(root,dir);fs.mkdirSync(target,{recursive:true,mode:0o700});fs.chmodSync(target,0o700)}
process.env.DATA_DIR=root;process.env.DATABASE_URL=`file:${path.join(root,'statusvault.db')}`;
const migration=spawnSync(process.execPath,[path.resolve('node_modules/prisma/build/index.js'),'migrate','deploy'],{stdio:'inherit',env:process.env});
if(migration.error || migration.status!==0){console.error('Migration failed:',migration.error?.message||migration.status);process.exit(1)}
const child=spawn(process.execPath,['dist/server.js'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>process.exit(code??(signal?1:0)));
child.on('error',err=>{console.error('Server failed to start:',err.message);process.exit(1)});
