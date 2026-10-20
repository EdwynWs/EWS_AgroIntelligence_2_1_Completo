import {one,insert,update} from '../../packages/database/db.ts';
import type {Database,Row} from '../../packages/database/db.ts';
import {uid,entitlement,audit} from '../api/src/domain.ts';
import {localClock} from '../api/src/automation-core.ts';
export async function preventiveTick(db:Database,at=new Date()){
 let generated=0;
 const plans=await db.query('SELECT p.*,t.timezone FROM maintenance_plans p JOIN tenants t ON t.id=p.tenant_id');
 for(const plan of plans){const created=await db.transaction(async tx=>{
  try{const ent=await entitlement(tx,plan.tenant_id);if(!ent.modules.includes('predict'))return;}catch(e:any){if(e.status===403)return;throw e;}
  const p=await one(tx,'SELECT * FROM maintenance_plans WHERE id=?',[plan.id]);if(!p)return;const day=localClock(plan.timezone,at).day;
  let label='',change:Row={};
  if(p.basis==='calendar'){
   if(!p.next_on||!p.every_days||p.next_on>day)return;
   label=p.next_on;const elapsed=Math.floor((Date.parse(day)-Date.parse(p.next_on))/86400000);
   change.next_on=new Date(Date.parse(p.next_on+'T12:00:00Z')+(Math.floor(elapsed/p.every_days)+1)*p.every_days*86400000).toISOString().slice(0,10);
  }else{
   const samples=await tx.query("SELECT t.stale_seconds,l.value,l.observed_at,l.quality FROM tags t JOIN tag_latest l ON l.tag_id=t.id WHERE t.tenant_id=? AND t.equipment_id=? AND t.kind=?",[p.tenant_id,p.equipment_id,p.basis]);
   // Ambiguous counters must be configured, never selected arbitrarily.
   if(samples.length!==1)return;const s=samples[0];
   if(s.quality!=='GOOD'||at.getTime()-Date.parse(s.observed_at)>s.stale_seconds*1000||Date.parse(s.observed_at)>at.getTime()+60000)return;
   const threshold=Number(p.basis==='cycles'?p.next_cycles:p.next_hours),interval=Number(p.basis==='cycles'?p.every_cycles:p.every_hours);
   if(!interval||s.value<threshold)return;
   label=threshold+' '+(p.basis==='cycles'?'ciclos':'h');change[p.basis==='cycles'?'next_cycles':'next_hours']=(Math.floor(Number(s.value)/interval)+1)*interval;
  }
  const id=uid();await insert(tx,'work_orders',{id,tenant_id:p.tenant_id,equipment_id:p.equipment_id,title:p.name+' · referência '+label,assignee:'',priority:'normal',status:'open',due_on:day,checklist:p.checklist,report:'Gerada por regra preventiva verificável. Não é previsão de falha.',parts_cents:0,labor_cents:0,duration_minutes:0,completed_at:null,created_at:at.toISOString()});
  await update(tx,'maintenance_plans',change,'id=?',[p.id]);await audit(tx,null,p.tenant_id,'preventive_order','work_orders',id,{plan_id:p.id,basis:p.basis,reference:label});return true;
 });if(created)generated++;}
 return {generated};
}
