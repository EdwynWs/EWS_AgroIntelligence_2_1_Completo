import { z } from 'zod';
export type Field = {label:string;type?:string;required?:boolean;default?:any;min?:number;max?:number;options?:string[];ref?:string;readonly?:boolean};
export type Resource = {label:string;module:string;roles:string[];fields:Record<string,Field>;search:string[]};
const f=(label:string,type='text',extra:Partial<Field>={}):Field=>({label,type,...extra});
const req=(label:string,type='text',extra:Partial<Field>={})=>f(label,type,{required:true,...extra});
const ref=(label:string,table:string,required=true)=>f(label,'select',{ref:table,required});
const num=(label:string,min=0,def=0)=>f(label,'number',{min,default:def});
const choice=(label:string,options:string[],def:string)=>f(label,'select',{options,default:def});
const source=choice('Origem',['MANUAL','IMPORTED','MEASURED'],'MANUAL');
const manage=['OWNER','MANAGER']; const tech=[...manage,'TECH'];
const resource=(label:string,module:string,roles:string[],fields:Record<string,Field>,search=['name']):Resource=>({label,module,roles,fields,search});
export const resources:Record<string,Resource>={
 operation_logs:resource('Operação diária validada','monitor',tech,{equipment_id:ref('Equipamento','equipment'),day:req('Data','date'),scheduled_minutes:f('Tempo programado (min)','number',{min:1,max:1440,default:1440}),operating_minutes:f('Tempo em operação (min)','number',{min:0,max:1440,default:0}),failure_count:f('Falhas no dia','number',{min:0,default:0}),coverage_percent:f('Cobertura validada (%)','number',{min:0,max:100,default:100}),evidence:req('Fonte / método / validação','textarea')},['day','evidence']),
 units:resource('Unidades','monitor',manage,{name:req('Nome'),address:f('Endereço','text',{default:''})}),
 barns:resource('Galpões','monitor',manage,{name:req('Nome'),unit_id:ref('Unidade','units'),capacity:num('Capacidade de aves'),birds:num('Aves alojadas')}),
 flocks:resource('Lotes','performance',manage,{name:req('Identificação'),barn_id:ref('Galpão','barns'),birds:num('Aves'),starts_on:req('Alojamento','date'),ends_on:f('Encerramento','date')}),
 equipment:resource('Equipamentos','monitor',tech,{name:req('Nome'),barn_id:ref('Galpão','barns'),category:choice('Categoria',['Ventilação','Esteira','Motor','Sensor','Iluminação','Outro'],'Motor'),model:f('Modelo / CPU','text',{default:''}),reference_hours:num('Referência de vida útil (h)'),schedule_hours:f('Horas programadas por dia','number',{min:0.01,max:24,default:24}),notes:f('Informações técnicas e grupos','textarea',{default:''})}),
 tags:resource('Tags autorizadas','monitor',tech,{name:req('Nome'),equipment_id:ref('Equipamento','equipment'),gateway_id:ref('Gateway','gateways'),kind:choice('Variável',['temperature','state','hours','cycles','kwh','humidity','power'],'temperature'),unit:req('Unidade (C, %, h, kWh...)'),minimum:num('Valor mínimo',-1000000,-100),maximum:num('Valor máximo',-1000000,1000000),stale_seconds:f('Desatualizado após (s)','number',{min:10,max:86400,default:120})}),
 alert_rules:resource('Regras de alerta','monitor',tech,{name:req('Nome'),tag_id:ref('Tag','tags'),threshold:num('Limiar superior',-1000000,30),hysteresis:num('Histerese',0,1),duration_seconds:f('Duração mínima (s)','number',{min:0,max:86400,default:60}),severity:choice('Severidade',['info','warning','critical'],'warning'),silence_until:f('Silenciar até','datetime-local'),active:f('Regra ativa','checkbox',{default:1})}),
 incidents:resource('Ocorrências','monitor',tech,{title:req('Descrição'),equipment_id:ref('Equipamento','equipment'),severity:choice('Severidade',['info','warning','critical'],'warning'),status:choice('Estado',['open','acknowledged','closed'],'open'),assignee:f('Responsável','text',{default:''}),action:f('Providência tomada','textarea',{default:''})},['title','assignee']),
 maintenance_plans:resource('Planos de manutenção','predict',tech,{basis:choice('Critério',['hours','cycles','calendar'],'hours'),every_cycles:f('Periodicidade em ciclos','number',{min:1}),next_cycles:f('Próximo contador de ciclos','number',{min:0}),every_days:f('Periodicidade em dias','number',{min:1}),next_on:f('Próxima data','date'),name:req('Nome'),equipment_id:ref('Equipamento','equipment'),every_hours:f('Periodicidade (h)','number',{min:1,default:1000}),next_hours:num('Próxima intervenção (h)',0,1000),checklist:f('Checklist (uma tarefa por linha)','checklist',{default:[]})}),
 inspections:resource('Inspeções','predict',tech,{name:req('Inspeção'),equipment_id:ref('Equipamento','equipment'),day:req('Data','date'),result:choice('Resultado',['ok','attention','fault'],'ok'),checklist:f('Checklist','checklist',{default:[]}),notes:f('Evidências e observações','textarea',{default:''})}),
 work_orders:resource('Ordens de serviço','predict',tech,{title:req('Serviço'),equipment_id:ref('Equipamento','equipment'),assignee:f('Responsável','text',{default:''}),priority:choice('Prioridade',['low','normal','high','critical'],'normal'),due_on:req('Prazo','date'),checklist:f('Checklist (uma tarefa por linha)','checklist',{default:[]}),report:f('Relatório técnico','textarea',{default:''}),parts_cents:num('Peças (centavos)'),labor_cents:num('Mão de obra (centavos)'),duration_minutes:num('Tempo de execução (min)')},['title','assignee']),
 downtimes:resource('Paradas registradas','predict',tech,{equipment_id:ref('Equipamento','equipment'),starts_at:req('Início','datetime-local'),ends_at:req('Fim','datetime-local'),reason:req('Motivo'),failure:f('Foi falha','checkbox',{default:1}),scheduled_minutes:f('Minutos da parada dentro do horário programado','number',{min:1,default:60})},['reason']),
 meters:resource('Medidores','energy',tech,{name:req('Nome'),barn_id:ref('Galpão (vazio = medição geral)','barns',false),serial:f('Identificação / série','text',{default:''})}),
 tariffs:resource('Tarifas','energy',manage,{name:req('Nome'),rate_micros:f('Tarifa em milionésimos de R$/kWh (850000 = R$ 0,85)','number',{min:0,default:850000}),starts_on:req('Início da vigência','date'),ends_on:req('Fim da vigência','date')}),
 energy_readings:resource('Leituras de energia','energy',tech,{meter_id:ref('Medidor','meters'),day:req('Dia do consumo','date'),kwh:num('Consumo diário (kWh)'),demand_kw:f('Demanda medida (kW)','number',{min:0}),source,evidence:req('Fonte / comprovante / método')},['evidence']),
 invoices:resource('Faturas de energia','energy',manage,{name:req('Referência'),period_start:req('Início','date'),period_end:req('Fim','date'),kwh:num('Energia faturada (kWh)'),total_cents:num('Total faturado (centavos)')}),
 production:resource('Produção de ovos','performance',manage,{barn_id:ref('Galpão','barns'),day:req('Data','date'),eggs:num('Ovos produzidos'),birds:f('Aves alojadas no dia','number',{min:1,default:1}),source},['day']),
 costs:resource('Custos operacionais','performance',manage,{name:req('Descrição'),barn_id:ref('Galpão (opcional)','barns',false),day:req('Data','date'),category:choice('Categoria',['Ração','Mão de obra','Transporte','Outros'],'Outros'),amount_cents:num('Valor (centavos)')}),
 opportunities:resource('Oportunidades','performance',manage,{name:req('Descrição'),category:choice('Classificação',['alert','estimated','verified'],'alert'),amount_cents:num('Valor (centavos)'),baseline_start:f('Início da base','date'),baseline_end:f('Fim da base','date'),comparison_start:f('Início da comparação','date'),comparison_end:f('Fim da comparação','date'),methodology:f('Metodologia','textarea',{default:''}),evidence:f('Fonte dos dados','textarea',{default:''}),adjustments:f('Ajustes de clima, tarifa, produção e manejo','textarea',{default:''})}),
 tickets:resource('Suporte','base',['OWNER','MANAGER','TECH','VIEWER'],{title:req('Assunto'),body:req('Mensagem','textarea')},['title','body'])
};
export function validate(name:string,input:any):Record<string,any>{
 const def=resources[name]; if(!def)throw new Error('Recurso desconhecido');
 const shape:Record<string,z.ZodTypeAny>={};
 for(const [key,f] of Object.entries(def.fields)){
  let s:z.ZodTypeAny;
  if(f.type==='number') {let n=z.number().finite();if(f.min!==undefined)n=n.min(f.min);if(f.max!==undefined)n=n.max(f.max);if(/cents|micros/.test(key))n=n.max(2000000000);if(/cents|birds|eggs|capacity|seconds|minutes|micros|count|cycles|days/.test(key))n=n.int();s=n;}
  else if(f.type==='checkbox')s=z.number().int().min(0).max(1);
  else if(f.type==='checklist')s=z.array(z.object({label:z.string().trim().min(1).max(250),done:z.boolean()})).max(100);
  else if(f.options)s=z.enum(f.options as [string,...string[]]);
  else if(f.ref)s=z.string().uuid();
  else if(f.type==='date')s=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Data inválida');
  else if(f.type==='datetime-local')s=z.string().datetime();
  else s=z.string().trim().min(f.required?1:0).max(f.type==='textarea'?5000:250);
  if(f.default!==undefined)s=s.default(f.default);else if(!f.required)s=s.nullable().optional().transform(v=>v??null);
  shape[key]=s;
 }
 const data=z.object(shape).strict().parse(input);
 if(name==='maintenance_plans'){if(data.basis==='calendar'&&(!data.every_days||!data.next_on))throw new Error('Periodicidade em dias e próxima data são obrigatórias.');if(data.basis==='cycles'&&(!data.every_cycles||data.next_cycles==null))throw new Error('Periodicidade e próximo contador de ciclos são obrigatórios.');}
 if(name==='operation_logs'&&data.operating_minutes>data.scheduled_minutes)throw new Error('Operação excede o tempo programado.');
 if(name==='barns'&&data.birds>data.capacity)throw new Error('Aves excedem a capacidade.');
 if(name==='tags'&&data.minimum>=data.maximum)throw new Error('Mínimo deve ser inferior ao máximo.');
 if(name==='downtimes'&&(data.ends_at<=data.starts_at||data.scheduled_minutes>(Date.parse(data.ends_at)-Date.parse(data.starts_at))/60000))throw new Error('Intervalo ou duração programada inválidos.');
 for(const [a,b] of [['starts_on','ends_on'],['period_start','period_end'],['baseline_start','baseline_end'],['comparison_start','comparison_end']])if(data[a]&&data[b]&&data[b]<data[a])throw new Error('O fim deve ser posterior ao início.');
 if(name==='opportunities'&&data.category==='verified'){
  for(const k of ['baseline_start','baseline_end','comparison_start','comparison_end','methodology','evidence','adjustments'])if(!data[k])throw new Error('Ganho verificado exige base, comparação, metodologia, fonte e ajustes.');
  if(data.comparison_start<=data.baseline_end)throw new Error('Períodos de base e comparação não podem se sobrepor.');
 }
 if(name==='incidents'&&data.status==='closed'&&!data.action)throw new Error('Informe a providência antes de encerrar.');
 return data;
}
export const modules=['monitor','predict','energy','performance'];
export const roles=['OWNER','MANAGER','TECH','VIEWER','OPERATOR'];
export function parseJson<T=any>(v:any,fallback:T):T{try{return typeof v==='string'?JSON.parse(v):v??fallback;}catch{return fallback;}}
