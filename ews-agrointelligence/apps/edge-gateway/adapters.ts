export type ReadOnlyTag={id:string;unit:string;minimum:number;maximum:number};
export interface ReadOnlyAdapter { read(tags:ReadOnlyTag[]):Promise<{tag_id:string;value:number;unit:string;quality:'GOOD'|'UNCERTAIN'|'BAD';source:'MEASURED'|'SIMULATED';observed_at:string}[]>; }
export class Simulator implements ReadOnlyAdapter {
 async read(tags:ReadOnlyTag[]){return tags.map(t=>({tag_id:t.id,value:Math.max(t.minimum,Math.min(t.maximum,27+Math.sin(Date.now()/60000)*3)),unit:t.unit,quality:'GOOD' as const,source:'SIMULATED' as const,observed_at:new Date().toISOString()}));}
}
// No writes, network scans, remote commands or unvalidated protocol implementations.
export function omronAdapter():never{throw new Error('Integração Omron indisponível: identifique CPU, firmware e mapa autorizado de tags e valide em bancada.');}
