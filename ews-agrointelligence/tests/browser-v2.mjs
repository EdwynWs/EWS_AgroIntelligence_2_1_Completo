// Run locally after pnpm dev. This workflow intentionally changes only an isolated demo tenant.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=process.env.E2E_BASE_URL||'http://localhost:3000';
const browser=await chromium.launch();
const manager=await browser.newContext({baseURL:base});
const request=manager.request;
async function post(path,body,csrf,method='POST'){const r=await request.fetch('/api'+path,{method,data:body,headers:{origin:base,...(csrf?{'x-csrf-token':csrf}:{})}});assert.ok(r.ok(),await r.text());return r.json();}
let operator;
try{
 await post('/auth/demo',{});const me=await (await request.get('/api/auth/me')).json();assert.equal(me.tenant.demo,1,'E2E requires demo tenant');
 const password=randomBytes(24).toString('hex'),email='e2e-'+Date.now()+'@example.invalid',csrf=me.csrf;
 const unit=await post('/data/units',{name:'E2E automação',address:'Somente demonstração'},csrf);
 const barn=await post('/data/barns',{name:'E2E galpão '+Date.now(),unit_id:unit.id,capacity:100,birds:80},csrf);
 const equipment=await post('/data/equipment',{name:'Motor E2E',barn_id:barn.id,category:'Motor'},csrf);
 operator=await post('/users',{name:'Operador E2E',email,password,role:'OPERATOR'},csrf);
 await post('/staff/assignments/'+operator.id,{barn_ids:[barn.id],preferred:barn.id},csrf,'PUT');
 const staff=await (await request.get('/api/staff')).json();await post('/population',{barn_id:barn.id,day:staff.today,birds:80},csrf);
 const context=await browser.newContext({baseURL:base});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na plataforma'}).click();await page.waitForURL('**/app/staff');
 for(const width of [360,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.getByLabel('Quantidade de ovos').fill('70');await page.getByRole('button',{name:'Salvar produção'}).click();await page.getByRole('status').filter({hasText:'Produção registrada'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);}
 await page.getByRole('button',{name:'Comunicar problema'}).click();await page.getByLabel('Equipamento',{exact:true}).selectOption(equipment.id);await page.getByLabel('Conte em poucas palavras').fill('Motor com ruído de teste');await page.getByRole('button',{name:'Registrar ocorrência',exact:true}).click();await page.getByRole('status').filter({hasText:'Ocorrência registrada'}).waitFor();
 assert.equal((await context.request.get('/api/data/costs')).status(),403);
 const adminPage=await manager.newPage();for(const width of [360,390,768,1024,1440]){await adminPage.setViewportSize({width,height:900});for(const path of ['team-operations','integrations','report-schedules']){await adminPage.goto('/app/'+path);await adminPage.getByRole('heading',{level:1}).waitFor();assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' overflow '+width);}}
 assert.deepEqual(errors,[]);console.log('V2 employee and management browser checks passed. Reset demo to remove fixtures.');await context.close();
}finally{if(operator){const me=await (await request.get('/api/auth/me')).json();await post('/users/'+operator.id+'/access',{active:0,role:'OPERATOR'},me.csrf).catch(()=>{});}await manager.close();await browser.close();}
