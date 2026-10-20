import {z} from 'zod';
import {one,insert,update} from '../../../packages/database/db.ts';
import type {Database} from '../../../packages/database/db.ts';
import type {Route,Context} from './app.ts';
import {uid,now,fail,audit} from './domain.ts';
type Register=(method:string,path:string,handler:Route['handler'],pub?:boolean)=>void;
const ews=(c:Context)=>{if(c.user?.role!=='EWS')fail(403,'Área exclusiva da EWS Tech.');};
export function registerOperationsRoutes(db:Database,route:Register){
 route('GET','/api/admin/operations',async c=>{
  ews(c);const worker=await one(db,"SELECT * FROM worker_health WHERE id='primary'");
  const queues={mail:await db.query('SELECT status,COUNT(*) AS count FROM outbox GROUP BY status'),reports:await db.query('SELECT status,COUNT(*) AS count FROM report_deliveries GROUP BY status'),imports:await db.query('SELECT status,COUNT(*) AS count FROM import_runs GROUP BY status')};
  const gateways=await db.query('SELECT g.id,g.name,g.tenant_id,t.name AS tenant_name,g.active,g.last_seen,g.last_error FROM gateways g JOIN tenants t ON t.id=g.tenant_id ORDER BY g.last_seen LIMIT 500');
  return {worker:{...worker,healthy:!!worker&&Date.now()-Date.parse(worker.last_success_at)<180000},queues,gateways};
 });
 route('GET','/api/admin/recurring-charges',async c=>{ews(c);return {items:await db.query('SELECT r.*,t.name AS tenant_name FROM recurring_charges r JOIN tenants t ON t.id=r.tenant_id ORDER BY r.created_at DESC LIMIT 500'),mode:'manual-receivables',provider_configured:false};});
 const schema=z.object({tenant_id:z.string().uuid(),description:z.string().trim().min(2).max(250),amount_cents:z.number().int().positive().max(2000000000),due_day:z.number().int().min(1).max(28),next_on:z.string().date(),active:z.number().int().min(0).max(1)}).strict().refine(x=>Number(x.next_on.slice(-2))===x.due_day,'A próxima data deve corresponder ao dia do vencimento.');
 for(const method of ['POST','PUT'])route(method,method==='POST'?'/api/admin/recurring-charges':'/api/admin/recurring-charges/:id',async c=>{
  ews(c);const x=schema.parse(c.body);return db.transaction(async tx=>{
   if(!await one(tx,'SELECT id FROM tenants WHERE id=?',[x.tenant_id]))fail(404,'Empresa não encontrada.');
   if(c.params.id){const old=await one(tx,'SELECT * FROM recurring_charges WHERE id=?',[c.params.id]);if(!old)fail(404,'Recorrência não encontrada.');if(old.tenant_id!==x.tenant_id)fail(409,'Não altere a empresa de uma recorrência.');}
   const id=c.params.id||uid();
   if(x.active&&await one(tx,'SELECT id FROM recurring_charges WHERE tenant_id=? AND active=1 AND id<>?',[x.tenant_id,id]))fail(409,'Já existe uma recorrência ativa para esta empresa.');
   if(c.params.id)await update(tx,'recurring_charges',x,'id=?',[id]);else await insert(tx,'recurring_charges',{id,...x,created_at:now()});
   await audit(tx,c.user,x.tenant_id,'recurring_charge_saved','recurring_charges',id);return {id};
  });
 });
}
