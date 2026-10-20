import {fastifyTransport} from './fastify-transport.ts';
import { createServer } from 'node:http';
import { connect } from '../../../packages/database/db.ts';
import { migrate } from '../../../packages/database/migrate.ts';
import { createApp } from './app.ts';
const prod=process.env.NODE_ENV==='production';
if(prod&&(!process.env.APP_ORIGIN?.startsWith('https://')||process.env.DB_DRIVER!=='postgres'||!/^[a-fA-F0-9]{64}$/.test(process.env.MFA_ENCRYPTION_KEY||'')))throw new Error('Produção exige APP_ORIGIN HTTPS, PostgreSQL e MFA_ENCRYPTION_KEY.');
const db=await connect();if(!prod)await migrate(db);
const app=createApp(db);const port=Number(process.env.PORT||4000),host=process.env.HOST||'127.0.0.1';
let close:()=>Promise<any>;
let fastifyFactory:any;
try{const moduleName='fastify';fastifyFactory=(await import(moduleName)).default;}catch{if(prod)throw new Error('Instale Fastify com pnpm install.');}
if(fastifyFactory){
 const server=await fastifyTransport(db,true);
 await server.listen({port,host});close=()=>server.close();
}else{
 console.warn('Desenvolvimento: transporte HTTP nativo. Produção requer Fastify.');
 const server=createServer(async(req,res)=>{try{const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>2200000){res.writeHead(413);res.end();return;}chunks.push(chunk);}let body;try{const raw=Buffer.concat(chunks).toString();body=raw?JSON.parse(raw):undefined;}catch{res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'JSON inválido.'}));return;}const result=await app.dispatch({method:req.method||'GET',url:req.url||'/',headers:req.headers as any,body,ip:req.socket.remoteAddress});res.writeHead(result.status,result.headers);res.end(typeof result.body==='string'||Buffer.isBuffer(result.body)?result.body:JSON.stringify(result.body));}catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(port,host,resolve));close=()=>new Promise<void>(resolve=>server.close(()=>resolve()));
}
console.log(`API EWS pronta em http://${host}:${port}`);
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await close();await db.close();process.exit(0);});
