import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import JSZip from 'jszip';
import {connect,insert,one,update} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedDemo} from '../scripts/seed.ts';
import {createApp} from '../apps/api/src/app.ts';
import {period,dashboard,saveResource,entitlement} from '../apps/api/src/domain.ts';
import {hash} from '../apps/api/src/security.ts';
import {xlsxToCsv} from '../apps/api/src/imports.ts';
import {BufferStore,flush,gatewayCycle} from '../apps/edge-gateway/buffer.ts';

async function fixture(){
 const db=await connect({driver:'sqlite',path:':memory:'});await migrate(db);const demo=await seedDemo(db);
 const user=await one(db,'SELECT * FROM users WHERE tenant_id=?',[demo.tenant_id]);const raw=randomBytes(32).toString('hex');
 await insert(db,'sessions',{id:hash(raw),user_id:user.id,csrf:'test-csrf',created_at:new Date().toISOString(),expires_at:'2099-01-01'});
 const app=createApp(db);const request=(method:string,url:string,body?:any)=>app.dispatch({method,url,body,ip:randomUUID(),headers:{origin:'http://localhost:3000',cookie:'agro_session='+raw,'x-csrf-token':'test-csrf'}});
 return {db,user,tenant:demo.tenant_id,request,app,raw};
}
test('gateway recovers full persistent queue and continues collecting while offline',async()=>{
 const store=new BufferStore(':memory:',2);let reads=0;const read=async()=>[{value:++reads}];
 const unavailable=async()=>new Response('',{status:503});
 try{
 await assert.rejects(gatewayCycle(store,'https://example.invalid','test',read,unavailable));
 await assert.rejects(gatewayCycle(store,'https://example.invalid','test',read,unavailable));assert.equal(store.size(),2);
 await assert.rejects(gatewayCycle(store,'https://example.invalid','test',read,unavailable));assert.equal(reads,2);
 const result=await gatewayCycle(store,'https://example.invalid','test',read,async(_url,opts)=>Response.json({accepted:JSON.parse(opts!.body as string).readings.length,duplicates:0}));
 assert.equal(result.sent,3);assert.equal(store.size(),0);assert.equal(reads,3);
 }finally{store.close();}
});
test('gateway rejects dishonest acknowledgement counts without deleting buffered data',async()=>{
 const store=new BufferStore(':memory:');store.push({value:1});try{for(const reply of [{accepted:-1,duplicates:2},{accepted:0.5,duplicates:0.5},{accepted:'1',duplicates:0}]){await assert.rejects(flush(store,'https://example.invalid','test',async()=>Response.json(reply)));assert.equal(store.size(),1);}}finally{store.close();}
});
test('dashboard period rejects rollover dates',()=>{assert.throws(()=>period({from:'2026-02-30',to:'2026-03-02'}));assert.doesNotThrow(()=>period({from:'2024-02-29',to:'2024-02-29'}));});
test('maintenance aggregates include orders beyond the 100 visible cards',async()=>{
 const f=await fixture();try{const eq=await one(f.db,'SELECT id FROM equipment WHERE tenant_id=? LIMIT 1',[f.tenant]);await f.db.query('DELETE FROM work_orders WHERE tenant_id=?',[f.tenant]);
 for(let i=0;i<120;i++)await insert(f.db,'work_orders',{id:randomUUID(),tenant_id:f.tenant,equipment_id:eq.id,title:'Service '+i,priority:'normal',due_on:'2020-01-01',status:'completed',parts_cents:100,labor_cents:50,completed_at:'2026-10-01T12:00:00.000Z',created_at:'2026-10-01T12:00:00.000Z'});
 const d=await dashboard(f.db,f.tenant,{from:'2026-10-01',to:'2026-10-01'});assert.equal(d.predict.orders.length,100);assert.equal(d.predict.total,120);assert.equal(d.predict.cost_cents,18000);
 }finally{await f.db.close();}
});
test('suspended tenant cannot modify settings or assignments',async()=>{const f=await fixture();try{await update(f.db,'subscriptions',{status:'suspended'},'tenant_id=?',[f.tenant]);assert.equal((await f.request('PUT','/api/settings',{name:'Blocked',timezone:'UTC'})).status,403);assert.equal((await f.request('PUT','/api/staff/assignments/'+f.user.id,{barn_ids:[],preferred:null})).status,403);assert.equal((await f.request('GET','/api/auth/me')).status,200);}finally{await f.db.close();}});
test('password recovery cannot reactivate disabled account',async()=>{const f=await fixture();try{const raw=randomBytes(32).toString('hex');await insert(f.db,'auth_tokens',{id:hash(raw),user_id:f.user.id,kind:'reset',expires_at:'2099-01-01',used_at:null});await update(f.db,'users',{active:0},'id=?',[f.user.id]);const r=await f.request('POST','/api/auth/reset',{token:raw,password:randomBytes(20).toString('hex')});assert.equal(r.status,400);assert.equal((await one(f.db,'SELECT active FROM users WHERE id=?',[f.user.id])).active,0);}finally{await f.db.close();}});
test('meter scope with history is immutable',async()=>{const f=await fixture();try{const meter=await one(f.db,'SELECT * FROM meters WHERE tenant_id=? LIMIT 1',[f.tenant]);const ent=await entitlement(f.db,f.tenant);await assert.rejects(f.db.transaction(tx=>saveResource(tx,f.user,f.tenant,ent,'meters',{name:meter.name,barn_id:null,serial:meter.serial},meter.id)),/histórico/);}finally{await f.db.close();}});
test('empty and sparse XLSX headers are rejected as input errors',async()=>{for(const sheet of ['<worksheet><sheetData/></worksheet>','<worksheet><sheetData><row><c r="B1" t="inlineStr"><is><t>day</t></is></c></row></sheetData></worksheet>']){const zip=new JSZip();zip.file('xl/worksheets/sheet1.xml',sheet);await assert.rejects(xlsxToCsv(await zip.generateAsync({type:'base64'})),/vazia|Cabeçalho/);}});

