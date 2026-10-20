import { BufferStore,gatewayCycle } from './buffer.ts';
import { Simulator } from './adapters.ts';
const url=process.env.EDGE_API_URL||'',credential=process.env.EDGE_TOKEN||'',tag=process.env.EDGE_TAG_ID||'';
const endpoint=new URL(url);
if(endpoint.protocol!=='https:'&&!(process.env.EDGE_ALLOW_LOCAL_HTTP==='true'&&['localhost','127.0.0.1'].includes(endpoint.hostname)))throw new Error('Gateway exige HTTPS, exceto loopback explicitamente habilitado.');
if(!credential||!tag)throw new Error('Configure EDGE_TOKEN e EDGE_TAG_ID. O simulador exige tenant DEMO.');
const store=new BufferStore(process.env.EDGE_BUFFER_PATH||'.data/edge.sqlite',Number(process.env.EDGE_MAX_BUFFER||100000));const adapter=new Simulator();let running=true,backoff=1000;
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{running=false;});
while(running){try{const result=await gatewayCycle(store,url,credential,()=>adapter.read([{id:tag,unit:process.env.EDGE_UNIT||'C',minimum:0,maximum:100}]));console.log(JSON.stringify({event:'edge_flush',...result}));backoff=1000;}catch(e:any){console.error(JSON.stringify({event:'edge_error',message:e.message,buffered:store.size()}));backoff=Math.min(60000,backoff*2);}
await new Promise(r=>setTimeout(r,Math.max(10000,backoff)+Math.floor(Math.random()*500)));}
store.close();
