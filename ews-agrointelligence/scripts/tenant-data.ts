import {connect,one} from '../packages/database/db.ts';
import {createWriteStream} from 'node:fs';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
const [action,tenantId,target]=process.argv.slice(2);
if(!['export','delete'].includes(action)||!tenantId)throw new Error('Uso: node --env-file=.env scripts/tenant-data.ts export TENANT_UUID arquivo.ndjson | delete TENANT_UUID CONFIRMAR_UUID');
const db=await connect();const tenant=await one(db,'SELECT * FROM tenants WHERE id=?',[tenantId]);if(!tenant)throw new Error('Empresa não encontrada.');
const tables=['staff_requests','recurring_charge_runs','recurring_charges','inspections','report_deliveries','report_recipients','report_schedules','imported_records','import_runs','integration_sources','population_records','user_barns','attachments','operation_logs','hourly_metrics','tag_latest','measurements','incidents','alert_rules','maintenance_plans','work_orders','downtimes','tags','gateways','energy_readings','meters','tariffs','invoices','production','costs','opportunities','flocks','equipment','barns','units','tickets','notifications','outbox','audit_logs','charges','subscription_history','subscriptions','users'];
if(action==='export'){
 if(!target)throw new Error('Informe destino local protegido.');const file=createWriteStream(target,{flags:'wx',mode:0o600});
 async function line(value:any){if(!file.write(JSON.stringify(value)+'\n'))await once(file,'drain');}
 await line({table:'tenants',data:tenant});
 for(const table of tables.filter(name=>!['outbox','report_deliveries','import_runs'].includes(name))){const order=table==='recurring_charge_runs'?'schedule_id,slot':table==='user_barns'?'user_id,barn_id':table==='report_recipients'?'schedule_id,user_id':table==='tag_latest'?'tag_id':table==='hourly_metrics'?'tag_id,hour,source,quality':'id';let offset=0;while(true){const rows=await db.query(`SELECT * FROM ${table} WHERE tenant_id=? ORDER BY ${order} LIMIT ? OFFSET ?`,[tenantId,500,offset]);if(!rows.length)break;for(const row of rows){for(const key of ['secret','password_hash','mfa_secret','token_hash','mfa_last_step'])delete row[key];await line({table,data:row});}offset+=rows.length;}}
 file.end();await once(file,'finish');console.log('Exportação concluída. Proteja o arquivo e entregue somente ao solicitante autorizado.');
}else{
 if(target!==tenantId)throw new Error('Confirme repetindo o UUID exato como terceiro argumento. Faça backup e valide retenções antes.');
 await db.transaction(async tx=>{
  await tx.query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id=?)',[tenantId]);
  await tx.query('DELETE FROM auth_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id=?)',[tenantId]);
  for(const table of tables)await tx.query(`DELETE FROM ${table} WHERE tenant_id=?`,[tenantId]);
  await tx.query('DELETE FROM tenants WHERE id=?',[tenantId]);
  await tx.query('INSERT INTO audit_logs(id,tenant_id,user_id,action,entity,entity_id,details,created_at) VALUES (?,NULL,NULL,?,?,?,?,?)',[randomUUID(),'tenant_deleted','tenants',tenantId,'{"method":"authorized_local_cli"}',new Date().toISOString()]);
 });console.log('Empresa excluída. Backups existentes seguem a política de retenção definida.');
}
await db.close();
