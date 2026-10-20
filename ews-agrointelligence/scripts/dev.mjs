import {spawn} from 'node:child_process';
const args=process.argv.slice(2);const portIndex=args.indexOf('--port');const webPort=portIndex>=0?args[portIndex+1]:process.env.WEB_PORT||'3000';
const processes=[spawn(process.execPath,['apps/api/src/server.ts'],{stdio:'inherit',env:{...process.env,PORT:process.env.API_PORT||'4000'}}),spawn(process.execPath,['scripts/run-next.mjs','dev','--port',webPort],{cwd:'apps/web',stdio:'inherit',env:{...process.env,PORT:webPort}}),spawn(process.execPath,['apps/worker/index.ts'],{stdio:'inherit'})];
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{processes.forEach(p=>p.kill(signal));});
for(const p of processes)p.on('exit',code=>{if(code)processes.forEach(x=>x.kill());});
