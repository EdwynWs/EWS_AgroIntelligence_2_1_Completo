import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.E2E_URL||'http://localhost:3000';
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const width of [360,390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))errors.push(r.status()+' '+r.url());});
  await page.goto(base);await page.getByRole('heading',{name:/Cada dado conta/}).waitFor();
  async function noOverflow(){const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.page<=size.viewport+1,`Overflow at ${width}: ${size.page}`);}
  await noOverflow();await page.goto(base+'/login');await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();await page.waitForURL('**/app');await page.getByText('Mais clareza para').waitFor();await noOverflow();
  for(const route of ['monitor','predict','energy','performance','barns','equipment','incidents','work_orders','energy_readings','production','reports','gateways','catalog','notifications','profile','settings','tickets']){await page.goto(base+'/app/'+route);await page.locator('main h1').waitFor();await page.waitForLoadState('networkidle');await noOverflow();}
  await page.goto(base+'/app/units');await page.getByRole('button',{name:'Novo registro',exact:true}).click();await page.getByLabel('Nome',{exact:false}).fill('Unidade teste '+width);await page.getByRole('button',{name:'Salvar registro',exact:true}).click();await page.getByRole('status').filter({hasText:'Registro salvo com sucesso.'}).waitFor();await page.getByRole('textbox',{name:'Pesquisar registros'}).fill('Unidade teste '+width);await page.getByRole('cell',{name:'Unidade teste '+width,exact:true}).waitFor();
  await page.getByRole('button',{name:'Modo escuro'}).click();await noOverflow();
  assert.deepEqual(errors,[],`Browser errors at ${width}`);results.push({width,status:'passed',routes:20,crud:'create and search',overflow:false,console_errors:0});await context.close();
 }
 mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/browser.json',JSON.stringify({timestamp:new Date().toISOString(),results},null,2));console.log(results);
}finally{await browser.close();}
