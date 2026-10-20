import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {connect,insert,one} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {seedDemo} from '../scripts/seed.ts';

test('tenant CLI excludes credentials, requires exact confirmation and preserves other companies',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'agro-portability-')),path=join(dir,'fixture.sqlite');
 const db=await connect({driver:'sqlite',path});
 try{
  await migrate(db);const {tenant_id}=await seedDemo(db),other=randomUUID(),now=new Date().toISOString();
  await insert(db,'tenants',{id:other,name:'Preserve me',timezone:'UTC',demo:0,created_at:now});
  await insert(db,'outbox',{id:randomUUID(),tenant_id,recipient:'test@example.invalid',subject:'reset',body:'SECRET_RESET_TOKEN',next_attempt_at:now,created_at:now});
  const env={...process.env,DB_DRIVER:'sqlite',SQLITE_PATH:path,NODE_ENV:'test'};
  const run=(...args:string[])=>execFileSync(process.execPath,['scripts/tenant-data.ts',...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const dest=join(dir,'export.ndjson');run('export',tenant_id,dest);
  const raw=readFileSync(dest,'utf8'),rows=raw.trim().split('\n').map(x=>JSON.parse(x));
  assert.ok(rows.length>100);assert.equal(statSync(dest).mode&0o777,0o600);
  for(const value of ['password_hash','mfa_secret','token_hash','SECRET_RESET_TOKEN','Preserve me'])assert.ok(!raw.includes(value),value);
  assert.throws(()=>run('export',tenant_id,dest));
  assert.throws(()=>run('delete',tenant_id,other));assert.ok(await one(db,'SELECT id FROM tenants WHERE id=?',[tenant_id]));
  run('delete',tenant_id,tenant_id);
  assert.equal(await one(db,'SELECT id FROM tenants WHERE id=?',[tenant_id]),null);
  assert.ok(await one(db,'SELECT id FROM tenants WHERE id=?',[other]));
  assert.equal(Number((await one(db,'SELECT COUNT(*) AS n FROM measurements')).n),0);
  assert.ok(await one(db,"SELECT id FROM audit_logs WHERE action='tenant_deleted' AND entity_id=?",[tenant_id]));
 }finally{await db.close();rmSync(dir,{recursive:true,force:true});}
});
