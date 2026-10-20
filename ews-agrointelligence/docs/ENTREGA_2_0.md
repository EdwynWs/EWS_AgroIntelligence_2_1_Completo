# Entrega da atualização 2.0

Base: commit `8f0e198d9d63224edf5f0f43e2a9aaad19132a52` do repositório oficial. Branch local: `feat/automacao-operacional-v2`. O push foi bloqueado pela revisão automática por exigir autorização explícita de publicação; a branch ainda não foi enviada ao GitHub. O ZIP é a alternativa de entrega. Não houve merge em main nem implantação em produção.

## Implementado

- Modo Funcionário próprio, com ações grandes, identificação, galpão habitual/atribuído, data no fuso da granja, produção, ocorrências com categorias, tarefas e checklist, histórico e conclusão diária.
- Perfil Operador efetivamente restrito no backend. QR/link de galpão preservado após login sem conceder acesso. Reutilização de população confirmada, controle de data e correção por gestor.
- Centro de integrações com modelos de colunas por empresa, CSV/XLSX, pré-validação sem gravação, importação transacional, histórico, reprocessamento e origem dos dados.
- API Bearer por fonte/empresa, token com hash e rotação. Downloader HTTPS programado com allowlist, DNS público validado e fixado na conexão, TLS, limites, timeout e recusa de redirects. Credenciais cifradas.
- Agendamentos de relatório diário/semanal, fuso, horário, galpões, indicadores, destinatários autorizados, prévia HTML, fila SMTP, histórico e reenvio controlado. Comparação por período com verificação de cobertura. PDF sob demanda preservado.
- Visão diária do proprietário com produção registrada/pendente, última energia e estado das integrações, usando os registros originais dos módulos.
- Migração 002 aditiva; scripts de demo e portabilidade/exclusão atualizados para os vínculos novos. Exportação omite credenciais e conteúdos das filas.
- Navegação, tema claro/escuro, estilos responsivos e formulários das novas telas. Portal EWS, MFA, sessões, CSRF e gateway de somente leitura preservados.

## Executado e verificado

| Verificação | Resultado |
|---|---|
| Instalação pnpm congelada com scripts desativados | Concluída usando o lockfile do repositório |
| TypeScript API, banco, worker, scripts, testes e frontend | Sem diagnósticos |
| Testes automatizados | **58 aprovados, 0 falhas** (36 existentes + 22 novos) |
| Build Next.js Turbopack | Compilado com sucesso |
| Build oficial `pnpm build` (Webpack) | Concluído, incluindo standalone |
| Migração 001 preenchida → 002 e repetição | Preservou usuário, hash de senha, sessão e quantidade de registros de produção |
| Operador/empresa/galpão | Acesso financeiro negado; empresa e galpão não atribuídos rejeitados |
| CSV/XLSX | Mapeamento, transação, prévia com rollback, fórmula inválida, duplicidade e conflito |
| Agendamento HTTPS | Worker com transporte de download controlado no teste; intervalo, segredo cifrado e exclusão concorrente |
| Proteção SSRF | URLs/hosts/IPs bloqueados; resolução localhost recusada antes de conectar |
| Relatórios | Períodos, comparação, ausência de dados, escopo, demo, horário/fuso, dia semanal e deduplicação |
| SMTP | Envio HTML real para servidor SMTP de teste em loopback; falha/retry; destinatário revalidado |
| Fastify | Requisições HTTP reais em loopback: saúde, sessão demo, CSRF, autenticação e PDF binário |

Evidências: `docs/verification/v2/`. O teste de SMTP não enviou mensagem a uma pessoa nem usou credenciais externas. O teste de downloader usa arquivo controlado; não representa homologação de um endpoint de cliente.

## Pendências de homologação e limites explícitos

- PostgreSQL e Docker não estavam instalados neste ambiente. SQL/migração e imagem precisam ser executados no ambiente de homologação. A suíte core suporta `agro_test`; os novos testes usam SQLite.
- Navegador: política da sessão bloqueou acesso ao preview. Não foi contornada. Não afirmamos validação visual, teclado, iPhone/Android real ou ausência de overflow observada. `tests/browser-v2.mjs` foi entregue, mas não executado.
- SMTP do cliente, entregabilidade, DNS/certificado do endpoint HTTPS e volumes reais exigem credenciais, dados e ensaios do ambiente de destino.
- Arquivos programados usam HTTPS; SFTP/ERPs/Drive não foram implementados. WhatsApp e Omron real continuam pendentes e não são simulados como integrações prontas.
- Os relatórios enviados são HTML. PDF continua sob demanda dentro do sistema, sem anexo automático.
- População confirmada exige atualização do gestor ou fonte de importação; não é inferida do funcionamento de motores ou da produção. Correções conflitantes e dados ausentes exigem revisão humana.
- A fila reduz duplicatas por chave única, lease e Message-ID, mas SMTP mantém uma janela de reenvio se o processo cair após aceitação e antes de registrar sucesso.
- Comece com uma instância do worker e homologue carga/retentividade no PostgreSQL. Esta atualização não certifica capacidade de VPS nem conclui os itens comerciais não relacionados listados no relatório original.

## Como usar

Siga `ATUALIZACAO_2_0.md`: contém migração de instalação existente, guia do funcionário, atribuição de tarefas, mapeamentos, API, HTTPS, SMTP, programação e passos de produção. `ARQUIVOS_2_0.md` lista todos os arquivos alterados/adicionados.
