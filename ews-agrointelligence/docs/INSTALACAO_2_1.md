# Instalação e atualização 2.1

O repositório/ZIP contém a pasta `ews-agrointelligence`. Os comandos pnpm e Docker são executados **dentro dela**, onde estão package.json e .env.example. Não execute na pasta externa do ZIP.

## Windows / PowerShell — instalação nova

Instale Node.js 24 e Git. Abra a pasta do código no VS Code. Execute um comando por vez; pare ao primeiro erro:

```powershell
cd .\ews-agrointelligence
node --version
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abra http://localhost:3000/login e use **Explorar demonstração**. API: porta 4000. Não existe senha de administrador padrão. O seed cria somente registros fictícios. Três galpões e 18 equipamentos demonstrativos compartilham uma empresa identificada como demo.

Se `package.json` não for encontrado, execute `Get-ChildItem` e abra a subpasta correta. Se uma porta estiver ocupada, encerre a execução anterior com Ctrl+C. O aviso experimental SQLite do Node não é uma falha de migração. Não atualize pnpm só por aparecer um aviso de versão.

## Linux — instalação nova

```bash
cd ews-agrointelligence
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Atualizar instalação existente

1. Pare API e worker. Faça backup do banco e copie o `.env` para local protegido.
2. Preserve a pasta `.git` e seu histórico; não apague commits. Não copie node_modules/.next/bancos entre versões.
3. Atualize o código para a branch revisada. Execute `pnpm install --frozen-lockfile`.
4. Compare `.env.example` com seu `.env`; não sobrescreva credenciais com o exemplo.
5. Execute `pnpm db:migrate`. A 003 adiciona estruturas; 001/002 permanecem inalteradas.
6. **Não execute db:seed em uma instalação real para testar a atualização.** Valide migração/restauração primeiro em clone autorizado do banco.
7. Execute `pnpm typecheck`, `pnpm test` e `pnpm build`; reinicie os serviços conforme a arquitetura escolhida.
8. Faça smoke test autenticado, tarefas, importação, relatório e healthcheck antes de reabrir acesso.

Não há downgrade automático da 003. Rollback de implantação exige restaurar o backup e a versão correspondente em janela de manutenção; não remova tabelas manualmente.

## Primeiro administrador e cliente

Configure `MFA_ENCRYPTION_KEY` com 64 caracteres hexadecimais gerados criptograficamente. Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres, única). Execute `pnpm bootstrap`. Registre a chave TOTP exibida uma única vez no autenticador; não inclua a chave em capturas de tela ou Git.

No Portal EWS: Clientes → Nova empresa → plano → proprietário. A empresa inicia com 14 dias de teste. Em produção, provisione MFA do proprietário com `node --env-file=.env scripts/bootstrap.ts email-do-proprietario` antes do login. Registre a autorização e entregue a chave por canal seguro.

## Variáveis

| Grupo | Variáveis | Uso |
|---|---|---|
| Local | DB_DRIVER=sqlite, SQLITE_PATH | Banco descartável/local |
| Produção | NODE_ENV=production, DB_DRIVER=postgres, DATABASE_URL | API/worker usam PostgreSQL |
| URLs | APP_ORIGIN, API_INTERNAL_URL, PORT, HOST | Origin exata, proxy do Next e escuta interna |
| Identidade | MFA_ENCRYPTION_KEY, ADMIN_EMAIL, ADMIN_PASSWORD | Cifra e bootstrap; faça backup da chave |
| Demo | ENABLE_DEMO, DEMO_PASSWORD opcional | Nunca use senha demonstrativa para contas reais |
| SMTP | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE | E-mail; sem host não há envio |
| Importação | IMPORT_ALLOWED_HOSTS | DNS públicos exatos, separados por vírgula; vazio bloqueia HTTPS |
| Retenção | TELEMETRY_RETENTION_DAYS, AUDIT_RETENTION_DAYS | Política que deve ser acordada |
| Gateway | EDGE_API_URL, EDGE_TOKEN, EDGE_TAG_ID, EDGE_UNIT, EDGE_BUFFER_PATH, EDGE_MAX_BUFFER | Simulador/buffer; produção exige HTTPS |
| Cobrança interna | ENABLE_BILLING_WEBHOOK, WEBHOOK_SECRET | Contrato HMAC interno; mantenha desativado sem integrador validado |
| Compose | POSTGRES_PASSWORD, TRUST_PROXY | Senha URL-safe e número de proxies controlados |

Recorrências locais não precisam de credenciais de cobrança. Elas criam registros pendentes; o recebimento manual exige comprovante. Nenhum Pix/boleto é emitido por essa funcionalidade.

## Verificações

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e:2.1
```

O teste de navegador 2.1 cria banco SQLite temporário, inicia seus próprios serviços locais nas portas 3000/4000 e os encerra. Pare suas instâncias antes. Não aponte esse roteiro para produção. Capturas e logs ficam em `test-results/v2.1/`.

PostgreSQL: `TEST_POSTGRES_URL` deve apontar para um banco **novo e vazio chamado agro_verify**. Execute `pnpm test:postgres`. A suíte recusa banco com tabelas ou com nome diferente. `tests/core.test.ts` tem uma suíte separada destrutiva exclusivamente para `agro_test`; ela não deve compartilhar banco com outra execução.
