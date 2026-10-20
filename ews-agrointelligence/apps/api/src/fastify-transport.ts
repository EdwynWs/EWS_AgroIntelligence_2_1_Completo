import type {Database} from '../../../packages/database/db.ts';
import {createApp} from './app.ts';
export async function fastifyTransport(db:Database,logger=false){
 const name='fastify';const factory=(await import(name)).default;
 const app=createApp(db),server=factory({logger:logger?{redact:['req.headers.authorization','req.headers.cookie','req.body']}:false,bodyLimit:2200000,trustProxy:process.env.TRUST_PROXY==='1'?1:false});
 server.all('/api/*',async(req:any,reply:any)=>{const result=await app.dispatch({method:req.method,url:req.url,headers:req.headers,body:req.body,ip:req.ip});for(const [k,v]of Object.entries(result.headers))reply.header(k,v);return reply.code(result.status).send(result.body);});return server;
}
