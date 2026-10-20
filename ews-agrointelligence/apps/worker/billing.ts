import {one,insert,update} from '../../packages/database/db.ts';
import type {Database} from '../../packages/database/db.ts';
import {uid,audit} from '../api/src/domain.ts';
import {localClock} from '../api/src/automation-core.ts';
// Generates receivables only. Never contacts a provider or debits a customer.
export async function recurringBillingTick(db:Database,at=new Date()){
 const schedules=await db.query('SELECT r.*,t.timezone FROM recurring_charges r JOIN tenants t ON t.id=r.tenant_id WHERE r.active=1');
 for(const schedule of schedules)await db.transaction(async tx=>{
  const r=await one(tx,'SELECT * FROM recurring_charges WHERE id=? AND active=1',[schedule.id]);if(!r)return;
  const sub=await one(tx,'SELECT status FROM subscriptions WHERE tenant_id=?',[r.tenant_id]);if(sub?.status!=='active')return;
  const today=localClock(schedule.timezone,at).day;
  if(r.next_on>today)return;
  if(!await one(tx,'SELECT charge_id FROM recurring_charge_runs WHERE schedule_id=? AND slot=?',[r.id,r.next_on])){
   const id=uid();await insert(tx,'charges',{id,tenant_id:r.tenant_id,description:r.description,amount_cents:r.amount_cents,due_on:r.next_on,status:'pending',paid_at:null,reference:'',created_at:at.toISOString()});
   await insert(tx,'recurring_charge_runs',{schedule_id:r.id,tenant_id:r.tenant_id,slot:r.next_on,charge_id:id,created_at:at.toISOString()});
   await audit(tx,null,r.tenant_id,'recurring_charge_created','charges',id,{schedule_id:r.id,slot:r.next_on});
  }
  const next=new Date(r.next_on+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(r.due_day);
  await update(tx,'recurring_charges',{next_on:next.toISOString().slice(0,10)},'id=?',[r.id]);
 });
}
