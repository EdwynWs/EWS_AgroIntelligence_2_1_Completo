import { randomBytes, createHash, scryptSync, timingSafeEqual, createHmac, createCipheriv, createDecipheriv } from 'node:crypto';
export const token=()=>randomBytes(32).toString('hex');
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function passwordHash(s:string){if(s.length<12||s.length>128)throw new Error('Use uma senha de 12 a 128 caracteres.');const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(s,salt,64,{N:32768,maxmem:64*1024*1024}).toString('hex')}`;}
export function passwordCheck(s:string,stored:string){try{const [salt,h]=stored.split(':');const got=scryptSync(s,salt,64,{N:32768,maxmem:64*1024*1024});const expected=Buffer.from(h,'hex');return expected.length===got.length&&timingSafeEqual(expected,got);}catch{return false;}}
export function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes:Buffer){let bits='';for(const b of bytes)bits+=b.toString(2).padStart(8,'0');let out='';for(let i=0;i<bits.length;i+=5)out+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];return out;}
export function decode32(s:string){let bits='';for(const c of s.replace(/=/g,'')){const n=alphabet.indexOf(c);if(n<0)throw new Error('Base32 inválido');bits+=n.toString(2).padStart(5,'0');}return Buffer.from((bits.match(/.{8}/g)||[]).map(x=>parseInt(x,2)));}
export function totp(secret:string,step=Math.floor(Date.now()/30000)){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const mac=createHmac('sha1',decode32(secret)).update(b).digest();const o=mac[19]&15;return String((mac.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
export function verifyTotp(secret:string,code:string,lastStep=-1,now=Date.now()){const current=Math.floor(now/30000);for(const step of [current-1,current,current+1])if(step>lastStep&&safeEqual(totp(secret,step),code))return step;return null;}
function key(){const value=process.env.MFA_ENCRYPTION_KEY;if(!value||!/^[a-fA-F0-9]{64}$/.test(value))throw new Error('MFA_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.');return Buffer.from(value,'hex');}
export function encryptSecret(value:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv,c.getAuthTag(),data].map(x=>x.toString('hex')).join('.');}
export function decryptSecret(value:string){const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'hex'));const d=createDecipheriv('aes-256-gcm',key(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]).toString();}
