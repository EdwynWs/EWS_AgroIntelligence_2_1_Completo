import { randomBytes, randomUUID } from 'node:crypto';
import { connect, one, insert, update } from '../packages/database/db.ts';
import { migrate } from '../packages/database/migrate.ts';
import { passwordHash,base32,encryptSecret } from '../apps/api/src/security.ts';
import { seedPlans } from './seed.ts';
const email=process.env.ADMIN_EMAIL?.toLowerCase(),password=process.env.ADMIN_PASSWORD;
if(!email||!password)throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
const db=await connect();await migrate(db);await seedPlans(db);
const setupEmail=process.argv[2];
if(setupEmail){
 const u=await one(db,'SELECT id,email FROM users WHERE email=?',[setupEmail.toLowerCase()]);if(!u)throw new Error('Usuário não encontrado.');
 const secret=base32(randomBytes(20));await update(db,'users',{mfa_secret:encryptSecret(secret),mfa_enabled:1,mfa_last_step:-1},'id=?',[u.id]);await db.query('DELETE FROM sessions WHERE user_id=?',[u.id]);console.log('Cadastre esta chave no autenticador e entregue-a ao titular por canal seguro, uma única vez:',secret);
}else{
 if(await one(db,'SELECT id FROM users WHERE email=?',[email]))throw new Error('Administrador já existe. Não alterado.');
 const secret=base32(randomBytes(20));await insert(db,'users',{id:randomUUID(),tenant_id:null,name:'Administrador EWS',email,password_hash:passwordHash(password),role:'EWS',active:1,mfa_secret:encryptSecret(secret),mfa_enabled:1,mfa_last_step:-1,created_at:new Date().toISOString()});console.log('Administrador criado. Cadastre a chave MFA no autenticador, uma única vez:',secret);
}
await db.close();
