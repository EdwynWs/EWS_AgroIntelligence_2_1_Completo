export const ratio=(numerator:number,denominator:number)=>denominator>0?numerator/denominator:null;
export function energyCostCents(kwh:number,rateMicros:number){if(kwh<0||rateMicros<0||!Number.isFinite(kwh)||!Number.isFinite(rateMicros))throw new Error('Valores inválidos');return Math.round(kwh*rateMicros/10000);}
export function isStale(observedAt:string|undefined,seconds:number,now=Date.now()){return !observedAt||now-Date.parse(observedAt)>seconds*1000;}
export function classify(value:number|null,quality:string,observedAt:string|undefined,staleSeconds:number,now=Date.now()){
 if(isStale(observedAt,staleSeconds,now))return 'offline';if(quality!=='GOOD')return 'uncertain';if(value===2)return 'fault';if(value===1)return 'running';if(value===0)return 'stopped';return 'unknown';
}
export function alertDecision(rule:{threshold:number;hysteresis:number;duration_seconds:number;pending_since:string|null;latched:number;silence_until:string|null},value:number,time:string){
 if(rule.silence_until&&Date.parse(rule.silence_until)>Date.parse(time))return {pending:null,latched:rule.latched,trigger:false};
 if(value<=rule.threshold-rule.hysteresis)return {pending:null,latched:0,trigger:false};
 if(rule.latched)return {pending:null,latched:1,trigger:false};
 if(value<rule.threshold)return {pending:null,latched:0,trigger:false};
 const pending=rule.pending_since||time;const trigger=Date.parse(time)-Date.parse(pending)>=rule.duration_seconds*1000;
 return {pending:trigger?null:pending,latched:trigger?1:0,trigger};
}
export function parseCsv(text:string):Record<string,string>[] {
 if(text.length>2_000_000)throw new Error('Arquivo excede 2 MB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quote=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quote)throw new Error('Aspas não encerradas.');row.push(cell);if(row.some(Boolean))rows.push(row);
 const headers=rows.shift();if(!headers||!headers.length||new Set(headers).size!==headers.length)throw new Error('Cabeçalho inválido.');
 if(rows.length>1000)throw new Error('Máximo de 1.000 linhas por importação.');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw new Error(`Linha ${i+2}: número de colunas incorreto.`);return Object.fromEntries(headers.map((h,j)=>[h.trim(),r[j]]));});
}
export function csvCell(v:any){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function toCsv(rows:Record<string,any>[]){if(!rows.length)return '\uFEFF';const keys=Object.keys(rows[0]);return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');}
