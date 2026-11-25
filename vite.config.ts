import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'client',plugins:[react()],build:{outDir:'../dist/public',emptyOutDir:true},server:{host:'0.0.0.0',allowedHosts:true,proxy:{'/api':'http://127.0.0.1:3000','/socket.io':{target:'http://127.0.0.1:3000',ws:true}}}});
