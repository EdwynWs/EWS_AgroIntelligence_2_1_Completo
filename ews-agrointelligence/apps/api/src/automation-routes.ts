import {z} from 'zod';
import {one,insert,update} from '../../../packages/database/db.ts';
import type {Database,Queryable,Row} from '../../../packages/database/db.ts';
import type {Context,Route} from './app.ts';
import {uid,now,fail,entitlement,saveResource,audit} from './domain.ts';
import {resources} from '../../../packages/shared/resources.ts';
import {token,hash,encryptSecret} from './security.ts';
import {localClock,population,recordPopulation,runImport} from './automation-core.ts';
import {allowedEndpoint} from './safe-source.ts';
import {executiveReport} from './scheduled-reports.ts';

type Register=(method:string,path:string,handler:Route['handler'],pub?:boolean)=>void;
const manager=(c:Context)=>{if(!c.tenant)fail(400,'Selecione uma empresa.');if(!['EWS','OWNER','MANAGER'].includes(c.user!.role))fail(403,'Acesso restrito à gestão.');return c.tenant!;};
async function scopedBarns(db:Queryable,c:Context){
 if(!['EWS','OWNER','MANAGER','OPERATOR','TECH'].includes(c.user!.role))fail(403,'Perfil não autorizado ao modo funcionário.');
 await entitlement(db,c.tenant!);
 if(['OPERATOR','TECH'].includes(c.user!.role))return db.query('SELECT b.*,ub.preferred FROM barns b JOIN user_barns ub ON ub.barn_id=b.id AND ub.tenant_id=b.tenant_id WHERE b.tenant_id=? AND ub.user_id=? ORDER BY ub.preferred DESC,b.name',[c.tenant,c.user!.id]);
 return db.query('SELECT * FROM barns WHERE tenant_id=? ORDER BY name',[c.tenant]);
}
async function requireBarn(db:Queryable,c:Context,id:string){const barn=(await scopedBarns(db,c)).find(b=>b.id===id);if(!barn)fail(403,'Galpão não atribuído ao seu usuário.');return barn;}
export async function operationSummary(db:Queryable,tenant:string){
 const ent=await entitlement(db,tenant),today=localClock(ent.timezone).day;
 const barns=await db.query('SELECT b.id,b.name,p.id AS production_id,p.source,p.eggs FROM barns b LEFT JOIN production p ON p.barn_id=b.id AND p.tenant_id=b.tenant_id AND p.day=? WHERE b.tenant_id=? ORDER BY b.name',[today,tenant]);
 const sources=await db.query('SELECT id,name,active,last_run_at,last_status,next_run_at FROM integration_sources WHERE tenant_id=? ORDER BY name',[tenant]);
 const energy=ent.modules.includes('energy')?await one(db,'SELECT MAX(day) AS day,MAX(created_at) AS received_at FROM energy_readings WHERE tenant_id=?',[tenant]):null;
 return {today,barns:ent.modules.includes('performance')?barns:[],sources,energy};
}
export function registerAutomationRoutes(db:Database,route:Register){
 route('GET','/api/operations',async c=>{manager(c);return operationSummary(db,c.tenant!);});
 route('GET','/api/staff',async c=>{
  const barns=await scopedBarns(db,c),ent=await entitlement(db,c.tenant!),today=localClock(ent.timezone).day,ids=new Set(barns.map(b=>b.id));
  const equipment=(await db.query('SELECT id,barn_id,name FROM equipment WHERE tenant_id=? ORDER BY name',[c.tenant])).filter(e=>ids.has(e.barn_id));
  const scoped=Array.from(ids),placeholders=scoped.map(()=>'?').join(',');
  const ownHistory=['OPERATOR','TECH'].includes(c.user!.role);
  const recent=ent.modules.includes('performance')&&scoped.length?await db.query(`SELECT * FROM production WHERE tenant_id=? AND barn_id IN (${placeholders}) ${ownHistory?"AND EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_id=production.id AND a.tenant_id=production.tenant_id AND a.user_id=? AND a.action='staff_production')":''} ORDER BY day DESC,created_at DESC LIMIT 30`,[c.tenant,...scoped,...(ownHistory?[c.user!.id]:[])]):[];
  const completed=ent.modules.includes('performance')&&scoped.length?await db.query(`SELECT barn_id FROM production WHERE tenant_id=? AND day=? AND barn_id IN (${placeholders})`,[c.tenant,today,...scoped]):[];
  const tasks=ent.modules.includes('predict')?(await db.query("SELECT id,equipment_id,title,status,checklist,report,due_on,assignee,duration_minutes FROM work_orders WHERE tenant_id=? AND status<>'completed' AND (assignee=? OR assignee=?) ORDER BY due_on LIMIT 100",[c.tenant,c.user!.id,c.user!.email])).filter(o=>equipment.some(e=>e.id===o.equipment_id)):[];
  return {today,modules:ent.modules,barns:await Promise.all(barns.map(async b=>({...b,population:await population(db,c.tenant!,b.id,today),done:completed.some(p=>p.barn_id===b.id)}))),equipment,recent,tasks};
 });
 route('POST','/api/staff/preference',async c=>{const {barn_id}=z.object({barn_id:z.string().uuid()}).parse(c.body);await requireBarn(db,c,barn_id);await db.transaction(async tx=>{await update(tx,'user_barns',{preferred:0},'tenant_id=? AND user_id=?',[c.tenant,c.user!.id]);await update(tx,'user_barns',{preferred:1},'tenant_id=? AND user_id=? AND barn_id=?',[c.tenant,c.user!.id,barn_id]);});return {ok:true};});
 route('POST','/api/staff/production',async c=>{
  const x=z.object({barn_id:z.string().uuid(),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),eggs:z.number().int().min(0).max(100000000),correct:z.boolean().default(false)}).strict().parse(c.body);
  return db.transaction(async tx=>{
   await requireBarn(tx,c,x.barn_id);const ent=await entitlement(tx,c.tenant!),today=localClock(ent.timezone).day;
   if(x.day>today||(['OPERATOR','TECH'].includes(c.user!.role)&&x.day!==today))fail(403,'Seu perfil só pode registrar a data atual.');
   const p=await population(tx,c.tenant!,x.barn_id,x.day);if(!p||Date.parse(x.day)-Date.parse(p.day)>30*86400000)fail(400,'Peça ao gestor para confirmar a população de aves deste galpão (validade: 30 dias).');
   const old=await one(tx,'SELECT * FROM production WHERE tenant_id=? AND barn_id=? AND day=?',[c.tenant,x.barn_id,x.day]);
   if(old&&Number(old.eggs)===x.eggs)return {id:old.id,duplicate:true};
   if(old&&(!x.correct||!['EWS','OWNER','MANAGER'].includes(c.user!.role)))fail(409,'Produção já registrada. Uma correção exige gestor e confirmação.');
   const result=await saveResource(tx,{...c.user,role:'MANAGER'},c.tenant!,ent,'production',{barn_id:x.barn_id,day:x.day,eggs:x.eggs,birds:Number(p.birds),source:'MANUAL'},old?.id);
   await audit(tx,c.user,c.tenant,'staff_production','production',result.id);return result;
  });
 });
 route('POST','/api/staff/incidents',async c=>{
  const x=z.object({equipment_id:z.string().uuid(),category:z.enum(['Parou de funcionar','Ruído incomum','Aquecimento','Vazamento','Outro']),description:z.string().trim().min(3).max(180),request_id:z.string().uuid().optional()}).strict().parse(c.body);
  return db.transaction(async tx=>{const fingerprint=hash(JSON.stringify({equipment_id:x.equipment_id,category:x.category,description:x.description}));if(x.request_id){const previous=await one(tx,'SELECT * FROM staff_requests WHERE user_id=? AND request_key=?',[c.user!.id,x.request_id]);if(previous){if(previous.payload_hash!==fingerprint)fail(409,'Identificador reutilizado com dados diferentes.');return JSON.parse(previous.response);}}const e=await one(tx,'SELECT barn_id FROM equipment WHERE tenant_id=? AND id=?',[c.tenant,x.equipment_id]);if(!e)fail(404,'Equipamento não encontrado.');await requireBarn(tx,c,e.barn_id);const saved=await saveResource(tx,{...c.user,role:'TECH'},c.tenant!,await entitlement(tx,c.tenant!),'incidents',{equipment_id:x.equipment_id,title:x.category+': '+x.description,severity:'warning',status:'open',assignee:'',action:''});if(x.request_id)await insert(tx,'staff_requests',{id:uid(),tenant_id:c.tenant,user_id:c.user!.id,request_key:x.request_id,payload_hash:fingerprint,response:JSON.stringify(saved),created_at:now()});return saved;});
 });
 route('POST','/api/staff/tasks/:id',async c=>{
  if(!['TECH','OWNER','MANAGER','EWS'].includes(c.user!.role))fail(403,'Execução exige perfil técnico.');
  const x=z.object({checklist:z.array(z.object({label:z.string().max(250),done:z.boolean()})).max(100),report:z.string().max(5000),duration_minutes:z.number().int().min(0),status:z.enum(['in_progress','completed'])}).strict().parse(c.body);
  return db.transaction(async tx=>{const ent=await entitlement(tx,c.tenant!);if(!ent.modules.includes('predict'))fail(403,'Predict não incluído.');const o=await one(tx,'SELECT w.*,e.barn_id FROM work_orders w JOIN equipment e ON e.id=w.equipment_id WHERE w.tenant_id=? AND w.id=?',[c.tenant,c.params.id]);if(!o||![c.user!.id,c.user!.email].includes(o.assignee))fail(403,'Tarefa não atribuída a você.');await requireBarn(tx,c,o.barn_id);
   if(!['assigned','in_progress'].includes(o.status)||x.status==='completed'&&o.status!=='in_progress')fail(409,'Inicie a tarefa antes de concluir.');
   const original=JSON.parse(o.checklist);if(original.length!==x.checklist.length||original.some((v:Row,i:number)=>v.label!==x.checklist[i].label))fail(400,'Checklist difere da ordem original.');
   if(x.status==='completed'&&(!x.report.trim()||x.checklist.some(i=>!i.done)))fail(400,'Conclua o checklist e informe o relatório.');
   await update(tx,'work_orders',{...x,checklist:JSON.stringify(x.checklist),completed_at:x.status==='completed'?now():null},'id=? AND tenant_id=?',[o.id,c.tenant]);await audit(tx,c.user,c.tenant,'staff_task','work_orders',o.id);return {ok:true};
  });
 });
 route('GET','/api/staff/assignments/:id',async c=>{manager(c);return {items:await db.query('SELECT barn_id,preferred FROM user_barns WHERE tenant_id=? AND user_id=?',[c.tenant,c.params.id])};});
 route('PUT','/api/staff/assignments/:id',async c=>{
  manager(c);const x=z.object({barn_ids:z.array(z.string().uuid()).max(200),preferred:z.string().uuid().nullable()}).strict().parse(c.body);
  return db.transaction(async tx=>{if(!await one(tx,'SELECT id FROM users WHERE id=? AND tenant_id=?',[c.params.id,c.tenant]))fail(404,'Usuário não encontrado.');if(x.preferred&&!x.barn_ids.includes(x.preferred))fail(400,'Galpão habitual precisa estar atribuído.');for(const id of x.barn_ids)if(!await one(tx,'SELECT id FROM barns WHERE id=? AND tenant_id=?',[id,c.tenant]))fail(400,'Galpão inválido.');await tx.query('DELETE FROM user_barns WHERE tenant_id=? AND user_id=?',[c.tenant,c.params.id]);for(const id of new Set(x.barn_ids))await insert(tx,'user_barns',{tenant_id:c.tenant,user_id:c.params.id,barn_id:id,preferred:id===x.preferred?1:0});await audit(tx,c.user,c.tenant,'barn_assignments','users',c.params.id);return {ok:true};});
 });
 route('POST','/api/population',async c=>{manager(c);const x=z.object({barn_id:z.string().uuid(),day:z.string(),birds:z.number().int()}).strict().parse(c.body);return db.transaction(async tx=>{const ent=await entitlement(tx,c.tenant!);if(!ent.modules.includes('performance'))fail(403,'Performance não incluído.');const created=await recordPopulation(tx,c.tenant!,x,ent.demo?'SIMULATED':'MANUAL');await audit(tx,c.user,c.tenant,'population_confirmed','barns',x.barn_id);return {created};});});
 const sourceSchema=z.object({name:z.string().trim().min(2).max(100),resource:z.enum(['production','birds','energy_readings','costs']),kind:z.enum(['manual','api','https']),format:z.enum(['csv','xlsx']),mapping:z.record(z.string().min(1).max(100)).refine(m=>Object.keys(m).length>0&&Object.keys(m).length<=20),endpoint:z.string().max(1000).default(''),secret:z.string().max(4000).optional(),interval_minutes:z.number().int().min(15).max(10080),active:z.number().int().min(0).max(1)}).strict();
 const sourceFor=async(c:Context)=>{manager(c);await entitlement(db,c.tenant!);const s=await one(db,'SELECT * FROM integration_sources WHERE id=? AND tenant_id=?',[c.params.id,c.tenant]);if(!s)fail(404,'Integração não encontrada.');return s;};
 route('GET','/api/integrations',async c=>{manager(c);await entitlement(db,c.tenant!);return {items:(await db.query('SELECT * FROM integration_sources WHERE tenant_id=? ORDER BY created_at DESC',[c.tenant])).map(({secret,token_hash,...s})=>({...s,mapping:JSON.parse(s.mapping),credential_configured:!!secret}))};});
 for(const method of ['POST','PUT'])route(method,method==='POST'?'/api/integrations':'/api/integrations/:id',async c=>{
  manager(c);const ent=await entitlement(db,c.tenant!),x=sourceSchema.parse(c.body);if(!ent.modules.includes(x.resource==='energy_readings'?'energy':'performance'))fail(403,'Módulo não incluído.');
  const allowed=x.resource==='birds'?['barn_id','birds','day']:Object.keys(resources[x.resource].fields).filter(k=>k!=='source');if(Object.keys(x.mapping).some(k=>!allowed.includes(k)))fail(400,'Campo de destino não permitido.');
  if(x.kind==='https')allowedEndpoint(x.endpoint);
  const id=c.params.id||uid(),old=method==='PUT'?await sourceFor(c):null,raw=x.kind==='api'&&!old?token():null;
  const {secret,...values}=x;const data={...values,mapping:JSON.stringify(x.mapping),secret:secret?encryptSecret(secret):old?.secret||null,token_hash:old?.token_hash||(raw?hash(raw):null),next_run_at:now()};
  if(old&&old.resource!==x.resource)fail(409,'Crie outra integração para mudar o recurso.');
  if(old)await update(db,'integration_sources',data,'id=? AND tenant_id=?',[id,c.tenant]);else await insert(db,'integration_sources',{id,tenant_id:c.tenant,...data,created_at:now()});await audit(db,c.user,c.tenant,'integration_saved','integration_sources',id);return {id,...(raw?{token:raw}:{})};
 });
 route('POST','/api/integrations/:id/token',async c=>{const s=await sourceFor(c);if(s.kind!=='api')fail(400,'Fonte não é API.');const raw=token();await update(db,'integration_sources',{token_hash:hash(raw)},'id=?',[s.id]);await audit(db,c.user,c.tenant,'integration_token_rotated','integration_sources',s.id);return {token:raw};});
 const payload=z.object({content:z.string().max(2000000).optional(),rows:z.array(z.record(z.any())).max(1000).optional()}).strict().refine(x=>!!x.content!==!!x.rows,'Envie arquivo OU registros.');
 for(const action of ['preview','import'])route('POST','/api/integrations/:id/'+action,async c=>{const s=await sourceFor(c);return runImport(db,s,payload.parse(c.body),action==='preview',c.user);});
 route('POST','/api/integrations/:id/sync',async c=>{const s=await sourceFor(c);if(s.kind!=='https')fail(400,'Sincronização somente para HTTPS.');await update(db,'integration_sources',{next_run_at:now()},'id=?',[s.id]);return {message:'Sincronização solicitada ao worker.'};});
 route('GET','/api/integrations/:id/runs',async c=>{const s=await sourceFor(c);return {items:await db.query('SELECT id,status,accepted,duplicates,error,started_at,finished_at FROM import_runs WHERE tenant_id=? AND source_id=? ORDER BY started_at DESC LIMIT 50',[c.tenant,s.id])};});
 route('POST','/api/integrations/:id/retry/:run',async c=>{const s=await sourceFor(c),r=await one(db,"SELECT payload FROM import_runs WHERE id=? AND tenant_id=? AND source_id=? AND status='failed'",[c.params.run,c.tenant,s.id]);if(!r?.payload)fail(409,'Arquivo não retido. Envie novamente ou solicite sincronização.');return runImport(db,s,JSON.parse(r.payload),false,c.user);});
 route('POST','/api/import-feed',async c=>{const auth=c.request.headers.authorization||'';if(!auth.startsWith('Bearer '))fail(401,'Token inválido.');const s=await one(db,"SELECT * FROM integration_sources WHERE token_hash=? AND kind='api' AND active=1",[hash(auth.slice(7))]);if(!s)fail(401,'Token inválido.');return runImport(db,s,payload.parse(c.body));},true);
 const reportSchema=z.object({name:z.string().min(2).max(100),frequency:z.enum(['daily','weekly']),weekday:z.number().int().min(0).max(6),send_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),barn_ids:z.array(z.string().uuid()).max(100),indicators:z.array(z.enum(['production','energy','maintenance','attention'])).min(1).max(4),recipient_ids:z.array(z.string().uuid()).min(1).max(20),active:z.number().int().min(0).max(1)}).strict();
 const reportFor=async(c:Context)=>{manager(c);await entitlement(db,c.tenant!);const s=await one(db,'SELECT * FROM report_schedules WHERE tenant_id=? AND id=?',[c.tenant,c.params.id]);if(!s)fail(404,'Agendamento não encontrado.');return s;};
 route('GET','/api/report-schedules',async c=>{manager(c);await entitlement(db,c.tenant!);const items=await db.query('SELECT * FROM report_schedules WHERE tenant_id=? ORDER BY created_at DESC',[c.tenant]);return {smtp_configured:!!process.env.SMTP_HOST,items:await Promise.all(items.map(async s=>({...s,barn_ids:JSON.parse(s.barn_ids),indicators:JSON.parse(s.indicators),recipient_ids:(await db.query('SELECT user_id FROM report_recipients WHERE tenant_id=? AND schedule_id=?',[c.tenant,s.id])).map(u=>u.user_id)}))),recipients:await db.query("SELECT id,name,email FROM users WHERE tenant_id=? AND active=1 AND role IN ('OWNER','MANAGER') AND access_profile=''",[c.tenant])};});
 for(const method of ['POST','PUT'])route(method,method==='POST'?'/api/report-schedules':'/api/report-schedules/:id',async c=>{
  manager(c);await entitlement(db,c.tenant!);const x=reportSchema.parse(c.body),id=c.params.id||uid();if(method==='PUT')await reportFor(c);
  return db.transaction(async tx=>{for(const barn of x.barn_ids)if(!await one(tx,'SELECT id FROM barns WHERE id=? AND tenant_id=?',[barn,c.tenant]))fail(400,'Galpão inválido.');for(const user of x.recipient_ids)if(!await one(tx,"SELECT id FROM users WHERE id=? AND tenant_id=? AND active=1 AND role IN ('OWNER','MANAGER') AND access_profile=''",[user,c.tenant]))fail(400,'Destinatário não autorizado.');
   const {recipient_ids,...v}=x;const data={...v,barn_ids:JSON.stringify([...new Set(x.barn_ids)]),indicators:JSON.stringify(x.indicators)};
   if(method==='PUT')await update(tx,'report_schedules',data,'id=? AND tenant_id=?',[id,c.tenant]);else await insert(tx,'report_schedules',{id,tenant_id:c.tenant,...data,created_at:now()});
   await tx.query('DELETE FROM report_recipients WHERE schedule_id=? AND tenant_id=?',[id,c.tenant]);for(const user of new Set(recipient_ids))await insert(tx,'report_recipients',{tenant_id:c.tenant,schedule_id:id,user_id:user});await audit(tx,c.user,c.tenant,'report_schedule_saved','report_schedules',id);return {id};
  });
 });
 route('GET','/api/report-schedules/:id/preview',async c=>{const s=await reportFor(c),r=await executiveReport(db,s);c.headers['content-type']='text/html; charset=utf-8';c.headers['content-security-policy']="default-src 'none'; style-src 'unsafe-inline'; sandbox";return r.html;});
 route('GET','/api/report-schedules/:id/deliveries',async c=>{const s=await reportFor(c);return {items:await db.query('SELECT id,user_id,slot,status,attempts,error,created_at,sent_at FROM report_deliveries WHERE tenant_id=? AND schedule_id=? ORDER BY created_at DESC LIMIT 100',[c.tenant,s.id])};});
 route('POST','/api/report-schedules/:id/retry/:run',async c=>{const s=await reportFor(c);const delivery=await one(db,"SELECT id FROM report_deliveries WHERE id=? AND tenant_id=? AND schedule_id=? AND status='failed'",[c.params.run,c.tenant,s.id]);if(!delivery)fail(409,'Envio não está em falha.');await update(db,'report_deliveries',{status:'pending',attempts:0,next_attempt_at:now(),error:null},'id=?',[delivery.id]);await audit(db,c.user,c.tenant,'report_retry','report_deliveries',delivery.id);return {ok:true};});
}
