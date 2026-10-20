# Arquitetura e regras

## Topologia

Frontend Next.js → `/api` no mesmo domínio → Fastify → PostgreSQL. Um worker de processo único compartilha o banco. O gateway local inicia conexões de saída HTTPS, enviando lotes autenticados. A API não faz conexões aos CLPs.

A aplicação é um monólito modular, com serviços separados apenas por função de execução. Não há Redis, broker, Kubernetes ou serviço pago obrigatório. O transporte de desenvolvimento e o Fastify chamam o mesmo dispatcher e as mesmas regras; a equivalência do transporte Fastify ainda precisa de teste HTTP em produção controlada.

## Modelo relacional

Empresa → unidade → galpão → equipamento → tag. Lotes, produção, medidores, leituras, despesas, operação diária, manutenção e incidentes se relacionam a esse contexto. Assinaturas e planos governam módulos e limites. Usuários têm uma empresa e uma função; administradores EWS têm `tenant_id=NULL`.

Relações industriais usam chaves estrangeiras compostas `(tenant_id,id)`, impedindo que um registro aponte para equipamento, galpão ou gateway de outra empresa. Todos os endpoints de dados derivam o tenant da sessão. O cabeçalho `x-tenant-id` é ignorado para clientes comuns e aceito apenas para EWS. Leituras administrativas nessa modalidade são auditadas.

Não há PostgreSQL RLS nesta versão. A segregação depende da camada de autorização, consultas filtradas e FKs compostas, cobertas pelos testes locais. Homologar os mesmos testes em PostgreSQL é um bloqueio de produção.

## Persistência

SQL parametrizado, tabelas permitidas por um registro interno e ordenação por campos permitidos. Transações de negócio usam isolamento SERIALIZABLE no PostgreSQL, com até três tentativas em conflitos de serialização/deadlock. Em SQLite, um mutex serializa operações e transações `BEGIN IMMEDIATE`.

Valores monetários são inteiros em centavos. Tarifas são milionésimos de real por kWh. Telemetria usa DOUBLE PRECISION. Sequenciamento de gateway usa BIGINT. Leituras energéticas são **consumo diário**, não registradores cumulativos: se o medidor fornece um contador acumulado, faça e valide a diferença antes de importar. Não existe conversão de horas de motor em kWh.

## Identidade e permissões

Sessão aleatória de 256 bits, somente hash no banco, expiração de 12 horas, cookie HttpOnly/SameSite=Strict e Secure em produção. CSRF por token de sessão e validação exata de Origin nas mutações do navegador. Senhas com scrypt N=32768, salt aleatório e comparação de tempo constante. MFA TOTP com segredo AES-256-GCM, janela de tolerância ±1 passo e rejeição de reutilização.

Perfis: EWS, OWNER, MANAGER, TECH, VIEWER. A matriz de escrita está em `packages/shared/resources.ts`. Ler não concede escrita. Alterações de acesso revogam sessões. EWS e OWNER precisam de MFA para login em produção.

## Ingestão

Máximo 500 leituras por lote. Token individual por gateway, armazenado em hash. Tag precisa pertencer ao gateway e à mesma empresa. Unidade, intervalo, tipo, origem, qualidade, horário futuro e idade máxima são validados. O lote é atômico. `(gateway_id,sequence)` é único; reenvio igual é reconhecido como duplicata; mesma sequência com outro conteúdo gera conflito.

Dados antigos podem atualizar históricos, mas não sobrescrevem a última leitura mais nova. Alertas não são disparados a partir de backlog desatualizado ou amostras BAD/UNCERTAIN. Amostras além da retenção são rejeitadas explicitamente; o gateway mantém a fila para diagnóstico.

## Alertas

Limiar superior, histerese, duração mínima, silenciamento e latch persistido. O gatilho cria uma única ocorrência ativa por regra. O sinal precisa sair da zona de histerese antes de um novo ciclo. Uma lacuna maior que a validade da tag reinicia a duração pendente. O operador registra responsável, reconhecimento e providência antes do encerramento.

## Métricas e retenção

Cada ingestão atualiza agregações horárias por tag, origem e qualidade. Gráficos leem agregados, não milhões de amostras. O worker remove amostras brutas com mais de 90 dias por padrão, até 10.000 por execução horária; agregados duram até 730 dias. Reavalie o lote de limpeza quando o volume crescer. Índices cobrem tenant, tag, período e unicidade.

A disponibilidade e o MTBF exigem registros diários completos de todos os equipamentos do escopo, com cobertura 100%. Disponibilidade = minutos em operação / minutos programados × 100. MTBF = minutos operacionais / 60 / falhas. Sem cobertura completa, o resultado é ausente. Esses são indicadores **registrados e validados pelo operador**, não inferência automática de cobertura contínua do CLP.

MTTR usa duração das falhas encerradas registradas no período; eventos incompletos não compõem a média. Custo elétrico por mil ovos exige leituras por galpão, tarifa e produção no mesmo dia. Não há rateio automático de medição geral.

## Limites operacionais

Um worker ativo por implantação. Não há coordenação distribuída do outbox; SMTP pode repetir uma entrega se cair após o envio e antes da confirmação. Message-ID é estável para auxiliar reconciliação, sem garantia de exatamente uma entrega. Rate limiting em memória é por processo; Nginx acrescenta proteção por IP. Anexos pequenos são guardados em base64 no PostgreSQL, até 1,5 MB e 10 por ordem; migrar para armazenamento de objetos se o uso crescer.
