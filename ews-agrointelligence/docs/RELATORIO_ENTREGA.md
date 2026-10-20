> Relatório histórico da versão inicial. As alterações e verificações da atualização 2.0 estão em `ENTREGA_2_0.md`.

# Relatório de entrega — EWS AgroIntelligence

Data: 19/10/2026. Versão: 0.1.0. Base: especificação anexada e PDF de concepção, com quatro módulos e princípios industriais de somente leitura.

## 1. O que foi construído

Aplicação funcional com código de frontend, API, banco, migração, worker, simulador, buffer edge, testes e documentação. Não é apenas um conjunto de imagens. Cadastros e ações principais persistem dados, validam referências e verificam permissões no backend.

Monitor: galpões, equipamentos, tags, ingestão, atualidade/qualidade, agregações, regras, ocorrências, reconhecimento, responsáveis e providências. Predict: planos por horas, ordens, prioridade, prazos, checklist, custos, execução, relatório e anexos; MTTR e métricas informadas com cobertura validada. Energy: medidores, consumo diário, tarifas com vigência, faturas, custo estimado, CSV/XLSX e gráficos. Performance: produção por galpão/dia, população, custos, ovos por ave-dia, custo por mil ovos com correspondência de escopo e oportunidades classificadas.

Portal EWS: empresas, administradores iniciais, planos, módulos, limites, assinaturas, estados, histórico no banco, cobranças e recebimentos manuais, MRR/ARR, faturado/recebido/inadimplência, leads, suporte e auditoria. Não há dados comerciais fictícios misturados aos indicadores reais.

Autenticação: sessões, CSRF, funções, MFA, recuperação, convite, suspensão e revogação. Interface: tema claro/escuro, navegação móvel, tabelas pesquisáveis/paginadas/ordenáveis, formulários, estados vazios, erros e feedback. Layout foi codificado para os tamanhos solicitados, mas a inspeção visual foi bloqueada.

Demonstração: empresa isolada, três galpões, 18 equipamentos, medidores, produção histórica, ocorrências e manutenção fictícias. Reset autorizado somente ao EWS e protegido contra tenant real. Relatórios CSV, HTML e PDF usam os dados do banco.

Gateway: identidade, token, fila SQLite persistente, reenvio, confirmação, sequência, deduplicação no servidor, backoff e limite de buffer. Simulador funcional; nenhuma integração Omron real ativada.

## 2. Tecnologias e decisões

Next.js 16.3.4, React 19.2.6, TypeScript, Recharts, Lucide, Zod, Node.js 24. Código para Fastify em produção, PostgreSQL via pg, SMTP via Nodemailer. SQLite é somente fallback de desenvolvimento/teste e buffer edge. Docker Compose, Nginx e guia de Vercel.

Diferenças em relação à stack preferencial: SQL parametrizado explícito em vez de ORM; CSS próprio e elementos HTML acessíveis em vez de shadcn/Tailwind; CSS em vez de Framer Motion; `node:test` em vez de Vitest. Foram usados os componentes disponíveis para verificar a aplicação localmente sem inventar instalações ou builds.

## 3. Resultados de verificação

36 testes locais passaram. Foram compilados frontend e TypeScript de aplicação. PDF gerado foi reaberto e validado com pdf-lib. Backup SQLite passou por cópia, restauração e checagem de integridade.

Microbenchmark: 5.000 leituras sintéticas em 100 lotes de 50, cerca de 6.936 leituras/s no dispatcher SQLite em memória, p95 de 17,661 ms por lote; dashboard p95 de 3,820 ms em 100 consultas. Processo atingiu aproximadamente 121,92 MiB de RSS. Máquina: Linux, Node v24.19.0, AMD EPYC 9V74, 9 CPUs lógicas disponíveis, concorrência 1. Esses valores não representam PostgreSQL, Fastify/HTTP, VPS ou capacidade comercial garantida.

**Não executados:** PostgreSQL, Docker, Fastify real, restauração PostgreSQL, SMTP externo, Playwright e inspeção visual. O navegador foi bloqueado pela política do ambiente. O build usou dependências de frontend disponíveis no cache; a instalação integral de produção e seu lockfile permanecem pendentes.

## 4. Execução e implantação

README contém os comandos de instalação local, demo e bootstrap EWS. DEPLOY.md contém Vercel+VPS e Docker Compose. HTTPS.md, BACKUP_RESTORE.md e ATUALIZACAO_DIAGNOSTICO.md descrevem domínio, backup, restauração, atualização e diagnóstico. Nenhuma implantação foi feita.

Variáveis: `.env.example` cobre origem, API, banco, demo, SMTP, MFA, credenciais administrativas, retenção, gateway e webhook. Credenciais reais não fazem parte do pacote. Dados locais de teste, `.env` e dependências instaladas foram excluídos.

## 5. Custos e capacidade

Estimativa exemplificativa em DEPLOY.md, com premissas substituíveis. Não houve cotação de fornecedor nem teste em VPS de 1 GB. Nenhuma capacidade para centenas de equipamentos foi certificada. A arquitetura tem limites, índices, agregações e paginação, mas precisa de ensaio de carga PostgreSQL representativo.

## 6. Pendências externas e de homologação

Identificar CPU/firmware Omron, interfaces, mapa de tags e autorização formal; implementar/validar adaptador em bancada; contratar hospedagem, domínio e certificados; configurar SMTP e contas de fornecedores; validar instalação, lockfile, Docker e PostgreSQL; testar todos os fluxos por navegador; definir suporte, responsabilidades e aceite do piloto.

O adaptador HMAC de cobrança está implementado e testado como contrato interno, mas Asaas/Mercado Pago exigem adaptadores específicos. Não há cobrança real, boleto, PIX ou débito recorrente automático. WhatsApp oficial não foi implementado.

## 7. Escopo ainda não concluído em relação à especificação integral

Esta entrega **não deve ser descrita como todo o SaaS comercial concluído**. Além da homologação acima, ainda faltam: gestão documental específica de contratos; fluxos completos de inspeção separados das ordens; planejamento preventivo por ciclos além das horas; calendário complexo de turnos e cobertura automática de estados para disponibilidade; análise avançada de recorrência/tendência; comparação automatizada com período anterior e modelo de impacto de paradas; configurações avançadas de notificação por pessoa; cobrança recorrente de fornecedor; PWA instalável; edição visual de permissões granulares; otimização/medição em carga concorrente e revisão externa de segurança.

A lista distingue limitações de implementação de dependências externas. Nenhuma dessas funções foi substituída por resultados fictícios ou botões que prometam executar uma integração inexistente.

## 8. Código e arquivos

Monorepo entregue em ZIP, com scripts, migração, testes e guias. Abra README.md para começar e SEGURANCA_DADOS.md para os gates de implantação. O diretório `docs/verification` preserva resultados de testes, build e benchmark. Não foi criado repositório remoto nem publicada aplicação.
