import {spawn} from 'node:child_process';
const input=process.argv.slice(2);let port=process.env.PORT||'3000';
for(let i=0;i<input.length;i++)if(input[i]==='--port')port=input[i+1];
const mode=input.includes('start')?'start':input.includes('build')?'build':'dev';
const args=mode==='build'?['build','--webpack']:[mode,'--hostname','0.0.0.0','--port',port];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...args],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
