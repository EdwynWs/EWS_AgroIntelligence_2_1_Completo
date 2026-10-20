import {performance} from 'node:perf_hooks';
import {cpus,totalmem,platform} from 'node:os';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {connect,one,update} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedDemo} from '../scripts/seed.ts';
import {fastifyTransport} from '../apps/api/src/fastify-transport.ts';
import {hash} from '../apps/api/src/security.ts';
process.env.ENABLE_DEMO='true';process.env.APP_ORIGIN='http://localhost:3000';
const db=await connect({driver:'sqlite',path:join(mkdtempSync(join(tmpdir(),'agro-benchmark-')),'load.sqlite')});await migrate(db);const demo=await seedDemo(db);const server=await fastifyTransport(db);const cpuStart=process.cpuUsage();
try{
 const base=await server.listen({host:'127.0.0.1',port:0});const login=await fetch(base+'/api/auth/demo',{method:'POST',headers:{origin:process.env.APP_ORIGIN}});const cookie=login.headers.get('set-cookie').split(';')[0];
 const latency=[];await fetch(base+'/api/dashboard',{headers:{cookie}});const begin=performance.now();
 for(let batch=0;batch<10;batch++)await Promise.all(Array.from({length:10},async()=>{const start=performance.now();const r=await fetch(base+'/api/dashboard',{headers:{cookie}});if(!r.ok)throw new Error('Dashboard HTTP '+r.status);await r.json();latency.push(performance.now()-start);}));latency.sort((a,b)=>a-b);
 const gateway=await one(db,'SELECT * FROM gateways WHERE tenant_id=? LIMIT 1',[demo.tenant_id]);const tag=await one(db,"SELECT * FROM tags WHERE gateway_id=? AND kind='temperature' LIMIT 1",[gateway.id]);await update(db,'gateways',{token_hash:hash('synthetic-test-token')},'id=?',[gateway.id]);let seq=Number((await one(db,'SELECT MAX(sequence) AS n FROM measurements WHERE gateway_id=?',[gateway.id])).n||0),accepted=0;const ingestStart=performance.now();
 for(let batch=0;batch<20;batch++){const readings=Array.from({length:50},()=>({tag_id:tag.id,sequence:++seq,value:25,unit:tag.unit,quality:'GOOD',source:'SIMULATED',observed_at:new Date().toISOString()}));const r=await fetch(base+'/api/ingest',{method:'POST',headers:{authorization:'Bearer synthetic-test-token','content-type':'application/json'},body:JSON.stringify({readings})});if(!r.ok)throw new Error('Ingest HTTP '+r.status);accepted+=(await r.json()).accepted;}
 const result={at:new Date().toISOString(),node:process.version,os:platform(),cpu:cpus()[0].model,logical_cpus:cpus().length,host_ram_bytes:totalmem(),database:'SQLite file + WAL; disposable local test; NOT PostgreSQL production capacity',dashboard:{requests:100,concurrency:10,p50_ms:latency[49],p95_ms:latency[94],p99_ms:latency[98],elapsed_ms:ingestStart-begin},ingestion:{batches:20,batch_size:50,accepted,elapsed_ms:performance.now()-ingestStart},process_cpu_microseconds:process.cpuUsage(cpuStart),process_memory:process.memoryUsage()};writeFileSync('docs/verification/v2.1/benchmark-http.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await server.close();await db.close();}
