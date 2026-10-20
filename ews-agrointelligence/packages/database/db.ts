import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export type Row = Record<string, any>;
export interface Queryable { query(sql: string, params?: any[]): Promise<Row[]>; }
export interface Database extends Queryable { transaction<T>(f:(tx:Queryable)=>Promise<T>):Promise<T>; close():Promise<void>; driver:string; }
export async function connect(options:{driver?:string;path?:string;url?:string}={}):Promise<Database> {
 const driver = options.driver || process.env.DB_DRIVER || 'sqlite';
 if(driver==='postgres') {
  const mod = 'pg'; const {Pool} = await import(mod);
  const pool = new Pool({connectionString:options.url||process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000,statement_timeout:15000});
  function wrap(client:any):Queryable {return {query:async(s,p=[])=>{let n=0;return (await client.query(s.replace(/\?/g,()=>`$${++n}`),p)).rows||[];}};}
  const q=wrap(pool);
  return {driver,...q,transaction:async(f)=>{for(let attempt=0;;attempt++){const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const result=await f(wrap(c));await c.query('COMMIT');return result;}catch(e:any){await c.query('ROLLBACK');if(attempt<2&&['40001','40P01'].includes(e.code))continue;throw e;}finally{c.release();}}},close:async()=>pool.end()};
 }
 if(process.env.NODE_ENV==='production') throw new Error('PostgreSQL é obrigatório em produção.');
 const {DatabaseSync}=await import('node:sqlite');
 const path=options.path||process.env.SQLITE_PATH||'.data/agro.sqlite';
 if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 let tail:Promise<any>=Promise.resolve();
 const locked=<T>(f:()=>Promise<T>):Promise<T>=>{const p=tail.then(f,f);tail=p.catch(()=>{});return p;};
 const direct:Queryable={query:async(s,p=[])=>{const stmt=sqlite.prepare(s);return stmt.columns().length?stmt.all(...p) as Row[]:(stmt.run(...p),[]);}};
 return {driver,query:(s,p)=>locked(()=>direct.query(s,p)),transaction:(f)=>locked(async()=>{sqlite.exec('BEGIN IMMEDIATE');try{const v=await f(direct);sqlite.exec('COMMIT');return v;}catch(e){sqlite.exec('ROLLBACK');throw e;}}),close:async()=>{await tail;sqlite.close();}};
}
export const one = async(db:Queryable,sql:string,params:any[]=[]) => (await db.query(sql,params))[0] || null;
export async function insert(db:Queryable,table:string,data:Row) {const k=Object.keys(data);await db.query(`INSERT INTO ${table} (${k.join(',')}) VALUES (${k.map(()=>'?').join(',')})`,Object.values(data));return data;}
export async function update(db:Queryable,table:string,data:Row,where:string,params:any[]) {const k=Object.keys(data);if(k.length)await db.query(`UPDATE ${table} SET ${k.map(x=>x+'=?').join(',')} WHERE ${where}`,[...Object.values(data),...params]);}
