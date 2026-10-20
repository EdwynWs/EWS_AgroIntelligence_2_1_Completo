export type Row=Record<string,any>;
let csrf='';let timezone='America/Sao_Paulo';
export function setTimezone(value:string){timezone=value;}
export function localDay(offset=0){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=(k:string)=>parts.find(p=>p.type===k)!.value;const today=get('year')+'-'+get('month')+'-'+get('day');return new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);}
export const dateTime=(v:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(v));
export const time=(v:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,timeStyle:'short'}).format(new Date(v));
export function setCsrf(value:string){csrf=value;}
export function tenantId(){return typeof window!=='undefined'?sessionStorage.getItem('ews-tenant')||'':'';}
export async function api(path:string,options:RequestInit={}){
 const headers:Record<string,string>={'content-type':'application/json','x-csrf-token':csrf};const tenant=tenantId();if(tenant)headers['x-tenant-id']=tenant;
 const res=await fetch('/api'+path,{...options,headers:{...headers,...options.headers},credentials:'same-origin',cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Resposta inválida. Tente novamente.'}));if(!res.ok){const e:any=new Error(data.error||'Falha na requisição.');e.status=res.status;throw e;}return data;
}
export const send=(path:string,body:any={},method='POST')=>api(path,{method,body:JSON.stringify(body)});
export const br=(n:any,d=0)=>n==null?'—':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d});
export const money=(n:any)=>n==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)/100);
export const date=(v:any)=>v?new Date(String(v).length===10?v+'T12:00:00':v).toLocaleDateString('pt-BR'):'—';
export const labels:Record<string,string>={running:'Operacional',stopped:'Parado',fault:'Falha',offline:'Sem comunicação',unknown:'Sem estado medido',uncertain:'Qualidade incerta',open:'Aberta',acknowledged:'Reconhecida',closed:'Encerrada',assigned:'Atribuída',in_progress:'Em execução',completed:'Concluída',info:'Informação',warning:'Atenção',critical:'Crítica',normal:'Normal',high:'Alta',low:'Baixa',MANUAL:'Informado',MEASURED:'Medido',IMPORTED:'Importado',SIMULATED:'Simulado',alert:'Alerta identificado',estimated:'Oportunidade estimada',verified:'Ganho verificado',active:'Ativo',trial:'Em teste',suspended:'Suspenso',cancelled:'Cancelado',pending:'Pendente',paid:'Recebido',void:'Cancelado',OPERATOR:'Operador',OWNER:'Administrador',MANAGER:'Gestor',TECH:'Técnico',VIEWER:'Visualizador',EWS:'EWS Tech',new:'Novo',contacted:'Contatado',qualified:'Qualificado',temperature:'Temperatura',state:'Estado',hours:'Horas',cycles:'Ciclos',kwh:'Energia',humidity:'Umidade',power:'Potência'};
export async function download(path:string,filename:string){const res=await fetch('/api'+path,{headers:{'x-tenant-id':tenantId()}});if(!res.ok){const d=await res.json();throw new Error(d.error);}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function openReport(query=''){const res=await fetch('/api/report.pdf'+query,{headers:{'x-tenant-id':tenantId()}});if(!res.ok){const d=await res.json();throw new Error(d.error);}const blob=await res.blob();const url=URL.createObjectURL(blob);const win=window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);return win;}

export async function fileBase64(file:File){if(file.size>1500000)throw new Error('Arquivo excede 1,5 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
