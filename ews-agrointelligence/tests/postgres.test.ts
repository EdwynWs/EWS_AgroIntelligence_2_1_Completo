import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {connect,one,insert} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedDemo} from '../scripts/seed.ts';
import {dashboard} from '../apps/api/src/domain.ts';
import {recurringBillingTick} from '../apps/worker/billing.ts';

test('PostgreSQL: populated upgrade, rollback, tenant FK, concurrent recurrence and dashboard',{skip:!process.env.TEST_POSTGRES_URL},async()=>{
 const db=await connect({driver:'postgres',url:process.env.TEST_POSTGRES_URL});try{
  const info=await one(db,'SELECT current_database() AS name,version() AS version');assert.equal(info.name,'agro_verify','Requires disposable agro_verify database');
  // Refuse a populated database rather than resetting a potentially valuable installation.
  const existing=await one(db,"SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='public'");assert.equal(Number(existing.n),0,'Use a fresh empty agro_verify database');
  const initial=readFileSync(new URL('../packages/database/migrations/001_initial.sql',import.meta.url),'utf8');
  await db.transaction(async tx=>{for(const sql of initial.split(';').map(s=>s.trim()).filter(Boolean))await tx.query(sql);});
  const {tenant_id}=await seedDemo(db);const user=await one(db,'SELECT * FROM users WHERE tenant_id=?',[tenant_id]);const count=await one(db,'SELECT COUNT(*) AS n FROM production');
  await insert(db,'sessions',{id:'pg-upgrade-session',user_id:user.id,csrf:'fixture',expires_at:'2099-01-01',created_at:new Date().toISOString()});
  await migrate(db);await migrate(db);assert.equal((await one(db,'SELECT COUNT(*) AS n FROM production')).n,count.n);assert.equal((await one(db,'SELECT password_hash FROM users WHERE id=?',[user.id])).password_hash,user.password_hash);assert.ok(await one(db,"SELECT id FROM sessions WHERE id='pg-upgrade-session'"));
  const other=randomUUID();await insert(db,'tenants',{id:other,name:'Isolation',timezone:'UTC',demo:0,created_at:new Date().toISOString()});const unit=await one(db,'SELECT id FROM units WHERE tenant_id=?',[tenant_id]);
  await assert.rejects(insert(db,'barns',{id:randomUUID(),tenant_id:other,unit_id:unit.id,name:'Forbidden',birds:1,capacity:2,created_at:new Date().toISOString()}));
  const rollback=randomUUID();await assert.rejects(db.transaction(async tx=>{await insert(tx,'units',{id:rollback,tenant_id:other,name:'Rollback',created_at:new Date().toISOString()});throw new Error('rollback');}));assert.equal(await one(db,'SELECT id FROM units WHERE id=?',[rollback]),null);
  await insert(db,'recurring_charges',{id:randomUUID(),tenant_id,description:'PG fixture',amount_cents:100,due_day:10,next_on:'2026-10-10',created_at:new Date().toISOString()});
  await Promise.all([recurringBillingTick(db,new Date('2026-10-20T12:00:00Z')),recurringBillingTick(db,new Date('2026-10-20T12:00:00Z'))]);assert.equal(Number((await one(db,'SELECT COUNT(*) AS n FROM recurring_charge_runs')).n),1);
  const d=await dashboard(db,tenant_id,{});assert.equal(d.barns.length,3);assert.ok(d.performance.eggs>0);
  const explain=await db.query('EXPLAIN SELECT * FROM production WHERE tenant_id=? AND day>=?',[tenant_id,'2026-01-01']);console.log(JSON.stringify({postgres:info.version,upgrade:'001→003',production:Number(count.n),plan:explain}));
 }finally{await db.close();}
});
