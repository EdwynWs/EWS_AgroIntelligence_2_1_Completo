# Entrega técnica 2.1 — 20/10/2026

Base conferida no GitHub: `EdwynWs/EWS_AgroIntelligence_2_0`, commit `e32bf64e5a80de8a1a6c9ccce000c823bbb57c1a`. Entrega de arquivos para aplicação pelo proprietário, conforme pedido. Não houve publicação na main nem deploy.

## 1. Situação da entrega
Correções e incrementos implementados sobre a versão existente. A versão é candidata à homologação; não foi declarada pronta para produção. PostgreSQL, Docker e integrações externas ainda exigem validação real.

## 2. Arquitetura
Preservados Next.js, Fastify, worker e gateway. Novos módulos extraem manutenção preventiva, recorrência de recebíveis e diagnóstico operacional. SQLite local; PostgreSQL para produção.

## 3. Segurança
Reset não reativa usuários desabilitados e invalida tokens anteriores. Assinaturas suspensas são bloqueadas centralmente. Limite de tentativas de autenticação separado de leituras de sessão. Sem senhas ou credenciais reais no pacote. Veja DIAGNOSTICO_2_1.md.

## 4. Isolamento e permissões
Regressões de tenant, perfis, CSRF, MFA e exportação. Histórico operacional restrito ao usuário quando aplicável. RLS não foi ativado: exige modelagem dos papéis e homologação no PostgreSQL. Não há alegação de certificação ou pentest independente.

## 5. Banco e migração
003_operational.sql adiciona estruturas de inspeção, recorrências, idempotência e saúde do worker. Migrações 001/002 preservadas. Faça backup antes de migrar; não existe downgrade automático. Não rode seed em base real.

## 6. Monitoramento e gateway
Buffer tenta enviar antes de coletar, recupera fila cheia e valida ACK inteiro não negativo. Redirecionamentos de envio recusados. Uso físico depende de modelo Omron, mapa de tags e bancada autorizada; simulador não comprova integração industrial.

## 7. Manutenção
Regras por horas, ciclos ou calendário, com contador único confiável e assinatura elegível. Totais consultam todas as ordens mesmo quando a lista exibe apenas 100. Inspeções cadastráveis. Regras verificáveis, sem promessa de previsão de falhas por IA.

## 8. Energia e produção
Escopo de medidor com histórico não pode ser reatribuído. Dias sem tarifa têm custo ausente. Datas impossíveis são recusadas. Importações vazias ou esparsas têm erro explícito. Relatórios incluem cobertura e origem dos dados.

## 9. Funcionários
Produção, ocorrências e tarefas; reenvio de ocorrência com chave idempotente. Aviso de conexão e bloqueio de salvamento offline. Campos só permanecem enquanto a tela fica aberta; não há sincronização offline persistente.

## 10. Portal EWS e cobrança
Diagnóstico de worker, filas e gateways. Recorrência mensal cria recebíveis locais, com deduplicação por competência. Não emite Pix/boleto nem debita clientes. Integração com provedor e conciliação externa permanecem pendentes.

## 11. Interface e acessibilidade
Ajustes responsivos, áreas de toque, foco de modal/menu, Escape, navegação por teclado, tabelas com rolagem própria e correção do formulário público que excedia a largura móvel. Não equivale a auditoria WCAG completa ou teste em Safari físico.

## 12. PDFs
Resumo executivo, cobertura de produção, origem e gráfico de energia. Dados ausentes e limitações têm indicação explícita. Exportação autenticada e com escopo de empresa.

## 13. Verificações executadas
TypeScript: aprovado. Testes Node: 72 encontrados, 71 aprovados, zero falhas e um teste PostgreSQL ignorado por ausência de TEST_POSTGRES_URL. Build Next 16.3.8 concluído. Auditoria de dependências de produção: zero avisos na consulta registrada. Evidências textuais em verification/v2.1; Playwright com Chromium 153.0.8010.0: 76 verificações de layout em 360, 390, 768, 1024 e 1440 px, sem overflow horizontal da página e sem erros JavaScript; fluxos de login/MFA, produção, ocorrência, bloqueio financeiro, modais, navegação e saúde operacional. Resultado em browser-results.json. PDF final renderizado e revisado em duas páginas, com títulos e gráficos mantidos juntos. O navegador usou binário explicitamente indicado por PLAYWRIGHT_EXECUTABLE_PATH; CI usa Chromium instalado pelo Playwright.

## 14. Desempenho
Benchmark HTTP em SQLite temporário com WAL: 100 consultas de dashboard, concorrência 10, p95 45,26 ms; 1.000 amostras aceitas em 20 lotes. RSS do processo aproximadamente 163 MiB. Isso não dimensiona PostgreSQL, VPS ou número de clientes em produção. Dados e contexto em verification/v2.1/benchmark-http.json.

## 15. Infraestrutura e CI
Workflow preparado para testes, build, navegador, PostgreSQL, backup/restauração descartável e build Docker. Não executado no GitHub nesta entrega. Não há homologação Docker local. Sem orçamento comercial de hospedagem validado: medir a carga piloto e cotar recursos, backups e serviços antes de definir custos.

## 16. Instalação e publicação
Siga INSTALACAO_2_1.md. Comandos executados na subpasta ews-agrointelligence que contém package.json. Preserve .env, bancos e histórico Git. Entrega por arquivos conforme solicitação; usuário aplica e publica um novo commit. Branch sugerida: feat/agrointelligence-production-ready-2-1. Nenhum PR ou push é apresentado como concluído.

## 17. Liberação do piloto
Executar CI em PostgreSQL/Docker; comprovar backup/restauração; configurar HTTPS, MFA, SMTP e monitoramento; testar bancada industrial somente leitura; validar permissões e suporte; acordar limites do piloto e políticas de dados. Roteiro, questionário e critérios em PILOTO_COMERCIAL_2_1.md. Cobrança externa e testes em aparelhos reais permanecem pendentes até integração verificável.
