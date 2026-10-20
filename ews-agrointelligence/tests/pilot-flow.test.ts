import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {connect,insert,one} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedPlans} from '../scripts/seed.ts';
import {fastifyTransport} from '../apps/api/src/fastify-transport.ts';
import {passwordHash,encryptSecret,base32,totp} from '../apps/api/src/security.ts';
import {localClock} from '../apps/api/src/automation-core.ts';

test('HTTP pilot: EWS MFA, two companies, operator, technician, import, reports and isolation',async()=>{
 process.env.APP_ORIGIN='http://localhost:3000';process.env.MFA_ENCRYPTION_KEY=randomBytes(32).toString('hex');
 const db=await connect({driver:'sqlite',path:':memory:'});await migrate(db);await seedPlans(db);const server=await fastifyTransport(db);
 const password=randomBytes(20).toString('hex'),secret=base32(randomBytes(20));const session:Record<string,{cookie:string;csrf:string}>={};
 try{
  await insert(db,'users',{id:randomUUID(),tenant_id:null,name:'EWS QA',email:'ews@pilot.invalid',password_hash:passwordHash(password),role:'EWS',active:1,mfa_enabled:1,mfa_secret:encryptSecret(secret),mfa_last_step:-1,created_at:new Date().toISOString()});
  const base=await server.listen({host:'127.0.0.1',port:0});
  async function call(who:string,method:string,path:string,body?:any,expected=200){const auth=session[who];const r=await fetch(base+'/api'+path,{method,headers:{origin:'http://localhost:3000','content-type':'application/json',...(auth?{cookie:auth.cookie,'x-csrf-token':auth.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});const type=r.headers.get('content-type')||'';const data=type.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());assert.equal(r.status,expected,path+': '+JSON.stringify(data));return {data,r};}
  async function login(who:string,email:string,code?:string){const {data,r}=await call('','POST','/auth/login',{email,password,code});session[who]={cookie:r.headers.get('set-cookie')!.split(';')[0],csrf:data.csrf};return data;}
  await login('ews','ews@pilot.invalid',totp(secret,Math.floor(Date.now()/30000)));
  await call('','POST','/auth/login',{email:'ews@pilot.invalid',password,code:totp(secret,Math.floor(Date.now()/30000))},401);
  const plan=(await call('ews','GET','/admin/plans')).data.items.find((p:any)=>p.name==='INTELLIGENCE');
  const a=(await call('ews','POST','/admin/tenants',{name:'Granja piloto A',plan_id:plan.id,owner_name:'Responsável A',owner_email:'a@pilot.invalid',owner_password:password})).data;
  const b=(await call('ews','POST','/admin/tenants',{name:'Granja piloto B',plan_id:plan.id,owner_name:'Responsável B',owner_email:'b@pilot.invalid',owner_password:password})).data;
  await login('owner','a@pilot.invalid');await login('other','b@pilot.invalid');
  const create=async(name:string,body:any)=>(await call('owner','POST','/data/'+name,body)).data;
  const unit=await create('units',{name:'Unidade piloto'});const barn=await create('barns',{name:'Galpão piloto',unit_id:unit.id,capacity:100,birds:80});const equipment=await create('equipment',{name:'Motor piloto',barn_id:barn.id,category:'Motor'});
  const operator=(await call('owner','POST','/users',{name:'Funcionário',email:'operator@pilot.invalid',password,role:'OPERATOR'})).data;
  const tech=(await call('owner','POST','/users',{name:'Técnico',email:'tech@pilot.invalid',password,role:'TECH'})).data;
  const viewer=(await call('owner','POST','/users',{name:'Leitor',email:'viewer@pilot.invalid',password,role:'VIEWER'})).data;
  for(const user of [operator,tech])await call('owner','PUT','/staff/assignments/'+user.id,{barn_ids:[barn.id],preferred:barn.id});
  const today=localClock('America/Sao_Paulo').day;await call('owner','POST','/population',{barn_id:barn.id,day:today,birds:80});
  await login('operator','operator@pilot.invalid');await call('operator','POST','/staff/production',{barn_id:barn.id,day:today,eggs:70});await call('operator','POST','/staff/incidents',{equipment_id:equipment.id,category:'Ruído incomum',description:'Inspeção solicitada',request_id:randomUUID()});
  await call('operator','GET','/data/costs',undefined,403);await call('operator','GET','/admin/tenants',undefined,403);
  const order=await create('work_orders',{title:'Inspeção piloto',equipment_id:equipment.id,assignee:tech.id,due_on:today,checklist:[{label:'Verificar ruído',done:false}]});await call('owner','POST','/orders/'+order.id+'/transition',{status:'assigned'});
  await login('tech','tech@pilot.invalid');await call('tech','POST','/staff/tasks/'+order.id,{status:'in_progress',checklist:[{label:'Verificar ruído',done:false}],report:'',duration_minutes:0});await call('tech','POST','/staff/tasks/'+order.id,{status:'completed',checklist:[{label:'Verificar ruído',done:true}],report:'Verificação concluída',duration_minutes:20});
  await login('viewer','viewer@pilot.invalid');await call('viewer','POST','/data/costs',{name:'Denied'},403);
  const meter=await create('meters',{name:'Medidor piloto',barn_id:barn.id});await create('tariffs',{name:'Tarifa piloto',rate_micros:1000000,starts_on:today,ends_on:today});
  const source=(await call('owner','POST','/integrations',{name:'Energia piloto',resource:'energy_readings',kind:'manual',format:'csv',mapping:{meter_id:'meter_id',day:'day',kwh:'kwh',evidence:'evidence'},interval_minutes:60,active:1})).data;
  const payload={rows:[{meter_id:meter.id,day:today,kwh:10,evidence:'Leitura conferida'}]};await call('owner','POST','/integrations/'+source.id+'/preview',payload);assert.equal(await one(db,'SELECT id FROM energy_readings WHERE tenant_id=?',[a.id]),null);await call('owner','POST','/integrations/'+source.id+'/import',payload);
  const dashboard=(await call('owner','GET','/dashboard?from='+today+'&to='+today)).data;assert.equal(dashboard.performance.eggs,70);assert.equal(dashboard.energy.kwh,10);
  const pdf=(await call('owner','GET','/report.pdf')).data;assert.equal(pdf.subarray(0,5).toString(),'%PDF-');await call('owner','GET','/export/production');
  await call('other','PUT','/data/barns/'+barn.id,{name:'Attack',unit_id:unit.id,capacity:100,birds:1},404);await call('other','GET','/integrations/'+source.id+'/runs',undefined,404);await call('other','POST','/staff/production',{barn_id:barn.id,day:today,eggs:1},403);
  const overview=(await call('ews','GET','/admin/overview')).data;assert.equal(overview.trial,2);assert.equal(overview.mrr_cents,0);assert.notEqual(a.id,b.id);assert.ok(viewer.id);
 }finally{await server.close();await db.close();}
});