test('staff incidents are idempotent across retries and reject changed payload',async()=>{const f=await fixture();try{const eq=await one(f.db,'SELECT id FROM equipment WHERE tenant_id=? LIMIT 1',[f.tenant]);const body={equipment_id:eq.id,category:'Ruído incomum',description:'Ruído de teste',request_id:randomUUID()};const a=await f.request('POST','/api/staff/incidents',body);const b=await f.request('POST','/api/staff/incidents',body);assert.equal(a.status,200);assert.equal(b.body.id,a.body.id);assert.equal((await f.request('POST','/api/staff/incidents',{...body,description:'Outro ruído'})).status,409);}finally{await f.db.close();}});
test('calendar and cycles preventive rules are idempotent and reject stale counters',async()=>{
 const {preventiveTick}=await import('../apps/worker/preventive.ts');const f=await fixture();try{
 const eq=await one(f.db,'SELECT id FROM equipment WHERE tenant_id=? LIMIT 1',[f.tenant]);const ent=await entitlement(f.db,f.tenant);const day=period({}).end;
 await f.db.query('DELETE FROM maintenance_plans WHERE tenant_id=?',[f.tenant]);
 await saveResource(f.db,f.user,f.tenant,ent,'maintenance_plans',{name:'Inspeção semanal',equipment_id:eq.id,basis:'calendar',every_days:7,next_on:day});
 assert.equal((await preventiveTick(f.db)).generated,1);assert.equal((await preventiveTick(f.db)).generated,0);
 const gateway=await one(f.db,'SELECT id FROM gateways WHERE tenant_id=? LIMIT 1',[f.tenant]);
 const tag=await saveResource(f.db,f.user,f.tenant,ent,'tags',{name:'Ciclos',equipment_id:eq.id,gateway_id:gateway.id,kind:'cycles',unit:'ciclos',minimum:0,maximum:10000,stale_seconds:10});
 await insert(f.db,'tag_latest',{tag_id:tag.id,tenant_id:f.tenant,value:500,quality:'GOOD',source:'SIMULATED',observed_at:'2020-01-01T00:00:00Z'});
 await saveResource(f.db,f.user,f.tenant,ent,'maintenance_plans',{name:'Revisão por ciclos',equipment_id:eq.id,basis:'cycles',every_cycles:100,next_cycles:400});
 assert.equal((await preventiveTick(f.db)).generated,0);await update(f.db,'tag_latest',{observed_at:new Date().toISOString()},'tag_id=?',[tag.id]);assert.equal((await preventiveTick(f.db)).generated,1);assert.equal((await preventiveTick(f.db)).generated,0);
 await update(f.db,'subscriptions',{status:'suspended'},'tenant_id=?',[f.tenant]);assert.equal((await preventiveTick(f.db)).generated,0);
 }finally{await f.db.close();}
});
test('monthly receivables preserve paid charges and stop for suspended subscriptions',async()=>{
 const {recurringBillingTick}=await import('../apps/worker/billing.ts');const f=await fixture();try{const id=randomUUID();await insert(f.db,'recurring_charges',{id,tenant_id:f.tenant,description:'Mensalidade de teste',amount_cents:39900,due_day:10,next_on:'2026-10-10',active:1,created_at:new Date().toISOString()});
 await Promise.all([recurringBillingTick(f.db,new Date('2026-10-20T12:00:00Z')),recurringBillingTick(f.db,new Date('2026-10-20T12:00:00Z'))]);
 const charges=await f.db.query('SELECT * FROM charges WHERE tenant_id=?',[f.tenant]);assert.equal(charges.length,1);assert.equal(charges[0].status,'pending');
 await update(f.db,'charges',{status:'paid'},'id=?',[charges[0].id]);await recurringBillingTick(f.db,new Date('2026-11-20T12:00:00Z'));assert.equal(Number((await one(f.db,'SELECT COUNT(*) AS n FROM charges WHERE tenant_id=?',[f.tenant])).n),2);assert.equal((await one(f.db,'SELECT status FROM charges WHERE id=?',[charges[0].id])).status,'paid');
 await update(f.db,'subscriptions',{status:'suspended'},'tenant_id=?',[f.tenant]);await recurringBillingTick(f.db,new Date('2026-12-20T12:00:00Z'));assert.equal(Number((await one(f.db,'SELECT COUNT(*) AS n FROM charges WHERE tenant_id=?',[f.tenant])).n),2);
 assert.equal((await f.request('GET','/api/admin/operations')).status,403);
 }finally{await f.db.close();}
});

test('session reads do not exhaust the credential throttle',async()=>{const f=await fixture();try{for(let i=0;i<35;i++){const r=await f.app.dispatch({method:'GET',url:'/api/auth/me',headers:{cookie:'agro_session='+f.raw},ip:'one-shared-network'});assert.equal(r.status,200);}for(let i=0;i<31;i++){const r=await f.app.dispatch({method:'POST',url:'/api/auth/login',body:{},headers:{origin:'http://localhost:3000'},ip:'one-shared-network'});assert.equal(r.status,i===30?429:400);}}finally{await f.db.close();}});
