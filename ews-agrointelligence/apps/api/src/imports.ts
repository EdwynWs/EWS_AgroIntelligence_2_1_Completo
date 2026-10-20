import JSZip from 'jszip';
import xml from 'xml-js';
import {toCsv} from '../../../packages/shared/calculations.ts';
const arr=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
const text=(v:any):string=>v==null?'':typeof v==='object'?String(v._text??''):String(v);
export async function xlsxToCsv(base64:string){
 const bytes=Buffer.from(base64,'base64');if(bytes.length>1500000)throw new Error('XLSX excede 1,5 MB.');
 const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);if(entries.length>100||entries.reduce((s:any,e:any)=>s+(e._data?.uncompressedSize||0),0)>8000000)throw new Error('Planilha descompactada excede o limite.');
 const sheet=zip.file('xl/worksheets/sheet1.xml');if(!sheet)throw new Error('Use uma planilha XLSX com dados na primeira aba.');
 const parse=(s:string)=>JSON.parse(xml.xml2json(s,{compact:true}));
 const sharedFile=zip.file('xl/sharedStrings.xml');const shared=sharedFile?arr(parse(await sharedFile.async('string')).sst?.si).map((s:any)=>s.t?text(s.t):arr(s.r).map(r=>text(r.t)).join('')):[];
 const parsed=parse(await sheet.async('string'));const rows=arr(parsed.worksheet?.sheetData?.row);if(rows.length>1001)throw new Error('Máximo de 1.000 registros.');
 function decode(row:any){if(!row)throw new Error('Planilha vazia.');const out:string[]=[];for(const cell of arr(row.c)){if(cell.f)throw new Error('Fórmulas não são aceitas. Exporte os valores como CSV.');const ref=cell._attributes?.r||'';const letters=ref.match(/^[A-Z]+/)?.[0];if(!letters)throw new Error('Referência de célula inválida.');let index=0;for(const c of letters)index=index*26+c.charCodeAt(0)-64;if(index>100)throw new Error('Máximo de 100 colunas.');const type=cell._attributes?.t;out[index-1]=type==='s'?shared[Number(text(cell.v))]:type==='inlineStr'?text(cell.is?.t):text(cell.v);}return out;}
 const headers=decode(rows.shift());if(!headers.length||Array.from(headers).some(x=>!x)||new Set(headers).size!==headers.length)throw new Error('Cabeçalho inválido.');
 const result=rows.map(row=>{const cells=decode(row);return Object.fromEntries(headers.map((key,i)=>{let value=cells[i]||'';if(/^(day|starts_on|ends_on|due_on)$/.test(key)&&/^\d+(\.\d+)?$/.test(value))value=new Date(Date.UTC(1899,11,30)+Number(value)*86400000).toISOString().slice(0,10);return [key,value];}));});
 return toCsv(result);
}
