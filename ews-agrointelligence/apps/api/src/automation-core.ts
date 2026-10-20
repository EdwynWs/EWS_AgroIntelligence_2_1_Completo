import {one,insert,update} from '../../../packages/database/db.ts';
import type {Database,Queryable,Row} from '../../../packages/database/db.ts';
import {fail,uid,now,entitlement,saveResource,audit} from './domain.ts';
import {hash} from './security.ts';
import {resources,validate} from '../../../packages/shared/resources.ts';
import {parseCsv} from '../../../packages/shared/calculations.ts';
import {xlsxToCsv} from './imports.ts';

export function localClock(timezone:string,at=new Date()){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 const get=(key:string)=>p.find(v=>v.type===key)!.value;
 return {day:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}
export async function lease(db:Database,key:string,work:()=>Promise<any>){
 const owner=uid(),time=now();await db.query('INSERT INTO job_leases(id,owner,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE job_leases.expires_at<?',[key,owner,new Date(Date.now()+600000).toISOString(),time]);
 if((await one(db,'SELECT owner FROM job_leases WHERE id=?',[key]))?.owner!==owner)return {busy:true};
 try{return await work();}finally{await db.query('DELETE FROM job_leases WHERE id=? AND owner=?',[key,owner]);}
}
export async function population(db:Queryable,tenant:string,barn:string,day:string){
 return one(db,'SELECT * FROM population_records WHERE tenant_id=? AND barn_id=? AND day<=? ORDER BY day DESC LIMIT 1',[tenant,barn,day]);
}
export async function recordPopulation(db:Queryable,tenant:string,row:Row,source:string){
 const barn=await one(db,'SELECT * FROM barns WHERE tenant_id=? AND id=?',[tenant,row.barn_id]);
 const t=await one(db,'SELECT timezone FROM tenants WHERE id=?',[tenant]);
 if(!barn||!Number.isInteger(row.birds)||row.birds<=0||row.birds>barn.capacity||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||isNaN(Date.parse(row.day))||new Date(row.day).toISOString().slice(0,10)!==row.day||row.day>localClock(t.timezone).day)fail(400,'População, data ou galpão inválidos.');
 const old=await one(db,'SELECT * FROM population_records WHERE tenant_id=? AND barn_id=? AND day=?',[tenant,row.barn_id,row.day]);
 if(old){if(Number(old.birds)===row.birds)return false;fail(409,'Já existe população diferente para esta data. Revise o lançamento.');}
 await insert(db,'population_records',{id:uid(),tenant_id:tenant,barn_id:row.barn_id,day:row.day,birds:row.birds,source,created_at:now()});
 const latest=await population(db,tenant,barn.id,localClock(t.timezone).day);
 await update(db,'barns',{birds:latest.birds},'tenant_id=? AND id=?',[tenant,barn.id]);return true;
}
export async function inputRows(payload:Row,format:string):Promise<Row[]>{
 if(payload.rows){if(!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>1000||JSON.stringify(payload.rows).length>1500000)fail(400,'Envie de 1 a 1.000 registros, até 1,5 MB.');return payload.rows;}
 try{const csv=format==='xlsx'?await xlsxToCsv(String(payload.content||'')):String(payload.content||'');if(csv.length>1500000)fail(400,'Arquivo excede 1,5 MB.');const rows=parseCsv(csv);if(!rows.length)fail(400,'Arquivo vazio.');return rows;}catch(e:any){return fail(400,e.message);}
}
const canonical=(value:Row)=>JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])));
class Preview extends Error { result:Row;constructor(result:Row){super('preview');this.result=result;} }
export async function runImport(db:Database,source:Row,payload:Row,preview=false,actor:Row|null=null){
 return lease(db,'import:'+source.id,async()=>{
 const id=uid(),fingerprint=hash(JSON.stringify(payload));
 if(!preview)await insert(db,'import_runs',{id,tenant_id:source.tenant_id,source_id:source.id,fingerprint,status:'running',payload:JSON.stringify(payload),started_at:now()});
 try{
 const rows=await inputRows(payload,source.format),mapping=JSON.parse(source.mapping);
 const result=await db.transaction(async tx=>{
  const ent=await entitlement(tx,source.tenant_id);const fresh=await one(tx,'SELECT active FROM integration_sources WHERE id=? AND tenant_id=?',[source.id,source.tenant_id]);if(!fresh?.active)fail(409,'Integração desativada.');
  let accepted=0,duplicates=0;
  for(let i=0;i<rows.length;i++){
   try{
    const mapped:Row={};for(const [dest,column]of Object.entries(mapping)){if(!Object.hasOwn(rows[i],String(column)))fail(400,`Coluna ausente: ${column}`);mapped[dest]=rows[i][String(column)];}
    if(source.resource==='birds')mapped.birds=Number(mapped.birds);else for(const [key,field]of Object.entries(resources[source.resource].fields)){if(mapped[key]===''&&!field.required)delete mapped[key];if(mapped[key]!==undefined&&field.type==='number')mapped[key]=Number(mapped[key]);}
    if(mapped.day&&/^\d+(\.\d+)?$/.test(String(mapped.day)))mapped.day=new Date(Date.UTC(1899,11,30)+Number(mapped.day)*86400000).toISOString().slice(0,10);
    const recordHash=hash(canonical(mapped));
    if(await one(tx,'SELECT id FROM imported_records WHERE source_id=? AND fingerprint=?',[source.id,recordHash])){duplicates++;continue;}
    if(source.resource==='birds'){
     if(!ent.modules.includes('performance'))fail(403,'Performance não incluído.');
     if(await recordPopulation(tx,source.tenant_id,mapped,ent.demo?'SIMULATED':'IMPORTED'))accepted++;else duplicates++;
    }else{
     if(['production','energy_readings'].includes(source.resource))mapped.source='IMPORTED';
     if(source.resource==='production'&&mapped.birds===undefined){const p=await population(tx,source.tenant_id,mapped.barn_id,mapped.day);if(!p||Date.parse(mapped.day)-Date.parse(p.day)>30*86400000)fail(400,'População ausente ou confirmada há mais de 30 dias.');mapped.birds=Number(p.birds);}
     const clean=validate(source.resource,mapped);let old=null;
     if(source.resource==='production')old=await one(tx,'SELECT * FROM production WHERE tenant_id=? AND barn_id=? AND day=?',[source.tenant_id,clean.barn_id,clean.day]);
     if(source.resource==='energy_readings')old=await one(tx,'SELECT * FROM energy_readings WHERE tenant_id=? AND meter_id=? AND day=?',[source.tenant_id,clean.meter_id,clean.day]);
     if(old){const keys=source.resource==='production'?['eggs','birds']:['kwh','demand_kw','evidence'];if(keys.some(k=>String(old[k]??'')!==String(clean[k]??'')))fail(409,'Registro diário existente com valores diferentes. Corrija pelo cadastro autorizado.');duplicates++;}
     else{const saved=await saveResource(tx,{id:actor?.id,role:'OWNER'},source.tenant_id,ent,source.resource,clean);if(source.resource==='costs')await update(tx,'costs',{source:ent.demo?'SIMULATED':'IMPORTED'},'id=?',[saved.id]);accepted++;}
    }
    await insert(tx,'imported_records',{id:uid(),tenant_id:source.tenant_id,source_id:source.id,fingerprint:recordHash,created_at:now()});
   }catch(e:any){fail(e.status||400,`Linha ${i+2}: ${e.message}`);}
  }
  const result={id,accepted,duplicates,preview};if(preview)throw new Preview(result);
  await update(tx,'import_runs',{status:'completed',accepted,duplicates,payload:null,finished_at:now()},'id=?',[id]);
  await update(tx,'integration_sources',{last_status:'completed',last_run_at:now()},'id=?',[source.id]);
  await audit(tx,actor,source.tenant_id,'import_completed','integration_sources',source.id,{accepted,duplicates});return result;
 });return result;
 }catch(e:any){if(e instanceof Preview)return e.result;
  const message=e.status&&e.status<500?String(e.message).slice(0,1000):'Falha de processamento. Revise o arquivo e as referências.';
  if(!preview){await update(db,'import_runs',{status:'failed',error:message,finished_at:now()},'id=?',[id]);await update(db,'integration_sources',{last_status:'failed',last_run_at:now()},'id=?',[source.id]);}
  fail(e.status||400,message);
 }
 });
}
