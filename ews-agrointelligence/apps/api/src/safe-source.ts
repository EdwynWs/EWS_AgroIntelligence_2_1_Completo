import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
import {fail} from './domain.ts';
export function allowedEndpoint(value:string){
 let url:URL;try{url=new URL(value);}catch{fail(400,'URL HTTPS inválida.');}
 const allowed=(process.env.IMPORT_ALLOWED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(url!.protocol!=='https:'||url!.username||url!.password||url!.hash||url!.search||url!.port&&url!.port!=='443'||isIP(url!.hostname)||!allowed.includes(url!.hostname.toLowerCase()))fail(400,'Use HTTPS, sem credenciais/query na URL, em um host liberado pelo administrador da infraestrutura.');
 return url!;
}
export function publicIPv4(ip:string){
 if(isIP(ip)!==4)return false;const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===0||a===192&&b===88&&c===99||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
}
export async function fetchSource(endpoint:string,bearer:string){
 const url=allowedEndpoint(endpoint);const addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))fail(400,'DNS precisa resolver exclusivamente endereços IPv4 públicos.');
 // Pin the validated address while preserving hostname verification and TLS SNI.
 return new Promise<Buffer>((resolve,reject)=>{
 const req=request(url,{method:'GET',headers:{Accept:'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',...(bearer?{Authorization:'Bearer '+bearer}:{})},lookup:(_host,_options,cb:any)=>cb(null,addresses[0].address,4)},res=>{
  if(res.statusCode!==200){res.resume();reject(new Error('Endpoint não retornou HTTP 200. Redirecionamentos não são aceitos.'));return;}
  let size=0;const parts:Buffer[]=[];res.on('data',chunk=>{size+=chunk.length;if(size>1500000){req.destroy(new Error('Arquivo excede 1,5 MB.'));return;}parts.push(chunk);});res.on('end',()=>resolve(Buffer.concat(parts)));res.on('error',reject);
 });const timer=setTimeout(()=>req.destroy(new Error('Tempo de download excedido.')),15000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
}
