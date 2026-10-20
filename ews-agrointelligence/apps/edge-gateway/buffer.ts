import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export class BufferStore {
 db:DatabaseSync;max:number;
 constructor(path:string,max=100000){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);this.max=max;this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS queue(sequence INTEGER PRIMARY KEY AUTOINCREMENT,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);');}
 push(payload:Record<string,any>){if(this.size()>=this.max)throw new Error('Buffer cheio: coleta interrompida para preservar dados.');const r=this.db.prepare('INSERT INTO queue(payload) VALUES (?)').run(JSON.stringify(payload));return Number(r.lastInsertRowid);}
 batch(limit=100){return this.db.prepare('SELECT sequence,payload FROM queue ORDER BY sequence LIMIT ?').all(limit).map((r:any)=>({...JSON.parse(r.payload),sequence:r.sequence}));}
 ack(sequences:number[]){this.db.exec('BEGIN IMMEDIATE');try{const s=this.db.prepare('DELETE FROM queue WHERE sequence=?');for(const n of sequences)s.run(n);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
 size(){return Number((this.db.prepare('SELECT COUNT(*) AS n FROM queue').get() as any).n);}
 close(){this.db.close();}
}
export async function flush(store:BufferStore,url:string,credential:string,fetcher:typeof fetch=fetch){const rows=store.batch();if(!rows.length)return 0;const response=await fetcher(url+'/api/ingest',{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify({readings:rows}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Ingestão rejeitada: HTTP ${response.status}. Buffer preservado.`);const result:any=await response.json();if(!Number.isSafeInteger(result.accepted)||result.accepted<0||!Number.isSafeInteger(result.duplicates)||result.duplicates<0||result.accepted+result.duplicates!==rows.length)throw new Error('Confirmação incompleta: buffer preservado.');store.ack(rows.map(x=>x.sequence));return rows.length;}

// Drain persisted samples before collecting: a full queue must recover after reconnection.
export async function gatewayCycle(store:BufferStore,url:string,credential:string,read:()=>Promise<Record<string,any>[]>,fetcher:typeof fetch=fetch){
 let sent=0,sendError:unknown;
 try{sent=await flush(store,url,credential,fetcher);}catch(error){sendError=error;}
 const available=store.max-store.size();
 if(available<=0){if(sendError)throw sendError;return {sent,collected:0,buffered:store.size()};}
 const samples=await read();
 if(samples.length>available)throw new Error('Buffer sem espaço para o lote: coleta não persistida.');
 for(const sample of samples)store.push(sample);
 if(sendError)throw sendError;
 const sentNew=await flush(store,url,credential,fetcher);
 return {sent:sent+sentNew,collected:samples.length,buffered:store.size()};
}
