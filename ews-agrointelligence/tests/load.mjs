import {connect,one} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedDemo} from '../scripts/seed.ts';
import {createApp} from '../apps/api/src/app.ts';
import {token,hash} from '../apps/api/src/security.ts';
import {writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
process.env.ENABLE_DEMO='true';
const db=await connect({driver:'sqlite',path:':memory:'});await migrate(db);const seeded=await db.transaction(tx=>seedDemo(tx));
const secret=token();await db.query('UPDATE gateways SET token_hash=? WHERE id=?',[hash(secret),seeded.gateway_id]);
const tag=await one(db,"SELECT * FROM tags WHERE tenant_id=? AND kind='temperature' LIMIT 1",[seeded.tenant_id]);
let seq=Number((await one(db,'SELECT MAX(sequence) AS n FROM measurements WHERE gateway_id=?',[seeded.gateway_id])).n);
const app=createApp(db);const origin=process.env.APP_ORIGIN||'http://localhost:3000';
const latencies=[];let accepted=0;const started=performance.now();
for(let b=0;b<100;b++){const readings=Array.from({length:50},(_,i)=>({tag_id:tag.id,sequence:++seq,value:27+Math.sin(i),unit:tag.unit,quality:'GOOD',source:'SIMULATED',observed_at:new Date().toISOString()}));const start=performance.now();const r=await app.dispatch({method:'POST',url:'/api/ingest',ip:'load',headers:{authorization:'Bearer '+secret},body:{readings}});if(r.status!==200)throw Error(JSON.stringify(r.body));latencies.push(performance.now()-start);accepted+=r.body.accepted;}
const ingestMs=performance.now()-started;
const session=await app.dispatch({method:'POST',url:'/api/auth/demo',headers:{origin},ip:'load-login'});const cookie=session.headers['set-cookie'].split(';')[0];const queryTimes=[];
for(let n=0;n<100;n++){const start=performance.now();const r=await app.dispatch({method:'GET',url:'/api/dashboard',headers:{cookie},ip:'load-query'});if(r.status!==200)throw Error(JSON.stringify(r.body));queryTimes.push(performance.now()-start);}
const stats=a=>{a.sort((a,b)=>a-b);return {p50_ms:+a[Math.floor(a.length*.5)].toFixed(3),p95_ms:+a[Math.floor(a.length*.95)].toFixed(3),max_ms:+a[a.length-1].toFixed(3)};};
const report={timestamp:new Date().toISOString(),environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,driver:'SQLite in-memory',transport:'in-process dispatcher; no HTTP/TLS',concurrency:1},ingestion:{batches:100,points:accepted,total_ms:+ingestMs.toFixed(2),points_per_second:+(accepted/(ingestMs/1000)).toFixed(1),latency_per_50_points:stats(latencies)},dashboard:{requests:100,latency:stats(queryTimes)},peak_process_rss_mib:+(process.resourceUsage().maxRSS/1024).toFixed(2),limitation:'Synthetic local benchmark, not a PostgreSQL/Fastify/VPS capacity certification.'};
mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/load.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await db.close();
