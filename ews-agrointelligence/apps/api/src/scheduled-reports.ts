import {one,insert,update} from '../../../packages/database/db.ts';
import type {Database,Queryable,Row} from '../../../packages/database/db.ts';
import {dashboard,entitlement,uid,now,fail} from './domain.ts';
import {localClock,lease} from './automation-core.ts';
export const escapeHtml=(s:any)=>String(s??'Sem dados').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const num=(value:any,unit='')=>value==null?'Sem dados':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2})+unit;
export async function executiveReport(db:Queryable,s:Row,at=new Date()){
 const ent=await entitlement(db,s.tenant_id);const end=shift(localClock(s.timezone,at).day,-1),length=s.frequency==='weekly'?7:1,start=shift(end,1-length);
 const barns:string[]=JSON.parse(s.barn_ids),indicators:string[]=JSON.parse(s.indicators),scopes=barns.length?barns:[''];
 const sections:string[]=[];const metrics:Row[]=[];const totals:Row[]=[];
 for(const barn of scopes){
  const d:Row=await dashboard(db,s.tenant_id,{from:start,to:end,barn}),previous=await dashboard(db,s.tenant_id,{from:shift(start,-length),to:shift(start,-1),barn});
  const filters=barn?' AND barn_id=?':'',args=barn?[s.tenant_id,start,end,barn]:[s.tenant_id,start,end];
  const production=await db.query('SELECT barn_id,SUM(eggs) AS eggs,SUM(birds) AS birds,COUNT(*) AS days FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filters+' GROUP BY barn_id',args);
  const previousCount=await one(db,'SELECT COUNT(*) AS n FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filters,barn?[s.tenant_id,shift(start,-length),shift(start,-1),barn]:[s.tenant_id,shift(start,-length),shift(start,-1)]);
  const count=production.reduce((n,x)=>n+Number(x.days),0),expected=d.barns.length*length;
  const comparable=expected>0&&count===expected&&Number(previousCount.n)===expected;
  const delta=(a:any,b:any,valid:boolean)=>valid&&a!=null&&b>0?num((a-b)/b*100,'%'):'Comparação indisponível: cobertura/base insuficiente';
  totals.push({eggs:d.performance.eggs,kwh:d.energy.kwh});
  const title=barn?d.barns[0]?.name:'Toda a granja';const rows:any[]=[];
  if(indicators.includes('production')&&ent.modules.includes('performance')){
   rows.push(['Ovos registrados',num(d.performance.eggs)],['Ovos por ave-dia',num(d.performance.per_bird)],['Variação da produção',delta(d.performance.eggs,previous.performance.eggs,comparable)],['Cobertura da produção',`${count}/${expected} registros galpão-dia`]);
   for(const b of d.barns){const p=production.find(x=>x.barn_id===b.id);rows.push([b.name,p?num(p.eggs,' ovos'):'Sem dados']);}
  }
  if(indicators.includes('energy')&&ent.modules.includes('energy')){
   const energies=await db.query('SELECT e.meter_id,e.day FROM energy_readings e JOIN meters m ON m.id=e.meter_id WHERE e.tenant_id=? AND e.day>=? AND e.day<=?'+(barn?' AND m.barn_id=?':''),barn?[s.tenant_id,shift(start,-length),end,barn]:[s.tenant_id,shift(start,-length),end]);
   const meterIds=[...new Set(energies.map(x=>x.meter_id))];const complete=meterIds.length>0&&energies.length===meterIds.length*length*2;
   rows.push(['Consumo registrado',num(d.energy.kwh,' kWh')],['Custo estimado com tarifa',d.energy.cost_cents==null?'Sem dados / tarifa ausente':num(d.energy.cost_cents/100,' R$')],['Variação de energia',delta(d.energy.kwh,previous.energy.kwh,complete)]);
   if(complete&&previous.energy.kwh>0&&d.energy.kwh>previous.energy.kwh*1.2)rows.push(['Atenção','Consumo aumentou mais de 20%. Investigue a causa; não é diagnóstico.']);
   if(barn&&d.energy.kwh==null)rows.push(['Escopo energético','Medição geral não é distribuída entre galpões.']);
  }
  if(indicators.includes('maintenance')){
   const orders=await db.query('SELECT w.status,w.completed_at FROM work_orders w JOIN equipment e ON e.id=w.equipment_id WHERE w.tenant_id=?'+(barn?' AND e.barn_id=?':''),barn?[s.tenant_id,barn]:[s.tenant_id]);
   const faults=await one(db,"SELECT COUNT(DISTINCT i.equipment_id) AS n FROM incidents i JOIN equipment e ON e.id=i.equipment_id WHERE i.tenant_id=? AND i.status<>'closed'"+(barn?' AND e.barn_id=?':''),barn?[s.tenant_id,barn]:[s.tenant_id]);
   rows.push(['Ocorrências abertas agora',d.monitor.active_alerts],['Equipamentos com ocorrências abertas',faults.n]);
   if(ent.modules.includes('predict'))rows.push(['Ordens pendentes agora',orders.filter(o=>o.status!=='completed').length],['Manutenções concluídas no período',orders.filter(o=>o.completed_at&&localClock(s.timezone,new Date(o.completed_at)).day>=start&&localClock(s.timezone,new Date(o.completed_at)).day<=end).length]);
  }
  if(indicators.includes('attention')){rows.push(['Equipamentos sem comunicação agora',d.monitor.offline],['Produção pendente no período',Math.max(0,expected-count)]);const sources=await db.query('SELECT DISTINCT source FROM production WHERE tenant_id=? AND day>=? AND day<=?'+filters,args);rows.push(['Origem da produção',sources.map(x=>x.source).join(', ')||'Sem dados']);const eSources=await db.query('SELECT DISTINCT e.source FROM energy_readings e JOIN meters m ON m.id=e.meter_id WHERE e.tenant_id=? AND e.day>=? AND e.day<=?'+(barn?' AND m.barn_id=?':''),args);rows.push(['Origem da energia',eSources.map(x=>x.source).join(', ')||'Sem dados']);}
  sections.push(`<h2>${escapeHtml(title)}</h2><table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([k,v])=>`<tr><td style="padding:12px 0;border-bottom:1px solid #dde4ee">${escapeHtml(k)}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #dde4ee">${escapeHtml(v)}</td></tr>`).join('')}</table>`);metrics.push({barn,rows});
 }
 if(scopes.length>1){const sum=(key:string)=>totals.some(t=>t[key]==null)?'Sem dados completos':num(totals.reduce((n,t)=>n+Number(t[key]),0));sections.unshift(`<h2>Total dos galpões selecionados</h2>${indicators.includes('production')?`<p>Produção: ${sum('eggs')} ovos</p>`:''}${indicators.includes('energy')?`<p>Energia: ${sum('kwh')} kWh</p>`:''}`);}
 const subject=`${ent.demo?'[DEMONSTRAÇÃO] ':''}EWS AgroIntelligence · ${start} a ${end}`;
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6fb;font:16px Arial;color:#15233b"><main style="max-width:680px;margin:auto;padding:24px;background:#fff"><p style="color:#2563eb;font-weight:bold">EWS TECH / AGROINTELLIGENCE</p><h1 style="font-size:28px">Sua granja em perspectiva</h1><p>${escapeHtml(ent.tenant_name)} · ${start} a ${end}</p>${ent.demo?'<p style="background:#fff2cc;padding:16px">DEMONSTRAÇÃO — TODOS OS DADOS SÃO FICTÍCIOS.</p>':''}${sections.join('')}<p style="font-size:13px;color:#55657b">Período em ${escapeHtml(s.timezone)}. Estados de equipamentos e pendências são atuais. Ausência de dado não significa zero. Variações exigem cobertura comparável. Custos são estimativas; oportunidades exigem investigação. Consulte o sistema para relatório PDF e detalhes.</p></main></body></html>`;
 return {subject,html,start,end,metrics};
}
export async function scheduleReports(db:Database,at=new Date()){
 const schedules=await db.query('SELECT * FROM report_schedules WHERE active=1');
 for(const s of schedules)await lease(db,'schedule:'+s.id,async()=>{
  const clock=localClock(s.timezone,at),weekday=new Date(clock.day+'T12:00:00Z').getUTCDay();
  if(clock.time<s.send_time||s.frequency==='weekly'&&weekday!==s.weekday)return;
  try{await db.transaction(async tx=>{
   const current=await one(tx,'SELECT * FROM report_schedules WHERE id=?',[s.id]);if(!current.active||current.last_slot===clock.day)return;
   const report=await executiveReport(tx,current,at);
   const users=await tx.query("SELECT u.id FROM report_recipients r JOIN users u ON u.id=r.user_id AND u.tenant_id=r.tenant_id WHERE r.schedule_id=? AND r.tenant_id=? AND u.active=1 AND u.role IN ('OWNER','MANAGER') AND u.access_profile=''",[s.id,s.tenant_id]);
   for(const u of users)await tx.query('INSERT INTO report_deliveries(id,tenant_id,schedule_id,user_id,slot,status,subject,html,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(schedule_id,user_id,slot) DO NOTHING',[uid(),s.tenant_id,s.id,u.id,clock.day,'pending',report.subject,report.html,now(),now()]);
   await update(tx,'report_schedules',{last_slot:clock.day},'id=?',[s.id]);
  });}catch{console.error(JSON.stringify({event:'report_schedule_failed',schedule_id:s.id}));}
 });
}
export async function deliverReports(db:Database,sendMail:(message:Row)=>Promise<any>,at=new Date()){
 const queue=await db.query("SELECT id FROM report_deliveries WHERE status='pending' AND next_attempt_at<=? AND attempts<5 ORDER BY created_at LIMIT 20",[at.toISOString()]);
 for(const item of queue)await lease(db,'delivery:'+item.id,async()=>{
  const m=await one(db,'SELECT * FROM report_deliveries WHERE id=?',[item.id]);if(m.status!=='pending')return;
  const u=await one(db,"SELECT u.email FROM users u JOIN report_recipients r ON r.user_id=u.id AND r.tenant_id=u.tenant_id JOIN report_schedules s ON s.id=r.schedule_id AND s.tenant_id=r.tenant_id WHERE u.id=? AND u.tenant_id=? AND r.schedule_id=? AND u.active=1 AND s.active=1 AND u.role IN ('OWNER','MANAGER') AND u.access_profile=''",[m.user_id,m.tenant_id,m.schedule_id]);
  if(!u){await update(db,'report_deliveries',{status:'cancelled',error:'Destinatário ou agendamento não autorizado.'},'id=?',[m.id]);return;}
  try{await entitlement(db,m.tenant_id);await sendMail({to:u.email,subject:m.subject,html:m.html,messageId:`<${m.id}@ews-agro.local>`});await update(db,'report_deliveries',{status:'sent',sent_at:now(),error:null},'id=?',[m.id]);}
  catch{const attempts=Number(m.attempts)+1;await update(db,'report_deliveries',{attempts,status:attempts>=5?'failed':'pending',error:'Falha no envio. Verifique SMTP e assinatura.',next_attempt_at:new Date(at.getTime()+2**attempts*60000).toISOString()},'id=?',[m.id]);}
 });
}
