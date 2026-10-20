import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connect,one,insert} from '../packages/database/db.ts';
import {migrate} from '../packages/database/migrate.ts';
import {fastifyTransport} from '../apps/api/src/fastify-transport.ts';
import {seedDemo} from '../scripts/seed.ts';

test('002 upgrades populated 001 without rewriting users, sessions or production',async()=>{
 const db=await connect({driver:'sqlite',path:':memory:'});try{
 const initial=readFileSync(new URL('../packages/database/migrations/001_initial.sql',import.meta.url),'utf8');
 for(const sql of initial.split(';').map(s=>s.trim()).filter(Boolean))await db.query(sql);
 await insert(db,'schema_migrations',{version:'001',applied_at:new Date().toISOString()});
 await seedDemo(db);const user=await one(db,'SELECT id,password_hash FROM users LIMIT 1');await insert(db,'sessions',{id:'fixture-session',user_id:user.id,csrf:'fixture',expires_at:'2099-01-01',created_at:'2026-01-01'});
 const count=await one(db,'SELECT COUNT(*) AS n FROM production');await migrate(db);await migrate(db);
 assert.equal((await one(db,'SELECT COUNT(*) AS n FROM production')).n,count.n);assert.equal((await one(db,'SELECT password_hash FROM users WHERE id=?',[user.id])).password_hash,user.password_hash);assert.equal((await one(db,"SELECT id FROM sessions WHERE id='fixture-session'")).id,'fixture-session');assert.equal(Number((await one(db,'SELECT COUNT(*) AS n FROM schema_migrations')).n),3);
 }finally{await db.close();}
});
test('Fastify real HTTP serves demo, enforces CSRF, restricts staff and returns binary PDF',async()=>{
 process.env.ENABLE_DEMO='true';process.env.APP_ORIGIN='http://localhost:3000';const db=await connect({driver:'sqlite',path:':memory:'});await migrate(db);await seedDemo(db);const server=await fastifyTransport(db);try{
 const base=await server.listen({host:'127.0.0.1',port:0});assert.equal((await fetch(base+'/api/health')).status,200);
 const login=await fetch(base+'/api/auth/demo',{method:'POST',headers:{origin:'http://localhost:3000'}});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const me=await fetch(base+'/api/auth/me',{headers:{cookie}});assert.equal(me.status,200);
 const invalid=await fetch(base+'/api/staff/production',{method:'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json'},body:'{}'});assert.equal(invalid.status,403);
 const pdf=await fetch(base+'/api/report.pdf',{headers:{cookie}});assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 const unauth=await fetch(base+'/api/staff');assert.equal(unauth.status,401);
 }finally{await server.close();await db.close();}
});
