import {preventiveTick} from './preventive.ts';
import {recurringBillingTick} from './billing.ts';
import {automationTick} from './automation.ts';
import {lease} from '../api/src/automation-core.ts';
import { connect,one,update,insert } from '../../packages/database/db.ts';
import { randomUUID } from 'node:crypto';
import { ingest } from '../api/src/domain.ts';
const db=await connect();let running=true;let lastRetention=0;
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{running=false;});
async function tick(){
 const now=new Date().toISOString();
 if(process.env.ENABLE_DEMO==='true'){
 const gateways=await db.query('SELECT g.* FROM gateways g JOIN tenants t ON t.id=g.tenant_id WHERE t.demo=1 AND g.active=1');
 for(const g of gateways){const tags=await db.query('SELECT t.*,l.value FROM tags t LEFT JOIN tag_latest l ON l.tag_id=t.id WHERE t.gateway_id=?',[g.id]);const old=await one(db,'SELECT MAX(sequence) AS n FROM measurements WHERE gateway_id=?',[g.id]);let sequence=Number(old.n||0);const rows=tags.map(t=>({tag_id:t.id,sequence:++sequence,value:t.kind==='temperature'?+(27+Math.sin(Date.now()/600000)*2).toFixed(2):t.kind==='hours'?Number(t.value||0)+10/3600:Number(t.value||0),unit:t.unit,quality:'GOOD',source:'SIMULATED',observed_at:now}));if(rows.length)await db.transaction(tx=>ingest(tx,g,rows));}
 }
 await automationTick(db);
 if(process.env.SMTP_HOST){const moduleName='nodemailer';const mailer=await import(moduleName);const transport=mailer.default.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',connectionTimeout:15000,greetingTimeout:15000,socketTimeout:60000,requireTLS:process.env.SMTP_SECURE!=='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
  const mails=await db.query("SELECT * FROM outbox WHERE status='pending' AND next_attempt_at<=? AND attempts<5 ORDER BY created_at LIMIT 20",[now]);
  for(const m of mails){try{await transport.sendMail({from:process.env.SMTP_FROM,to:m.recipient,subject:m.subject,text:m.body,messageId:`<${m.id}@ews-agro.local>`});await update(db,'outbox',{status:'sent',body:'[conteúdo removido após envio]'},'id=?',[m.id]);}catch{await update(db,'outbox',{attempts:m.attempts+1,next_attempt_at:new Date(Date.now()+2**m.attempts*60000).toISOString(),status:m.attempts>=4?'failed':'pending'},'id=?',[m.id]);}}await automationTick(db,{sendMail:(message)=>transport.sendMail({from:process.env.SMTP_FROM,...message})});transport.close();
 }
 await preventiveTick(db);
 await recurringBillingTick(db);
 if(Date.now()-lastRetention>3600000){
  const cutoff=new Date(Date.now()-Number(process.env.TELEMETRY_RETENTION_DAYS||90)*86400000).toISOString();
  await db.query('DELETE FROM measurements WHERE id IN (SELECT id FROM measurements WHERE observed_at<? LIMIT 10000)',[cutoff]);
  await db.query('DELETE FROM hourly_metrics WHERE hour<?',[new Date(Date.now()-730*86400000).toISOString()]);
  await db.query('DELETE FROM sessions WHERE expires_at<?',[now]);await db.query('DELETE FROM auth_tokens WHERE expires_at<?',[now]);
  await db.query('DELETE FROM audit_logs WHERE created_at<?',[new Date(Date.now()-Number(process.env.AUDIT_RETENTION_DAYS||365)*86400000).toISOString()]);lastRetention=Date.now();
 }
}
while(running){try{await lease(db,'worker:tick',async()=>{const started=Date.now();await tick();await db.query('INSERT INTO worker_health(id,last_success_at,duration_ms) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET last_success_at=excluded.last_success_at,duration_ms=excluded.duration_ms',['primary',new Date().toISOString(),Date.now()-started]);});console.log(JSON.stringify({event:'worker_tick',at:new Date().toISOString()}));}catch(e:any){console.error(JSON.stringify({event:'worker_error',type:e.name}));}await new Promise(r=>setTimeout(r,10000));}
await db.close();
