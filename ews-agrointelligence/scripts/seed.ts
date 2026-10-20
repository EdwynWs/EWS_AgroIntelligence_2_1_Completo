import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connect, one, insert } from '../packages/database/db.ts';
import type { Queryable } from '../packages/database/db.ts';
import { migrate } from '../packages/database/migrate.ts';
import { token, hash, passwordHash } from '../apps/api/src/security.ts';
const id=()=>randomUUID(),now=()=>new Date().toISOString();
export async function seedPlans(db:Queryable){
 for(const [name,price,modules,eq,users]of [['MONITOR',39900,['monitor'],30,5],['PRO',79900,['monitor','predict','energy'],100,15],['INTELLIGENCE',149900,['monitor','predict','energy','performance'],500,50]] as const){if(!await one(db,'SELECT id FROM plans WHERE name=?',[name]))await insert(db,'plans',{id:id(),name,price_cents:price,modules:JSON.stringify(modules),equipment_limit:eq,user_limit:users,active:1});}
}
export async function seedDemo(db:Queryable,options:{reset?:boolean;tenantId?:string}={}){
 await seedPlans(db);let tenant=options.tenantId||(await one(db,'SELECT id FROM tenants WHERE demo=1 LIMIT 1'))?.id;
 if(tenant&&!options.reset)return {tenant_id:tenant,existing:true};
 if(tenant&&options.reset){const t=await one(db,'SELECT demo FROM tenants WHERE id=?',[tenant]);if(t?.demo!==1)throw new Error('Reset permitido apenas para tenant de demonstração.');
 for(const table of ['staff_requests','recurring_charge_runs','recurring_charges','inspections','report_deliveries','report_recipients','report_schedules','imported_records','import_runs','integration_sources','population_records','user_barns','attachments','operation_logs','outbox','audit_logs','notifications','hourly_metrics','tag_latest','measurements','incidents','alert_rules','maintenance_plans','work_orders','downtimes','tags','gateways','energy_readings','meters','tariffs','invoices','production','costs','opportunities','flocks','equipment','barns','units','tickets'])await db.query(`DELETE FROM ${table} WHERE tenant_id=?`,[tenant]);
 }else{
 tenant=id();await insert(db,'tenants',{id:tenant,name:'Granja Horizonte · Demo',timezone:'America/Sao_Paulo',demo:1,created_at:now()});
 const plan=await one(db,"SELECT id FROM plans WHERE name='INTELLIGENCE'");
 await insert(db,'subscriptions',{id:id(),tenant_id:tenant,plan_id:plan.id,status:'active',trial_until:null,started_at:now(),ended_at:null});
 await insert(db,'users',{id:id(),tenant_id:tenant,name:'Visitante da demonstração',email:'demo@agro.example',password_hash:passwordHash(process.env.DEMO_PASSWORD||token()),role:'OWNER',active:1,mfa_secret:null,mfa_enabled:0,mfa_last_step:-1,created_at:now()});
 }
 const at=now(),base={tenant_id:tenant,created_at:at};const unit=id();await insert(db,'units',{id:unit,...base,name:'Unidade Bastos',address:'Local fictício · Bastos / SP'});
 const gateway=id();await insert(db,'gateways',{id:gateway,...base,name:'Gateway demonstrativo',token_hash:hash(token()),active:1,last_seen:at,last_error:null});
 const first=new Date(Date.now()-29*86400000).toISOString().slice(0,10);const today=at.slice(0,10);
 await insert(db,'tariffs',{id:id(),...base,name:'Tarifa demonstrativa',rate_micros:850000,starts_on:first,ends_on:new Date(Date.now()+365*86400000).toISOString().slice(0,10)});
 let seq=1;const equipmentIds:string[]=[];
 for(let b=0;b<3;b++){
  const barn=id(),meter=id();await insert(db,'barns',{id:barn,...base,unit_id:unit,name:`Galpão ${String(b+1).padStart(2,'0')}`,capacity:25000,birds:22000+b*750});
  await insert(db,'flocks',{id:id(),...base,barn_id:barn,name:`Lote HZ-${b+1} / postura`,birds:22000+b*750,starts_on:new Date(Date.now()-180*86400000).toISOString().slice(0,10),ends_on:null});
  await insert(db,'meters',{id:meter,...base,barn_id:barn,name:`Medidor ${b+1} · fictício`,serial:`DEMO-${b+1}`});
  let tempTag='';
  for(let e=0;e<6;e++){
   const equipment=id();equipmentIds.push(equipment);const category=e<3?'Ventilação':e===3?'Esteira':e===4?'Motor':'Sensor';
   await insert(db,'equipment',{id:equipment,...base,barn_id:barn,name:`${category} ${b+1}.${e+1}`,category,model:e===5?'Sensor fictício':'Modelo não informado',reference_hours:8000,schedule_hours:24,notes:'Demonstração: nenhuma conexão com equipamento real.'});
   const types=e===5?[['temperature','C']]:[['state','estado'],['hours','h']];
   for(const [kind,unitName]of types){const tag=id();if(kind==='temperature')tempTag=tag;await insert(db,'tags',{id:tag,...base,equipment_id:equipment,gateway_id:gateway,name:`${category} ${b+1}.${e+1} / ${kind}`,unit:unitName,kind,minimum:kind==='temperature'?-10:0,maximum:kind==='state'?2:1000000,stale_seconds:120});
    const value=kind==='temperature'?27.2+b*.8:kind==='hours'?3200+b*500+e*120:(b===1&&e===3?2:b===2&&e===4?0:1);
    const seen=b===2&&e===2?new Date(Date.now()-600000).toISOString():at;
    await insert(db,'measurements',{id:id(),tenant_id:tenant,gateway_id:gateway,tag_id:tag,sequence:seq++,value,unit:unitName,quality:'GOOD',source:'SIMULATED',observed_at:seen,received_at:at});
    await insert(db,'tag_latest',{tag_id:tag,tenant_id:tenant,value,quality:'GOOD',source:'SIMULATED',observed_at:seen});
   }
  }
  for(let d=0;d<30;d++){
   const day=new Date(Date.now()-(29-d)*86400000).toISOString().slice(0,10);const eggs=Math.round((19400+b*600)*(1+Math.sin(d*.6+b)*.025));const kwh=Math.round(490+b*32+Math.sin(d*.7+b)*44);
   await insert(db,'production',{id:id(),...base,barn_id:barn,day,eggs,birds:22000+b*750,source:'SIMULATED'});
   await insert(db,'energy_readings',{id:id(),...base,meter_id:meter,day,kwh,demand_kw:30+b*2,source:'SIMULATED',evidence:'Série sintética diária · nenhum consumo real'});
   const value=27+b*.5+Math.sin(d*.5)*1.8;
   await insert(db,'hourly_metrics',{tenant_id:tenant,tag_id:tempTag,hour:day+'T12:00:00.000Z',source:'SIMULATED',quality:'GOOD',count:60,sum:value*60,minimum:value-.6,maximum:value+.6});
  }
  await insert(db,'costs',{id:id(),...base,barn_id:barn,name:'Custo operacional demonstrativo',day:today,category:'Ração',amount_cents:2850000+b*120000,source:'SIMULATED'});
 }
 await insert(db,'incidents',{id:id(),...base,equipment_id:equipmentIds[9],rule_id:null,title:'Interrupção da esteira de coleta',severity:'critical',status:'open',assignee:'Equipe de manutenção',action:'Inspeção agendada; cenário fictício.',source:'SIMULATED',opened_at:at,closed_at:null});
 await insert(db,'incidents',{id:id(),...base,equipment_id:equipmentIds[2],rule_id:null,title:'Inspeção preventiva do ventilador',severity:'warning',status:'acknowledged',assignee:'Técnico demonstrativo',action:'Aguardando inspeção.',source:'SIMULATED',opened_at:new Date(Date.now()-86400000).toISOString(),closed_at:null});
 for(let w=0;w<4;w++)await insert(db,'work_orders',{id:id(),...base,equipment_id:equipmentIds[w*3],title:['Inspecionar rolamentos','Revisar correia da esteira','Limpar ventilação','Inspeção elétrica'][w],assignee:'Equipe técnica',priority:w===1?'high':'normal',status:w===3?'completed':w===0?'in_progress':'open',due_on:new Date(Date.now()+(w-1)*86400000).toISOString().slice(0,10),checklist:JSON.stringify([{label:'Verificar integridade',done:w===3},{label:'Registrar inspeção',done:w===3}]),report:w===3?'Inspeção demonstrativa concluída.':'',parts_cents:w===3?48000:0,labor_cents:w===3?22000:0,duration_minutes:w===3?90:0,completed_at:w===3?at:null});
 await insert(db,'maintenance_plans',{id:id(),...base,equipment_id:equipmentIds[0],name:'Inspeção a cada 1.000 horas',every_hours:1000,next_hours:4000,checklist:'[{"label":"Inspecionar rolamentos","done":false}]'});
 await insert(db,'opportunities',{id:id(),...base,name:'Investigar consumo fora do perfil de referência',category:'alert',amount_cents:0,baseline_start:null,baseline_end:null,comparison_start:null,comparison_end:null,methodology:'Comparação ilustrativa; requer avaliação de clima, manejo e produção.',evidence:'Dados simulados',adjustments:'Nenhuma economia comprovada.'});
 await insert(db,'notifications',{id:id(),...base,title:'Bem-vindo à demonstração',body:'Todos os registros deste ambiente são fictícios. Explore os quatro módulos.',read_at:null});
 await insert(db,'tickets',{id:id(),...base,title:'Como iniciar um piloto?',body:'Identificar CPU, mapa de tags e responsável técnico.',status:'open',reply:''});
 return {tenant_id:tenant,gateway_id:gateway,existing:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=await connect();await migrate(db);const result=await db.transaction(tx=>seedDemo(tx));console.log('Demonstração preparada.',result);await db.close();}
