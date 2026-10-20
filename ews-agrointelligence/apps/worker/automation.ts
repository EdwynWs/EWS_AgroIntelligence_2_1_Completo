import {one,insert,update} from '../../packages/database/db.ts';
import type {Database,Row} from '../../packages/database/db.ts';
import {uid,now} from '../api/src/domain.ts';
import {lease,runImport} from '../api/src/automation-core.ts';
import {fetchSource} from '../api/src/safe-source.ts';
import {decryptSecret} from '../api/src/security.ts';
import {scheduleReports,deliverReports} from '../api/src/scheduled-reports.ts';
export async function automationTick(db:Database,options:{at?:Date;fetch?:(url:string,secret:string)=>Promise<Buffer>;sendMail?:(message:Row)=>Promise<any>}={}){
 const at=options.at||new Date();
 const sources=await db.query("SELECT id FROM integration_sources WHERE active=1 AND kind='https' AND next_run_at<=? ORDER BY next_run_at LIMIT 10",[at.toISOString()]);
 for(const {id}of sources)await lease(db,'fetch:'+id,async()=>{
  const s=await one(db,'SELECT * FROM integration_sources WHERE id=?',[id]);if(!s?.active||s.kind!=='https'||s.next_run_at>at.toISOString())return;
  try{const bytes=await (options.fetch||fetchSource)(s.endpoint,s.secret?decryptSecret(s.secret):'');await runImport(db,s,{content:s.format==='xlsx'?bytes.toString('base64'):bytes.toString('utf8')});}
  catch{await update(db,'integration_sources',{last_run_at:now(),last_status:'failed'},'id=?',[s.id]);await insert(db,'import_runs',{id:uid(),tenant_id:s.tenant_id,source_id:s.id,fingerprint:'fetch',status:'failed',error:'Sincronização falhou. Verifique host autorizado, credencial, conectividade e arquivo.',started_at:now(),finished_at:now()});}
  finally{await update(db,'integration_sources',{next_run_at:new Date(at.getTime()+s.interval_minutes*60000).toISOString()},'id=?',[s.id]);}
 });
 await scheduleReports(db,at);
 if(options.sendMail)await deliverReports(db,options.sendMail,at);
 await db.query("UPDATE import_runs SET payload=NULL WHERE started_at<? AND payload IS NOT NULL",[new Date(at.getTime()-7*86400000).toISOString()]);
 await db.query("UPDATE import_runs SET status='failed',error='Execução interrompida. Reprocesse o arquivo.',finished_at=? WHERE status='running' AND started_at<?",[now(),new Date(at.getTime()-15*60000).toISOString()]);
 await db.query("UPDATE report_deliveries SET html='' WHERE status IN ('sent','cancelled') AND created_at<?",[new Date(at.getTime()-30*86400000).toISOString()]);
}
