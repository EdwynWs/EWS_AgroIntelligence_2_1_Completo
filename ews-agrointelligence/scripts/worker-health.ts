import {connect,one} from '../packages/database/db.ts';
const db=await connect();try{const health=await one(db,"SELECT last_success_at FROM worker_health WHERE id='primary'");if(!health||Date.now()-Date.parse(health.last_success_at)>180000)throw new Error('Worker sem ciclo completo há mais de 180 segundos.');console.log('Worker saudável.');}finally{await db.close();}
