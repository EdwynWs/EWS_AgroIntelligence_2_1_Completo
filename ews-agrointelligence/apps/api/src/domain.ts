import { randomUUID } from 'node:crypto';
import { one, insert, update } from '../../../packages/database/db.ts';
import type { Queryable, Row } from '../../../packages/database/db.ts';
import { resources, validate, parseJson } from '../../../packages/shared/resources.ts';
import { alertDecision, classify, energyCostCents, ratio } from '../../../packages/shared/calculations.ts';
export class HttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
export const now=()=>new Date().toISOString();
export const uid=()=>randomUUID();
export async function audit(db:Queryable,actor:Row|null,tenant:string|null,action:string,entity:string,id:string,details:Row={}){await insert(db,'audit_logs',{id:uid(),tenant_id:tenant,user_id:actor?.id||null,action,entity,entity_id:id,details:JSON.stringify(details),created_at:now()});}
export async function entitlement(db:Queryable,tenant:string):Promise<Row>{
 const x=await one(db,'SELECT s.*,p.modules,p.equipment_limit,p.user_limit,p.name as plan_name,p.price_cents,t.demo,t.name as tenant_name,t.timezone FROM subscriptions s JOIN plans p ON p.id=s.plan_id JOIN tenants t ON t.id=s.tenant_id WHERE s.tenant_id=?',[tenant]);
 if(!x)fail(403,'Assinatura não encontrada.');
 if(!['active','trial'].includes(x.status)||(x.status==='trial'&&(!x.trial_until||Date.parse(x.trial_until)<Date.now())))fail(403,'Assinatura suspensa, encerrada ou teste expirado.');
 return {...x,modules:parseJson<string[]>(x.modules,[])};
}
export function authorize(actor:Row,ent:Row,resource:string,write=false){const d=resources[resource];if(!d)fail(404,'Recurso não encontrado.');if(d.module!=='base'&&!ent.modules.includes(d.module))fail(403,'Módulo não incluído no plano.');if(write&&actor.role!=='EWS'&&!d.roles.includes(actor.role))fail(403,'Seu perfil não permite esta ação.');}
export function serialize(row:Row){const copy={...row};for(const k of ['checklist','modules'])if(k in copy)copy[k]=parseJson(copy[k],[]);delete copy.token_hash;return copy;}
export async function saveResource(db:Queryable,actor:Row,tenant:string,ent:Row,name:string,input:Row,id?:string){
 authorize(actor,ent,name,true);
 const current=id?await one(db,`SELECT * FROM ${name} WHERE id=? AND tenant_id=?`,[id,tenant]):null;
 if(id&&!current)fail(404,'Registro não encontrado.');
 if(name==='work_orders'&&current?.status==='completed')fail(409,'Ordem finalizada não pode ser alterada.');
 let data:Row;
 try{data=validate(name,input);}catch(e:any){fail(400,e.message);}
 const identity=id||uid();
 if(!id&&name==='equipment'){const count=await one(db,'SELECT COUNT(*) as n FROM equipment WHERE tenant_id=?',[tenant]);if(Number(count.n)>=ent.equipment_limit)fail(409,'Limite de equipamentos do plano atingido.');}
 if(name==='tariffs') {const overlap=await one(db,'SELECT id FROM tariffs WHERE tenant_id=? AND id<>? AND starts_on<=? AND ends_on>=?',[tenant,identity,data!.ends_on,data!.starts_on]);if(overlap)fail(409,'Vigências de tarifa não podem se sobrepor.');}
 if(name==='downtimes') {const overlap=await one(db,'SELECT id FROM downtimes WHERE tenant_id=? AND equipment_id=? AND id<>? AND starts_at<? AND ends_at>?',[tenant,data!.equipment_id,identity,data!.ends_at,data!.starts_at]);if(overlap)fail(409,'Parada sobreposta ao mesmo equipamento.');}
 for(const [key,field] of Object.entries(resources[name].fields))if(field.ref&&data![key]){if(!await one(db,`SELECT id FROM ${field.ref} WHERE id=? AND tenant_id=?`,[data![key],tenant]))fail(400,`${field.label}: referência inválida.`);}
 if(name==='meters'&&current&&current.barn_id!==data!.barn_id&&await one(db,'SELECT id FROM energy_readings WHERE tenant_id=? AND meter_id=? LIMIT 1',[tenant,current.id]))fail(409,'Medidor com histórico: crie outro medidor para mudar o escopo.');
 if(name==='energy_readings'){
  const meter=await one(db,'SELECT barn_id FROM meters WHERE tenant_id=? AND id=?',[tenant,data!.meter_id]);
  const overlaps=await db.query('SELECT m.barn_id FROM energy_readings e JOIN meters m ON m.id=e.meter_id WHERE e.tenant_id=? AND e.day=? AND e.id<>?',[tenant,data!.day,identity]);
  if(overlaps.some(x=>!x.barn_id||!meter.barn_id||x.barn_id===meter.barn_id))fail(409,'Leituras do mesmo escopo se sobrepõem. Use um medidor geral OU um por galpão para cada dia.');
 }
 if(name==='incidents'){data!.source=current?.source||(ent.demo?'SIMULATED':'MANUAL');data!.closed_at=data!.status==='closed'?now():null;if(!id){data!.opened_at=now();data!.rule_id=null;}}
 if(name==='work_orders'&&!id){data!.status='open';data!.completed_at=null;}
 if(name==='tickets'&&!id){data!.status='open';data!.reply='';}
 if(['energy_readings','production','costs','invoices','downtimes','operation_logs'].includes(name))data!.source=ent.demo?'SIMULATED':(data!.source||'MANUAL');
 for(const [k,v]of Object.entries(data!))if(Array.isArray(v))data![k]=JSON.stringify(v);
 if(id)await update(db,name,data!,'id=? AND tenant_id=?',[id,tenant]);else await insert(db,name,{id:identity,tenant_id:tenant,...data!,created_at:now()});
 await audit(db,actor,tenant,id?'update':'create',name,identity);
 return serialize(await one(db,`SELECT * FROM ${name} WHERE id=? AND tenant_id=?`,[identity,tenant]));
}
export async function ingest(db:Queryable,gateway:Row,batch:Row[]){
 const tenant=await one(db,'SELECT * FROM tenants WHERE id=?',[gateway.tenant_id]);
 const ent=await entitlement(db,gateway.tenant_id);if(!ent.modules.includes('monitor'))fail(403,'Monitor não habilitado.');
 let accepted=0,duplicates=0;
 for(const item of batch){
  const tag=await one(db,'SELECT * FROM tags WHERE id=? AND gateway_id=? AND tenant_id=?',[item.tag_id,gateway.id,gateway.tenant_id]);
  if(!tag)fail(400,'Tag não autorizada para este gateway.');
  if(item.unit!==tag.unit||item.value<tag.minimum||item.value>tag.maximum)fail(400,'Unidade ou valor fora do intervalo autorizado.');
  if(tag.kind==='state'&&![0,1,2].includes(item.value))fail(400,'Estado deve ser 0, 1 ou 2.');
  if(Date.parse(item.observed_at)>Date.now()+60000)fail(400,'Timestamp no futuro.');
  if(Date.parse(item.observed_at)<Date.now()-Number(process.env.TELEMETRY_RETENTION_DAYS||90)*86400000)fail(400,'Dado mais antigo que a retenção aceita.');
  if(!tenant.demo&&item.source==='SIMULATED')fail(400,'Dados simulados são proibidos neste ambiente real.');
  const old=await one(db,'SELECT * FROM measurements WHERE gateway_id=? AND sequence=?',[gateway.id,item.sequence]);
  const source=tenant.demo?'SIMULATED':item.source;
  if(old){if(old.tag_id!==item.tag_id||Number(old.value)!==item.value||old.observed_at!==item.observed_at||old.quality!==item.quality||old.source!==source)fail(409,'Sequência reutilizada com conteúdo diferente.');duplicates++;continue;}
  const received=now();
  await insert(db,'measurements',{id:uid(),tenant_id:gateway.tenant_id,gateway_id:gateway.id,tag_id:tag.id,sequence:item.sequence,value:item.value,unit:item.unit,quality:item.quality,source,observed_at:item.observed_at,received_at:received});
  const latest=await one(db,'SELECT * FROM tag_latest WHERE tag_id=? AND tenant_id=?',[tag.id,gateway.tenant_id]);
  if(!latest||latest.observed_at<item.observed_at){
   await db.query('INSERT INTO tag_latest(tag_id,tenant_id,value,quality,source,observed_at) VALUES (?,?,?,?,?,?) ON CONFLICT(tag_id) DO UPDATE SET value=excluded.value,quality=excluded.quality,source=excluded.source,observed_at=excluded.observed_at',[tag.id,gateway.tenant_id,item.value,item.quality,source,item.observed_at]);
   const rules=await db.query('SELECT * FROM alert_rules WHERE tag_id=? AND tenant_id=? AND active=1',[tag.id,gateway.tenant_id]);
   for(const rule of rules){
    if(item.quality!=='GOOD'||Date.now()-Date.parse(item.observed_at)>tag.stale_seconds*1000){await update(db,'alert_rules',{pending_since:null,last_evaluated_at:item.observed_at},'id=?',[rule.id]);continue;}
    if(rule.last_evaluated_at&&Date.parse(item.observed_at)-Date.parse(rule.last_evaluated_at)>tag.stale_seconds*1000)rule.pending_since=null;
    const decision=alertDecision(rule as any,item.value,item.observed_at);
    await update(db,'alert_rules',{pending_since:decision.pending,latched:decision.latched,last_evaluated_at:item.observed_at},'id=?',[rule.id]);
    if(decision.trigger&&!await one(db,"SELECT id FROM incidents WHERE rule_id=? AND status<>'closed'",[rule.id])){
     const incident=uid();
     await insert(db,'incidents',{id:incident,tenant_id:gateway.tenant_id,equipment_id:tag.equipment_id,rule_id:rule.id,title:rule.name,severity:rule.severity,status:'open',assignee:'',action:'',source,opened_at:received,closed_at:null,created_at:received});
     await insert(db,'notifications',{id:uid(),tenant_id:gateway.tenant_id,title:rule.name,body:`Limiar ${rule.threshold} ${tag.unit}; medição ${item.value} ${tag.unit}. Origem: ${source}.`,read_at:null,created_at:received});
     const recipients=await db.query("SELECT email FROM users WHERE tenant_id=? AND active=1 AND role IN ('OWNER','MANAGER')",[gateway.tenant_id]);
     if(process.env.SMTP_HOST)for(const user of recipients)await insert(db,'outbox',{id:uid(),tenant_id:gateway.tenant_id,recipient:user.email,subject:`AgroIntelligence: ${rule.name}`,body:`Ocorrência ${incident}. Consulte o painel para registrar providências.`,status:'pending',attempts:0,next_attempt_at:received,created_at:received});
    }
   }
  }
  const hour=item.observed_at.slice(0,13)+':00:00.000Z';
  await db.query('INSERT INTO hourly_metrics(tenant_id,tag_id,hour,source,quality,count,sum,minimum,maximum) VALUES (?,?,?,?,?,1,?,?,?) ON CONFLICT(tag_id,hour,source,quality) DO UPDATE SET count=hourly_metrics.count+1,sum=hourly_metrics.sum+excluded.sum,minimum=CASE WHEN excluded.minimum<hourly_metrics.minimum THEN excluded.minimum ELSE hourly_metrics.minimum END,maximum=CASE WHEN excluded.maximum>hourly_metrics.maximum THEN excluded.maximum ELSE hourly_metrics.maximum END',[gateway.tenant_id,tag.id,hour,source,item.quality,item.value,item.value,item.value]);
  accepted++;
 }
 await update(db,'gateways',{last_seen:now(),last_error:null},'id=?',[gateway.id]);return {accepted,duplicates};
}
export async function equipmentStatus(db:Queryable,tenant:string):Promise<Row[]>{
 const rows=await db.query('SELECT e.*,b.name AS barn_name FROM equipment e JOIN barns b ON b.id=e.barn_id WHERE e.tenant_id=? ORDER BY e.name',[tenant]);
 const tags=await db.query('SELECT t.*,l.value,l.quality,l.source,l.observed_at FROM tags t LEFT JOIN tag_latest l ON l.tag_id=t.id WHERE t.tenant_id=?',[tenant]);
 return rows.map(e=>{const items=tags.filter(t=>t.equipment_id===e.id);const state=items.find(t=>t.kind==='state');const valid=items.filter(t=>t.observed_at).sort((a,b)=>b.observed_at.localeCompare(a.observed_at));return {...e,status:state?classify(state.value,state.quality,state.observed_at,state.stale_seconds):valid.length?'unknown':'offline',last_seen:valid[0]?.observed_at||null,tags:items};});
}
export function period(query:Row,timezone='America/Sao_Paulo'){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(k:string)=>parts.find(p=>p.type===k)!.value;const today=part('year')+'-'+part('month')+'-'+part('day');const end=query.to||today;const start=query.from||new Date(Date.parse(today+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||isNaN(Date.parse(start))||isNaN(Date.parse(end))||new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end||start>end||Date.parse(end)-Date.parse(start)>366*86400000)fail(400,'Use um período válido de até 366 dias.');return {start,end};}
export async function dashboard(db:Queryable,tenant:string,query:Row){
 const ent=await entitlement(db,tenant);const {start,end}=period(query,ent.timezone);const barn=query.barn||null;
 if(barn&&!await one(db,'SELECT id FROM barns WHERE id=? AND tenant_id=?',[barn,tenant]))fail(404,'Galpão não encontrado.');
 const filter=barn?' AND barn_id=?':'';const params=barn?[tenant,start,end,barn]:[tenant,start,end];
 const equipments=(await equipmentStatus(db,tenant)).filter(e=>!barn||e.barn_id===barn);
 const barns=(await db.query('SELECT * FROM barns WHERE tenant_id=? ORDER BY name',[tenant])).filter(b=>!barn||b.id===barn);
 const incidents=await db.query('SELECT i.*,e.name as equipment_name FROM incidents i JOIN equipment e ON e.id=i.equipment_id WHERE i.tenant_id=?'+(barn?' AND e.barn_id=?':'')+' ORDER BY i.created_at DESC LIMIT 10',barn?[tenant,barn]:[tenant]);
 const active=await one(db,"SELECT COUNT(*) AS n FROM incidents i JOIN equipment e ON e.id=i.equipment_id WHERE i.tenant_id=? AND i.status<>'closed'"+(barn?' AND e.barn_id=?':''),barn?[tenant,barn]:[tenant]);
 let energy:Row={days:[],kwh:null,cost_cents:null,missing_tariffs:0,classification:'Sem dados',invoiced_cents:null};
 if(ent.modules.includes('energy')){
  const days=await db.query('SELECT e.day,SUM(e.kwh) AS kwh,SUM(CASE WHEN t.id IS NOT NULL THEN e.kwh*t.rate_micros/10000.0 ELSE 0 END) AS cost_cents,SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END) AS missing FROM energy_readings e JOIN meters m ON m.id=e.meter_id LEFT JOIN tariffs t ON t.tenant_id=e.tenant_id AND t.starts_on<=e.day AND t.ends_on>=e.day WHERE e.tenant_id=? AND e.day>=? AND e.day<=?'+(barn?' AND m.barn_id=?':'')+' GROUP BY e.day ORDER BY e.day',params);
  const missing=days.reduce((s,d)=>s+Number(d.missing),0);
  const invoices=barn?null:await one(db,'SELECT SUM(total_cents) as total FROM invoices WHERE tenant_id=? AND period_start>=? AND period_end<=?',[tenant,start,end]);
  energy={days:days.map(d=>({...d,kwh:Number(d.kwh),cost_cents:Number(d.missing)?null:Math.round(Number(d.cost_cents))})),kwh:days.length?days.reduce((s,d)=>s+Number(d.kwh),0):null,cost_cents:days.length&&!missing?Math.round(days.reduce((s,d)=>s+Number(d.cost_cents),0)):null,missing_tariffs:missing,classification:ent.demo?'Simulado · custo estimado':'Leituras informadas · custo estimado',invoiced_cents:invoices?.total==null?null:Number(invoices.total)};
 }
 let performance:Row={days:[],eggs:null,per_bird:null,electric_per_thousand_cents:null,operating_cents:null,per_egg_cents:null};
 if(ent.modules.includes('performance')){
  const days=await db.query('SELECT day,SUM(eggs) AS eggs,SUM(birds) AS birds FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filter+' GROUP BY day ORDER BY day',params);
  const eggs=days.length?days.reduce((s,d)=>s+Number(d.eggs),0):null;
  const costs=await one(db,'SELECT SUM(amount_cents) as n FROM costs WHERE tenant_id=? AND day>=? AND day<=?'+filter,params);
  // Match daily scope before relating electrical consumption to production.
  const readings=await db.query('SELECT e.day,e.kwh,m.barn_id,t.rate_micros FROM energy_readings e JOIN meters m ON m.id=e.meter_id LEFT JOIN tariffs t ON t.tenant_id=e.tenant_id AND t.starts_on<=e.day AND t.ends_on>=e.day WHERE e.tenant_id=? AND e.day>=? AND e.day<=?'+(barn?' AND m.barn_id=?':''),params);
  const produced=await db.query('SELECT barn_id,day,eggs FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filter,params);
  let attributed=0,matched=true;
  for(const p of produced){const exact=readings.filter(e=>e.day===p.day&&e.barn_id===p.barn_id);if(exact.length!==1||exact[0].rate_micros==null){matched=false;break;}attributed+=energyCostCents(Number(exact[0].kwh),Number(exact[0].rate_micros));}
  const birds=days.reduce((s,d)=>s+Number(d.birds),0);
  performance={days:days.map(d=>({day:d.day,eggs:Number(d.eggs),birds:Number(d.birds)})),eggs,per_bird:eggs==null?null:ratio(eggs,birds),electric_per_thousand_cents:matched&&eggs?attributed/eggs*1000:null,operating_cents:costs.n==null?null:Number(costs.n),per_egg_cents:eggs&&costs.n!=null?Number(costs.n)/eggs:null};
 }
 const orders=ent.modules.includes('predict')?await db.query('SELECT w.*,e.name as equipment_name FROM work_orders w JOIN equipment e ON e.id=w.equipment_id WHERE w.tenant_id=?'+(barn?' AND e.barn_id=?':'')+' ORDER BY w.due_on LIMIT 100',barn?[tenant,barn]:[tenant]):[];
 const today=period({},ent.timezone).end;
 const orderTotals=ent.modules.includes('predict')?await one(db,"SELECT COUNT(*) AS total,SUM(CASE WHEN w.status<>'completed' THEN 1 ELSE 0 END) AS pending,SUM(CASE WHEN w.status<>'completed' AND w.due_on<? THEN 1 ELSE 0 END) AS overdue,SUM(CASE WHEN w.status='completed' AND w.completed_at>=? AND w.completed_at<=? THEN w.parts_cents+w.labor_cents ELSE 0 END) AS cost_cents FROM work_orders w JOIN equipment e ON e.id=w.equipment_id WHERE w.tenant_id=?"+(barn?' AND e.barn_id=?':''),[today,start,end+'T23:59:59.999Z',tenant,...(barn?[barn]:[])]):{total:0,pending:0,overdue:0,cost_cents:0};
 const stops=ent.modules.includes('predict')?await db.query('SELECT d.* FROM downtimes d JOIN equipment e ON e.id=d.equipment_id WHERE d.tenant_id=? AND d.starts_at>=? AND d.ends_at<=?'+(barn?' AND e.barn_id=?':''),barn?[tenant,start+'T00:00:00.000Z',end+'T23:59:59.999Z',barn]:[tenant,start+'T00:00:00.000Z',end+'T23:59:59.999Z']):[];
 const downtime=stops.reduce((s,d)=>s+Number(d.scheduled_minutes),0),failures=stops.filter(d=>d.failure===1);
 const mttr=failures.length?failures.reduce((s,d)=>s+(Date.parse(d.ends_at)-Date.parse(d.starts_at))/60000,0)/failures.length:null;
 const op=await db.query('SELECT o.* FROM operation_logs o JOIN equipment e ON e.id=o.equipment_id WHERE o.tenant_id=? AND o.day>=? AND o.day<=?'+(barn?' AND e.barn_id=?':''),params);
 const requiredDays=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 const covered=equipments.length>0&&op.length===equipments.length*requiredDays&&op.every(x=>Number(x.coverage_percent)===100);
 const scheduled=op.reduce((s,x)=>s+Number(x.scheduled_minutes),0),operating=op.reduce((s,x)=>s+Number(x.operating_minutes),0),failureCount=op.reduce((s,x)=>s+Number(x.failure_count),0);
 const availability=covered&&scheduled?operating/scheduled*100:null;
 const mtbf=covered&&failureCount?operating/60/failureCount:null;
 const provenance:Row={};for(const [key,table,module]of [['production','production','performance'],['energy','energy_readings','energy'],['operation','operation_logs','monitor']]){provenance[key]=ent.modules.includes(module)?await db.query(`SELECT source,COUNT(*) AS records FROM ${table} WHERE tenant_id=? AND day>=? AND day<=? GROUP BY source`,[tenant,start,end]):[];}
 const temp=await db.query("SELECT SUBSTR(h.hour,1,10) AS day,SUM(h.sum)/SUM(h.count) AS value FROM hourly_metrics h JOIN tags t ON t.id=h.tag_id JOIN equipment e ON e.id=t.equipment_id WHERE h.tenant_id=? AND t.kind='temperature' AND h.quality='GOOD' AND h.hour>=? AND h.hour<=?"+(barn?' AND e.barn_id=?':'')+' GROUP BY SUBSTR(h.hour,1,10) ORDER BY day',barn?[tenant,start+'T00:00:00.000Z',end+'T23:59:59.999Z',barn]:[tenant,start+'T00:00:00.000Z',end+'T23:59:59.999Z']);
 return {tenant:{name:ent.tenant_name,demo:ent.demo,timezone:ent.timezone,modules:ent.modules,plan:ent.plan_name},period:{start,end},updated_at:now(),provenance,coverage:{expected_barn_days:requiredDays*barns.length,production_barn_days:ent.modules.includes('performance')?Number((await one(db,'SELECT COUNT(*) AS n FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filter,params)).n):null},equipment:equipments,barns:barns.map(b=>({...b,equipment:equipments.filter(e=>e.barn_id===b.id).length,online:equipments.filter(e=>e.barn_id===b.id&&e.status==='running').length,alerts:incidents.filter(i=>i.status!=='closed'&&equipments.some(e=>e.id===i.equipment_id&&e.barn_id===b.id)).length})),monitor:{running:equipments.filter(e=>e.status==='running').length,stopped:equipments.filter(e=>e.status==='stopped').length,fault:equipments.filter(e=>e.status==='fault').length,offline:equipments.filter(e=>e.status==='offline').length,active_alerts:Number(active.n),availability,temperature:temp.map(d=>({...d,value:Number(d.value)}))},incidents,energy,performance,predict:{orders:orders.map(serialize),total:Number(orderTotals.total),pending:Number(orderTotals.pending||0),overdue:Number(orderTotals.overdue||0),cost_cents:Number(orderTotals.cost_cents||0),downtime_minutes:downtime,mttr_minutes:mttr,mtbf_hours:mtbf},limits:{availability:'Necessita cobertura contínua de estados e agenda histórica validada.',mtbf:'Necessita tempo operacional observado e histórico completo de falhas.',electric_per_thousand:'Exige medição por galpão, tarifa vigente e produção no mesmo dia. Sem rateio automático.',production:'Ovos por ave-dia usa população informada em cada registro diário.'}};
}
