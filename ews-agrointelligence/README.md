# EWS AgroIntelligence

Aplicação B2B para granjas de postura: Monitor, Predict, Energy e Performance, com portal EWS, dados persistidos e demonstração isolada.

**Versão 2.1 em revisão:** correções de integridade, manutenção por calendário/ciclos, inspeções, recorrência de recebíveis, saúde operacional e melhorias mobile. Consulte `docs/ENTREGA_2_1.md`, `docs/DIAGNOSTICO_2_1.md` e `docs/INSTALACAO_2_1.md`.

**Ainda há bloqueadores de homologação:** PostgreSQL/Docker no ambiente de destino, serviços externos e aparelhos físicos. Resultados novos e limitações estão separados no relatório 2.1. Não há integração Omron física nem cobrança por provedor homologada.

## Começar no seu computador

Requisitos: Node.js 24, pnpm 11.25.0 e acesso ao registro npm para instalar dependências. Não há credenciais reais no pacote.

Abra primeiro a subpasta `ews-agrointelligence/` do repositório/ZIP.

```bash
cd ews-agrointelligence
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env` (no PowerShell: `Copy-Item .env.example .env`). Para uma demonstração local, mantenha:

```dotenv
NODE_ENV=development
DB_DRIVER=sqlite
SQLITE_PATH=.data/agro.sqlite
APP_ORIGIN=http://localhost:3000
API_INTERNAL_URL=http://127.0.0.1:4000
ENABLE_DEMO=true
```

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abra **http://localhost:3000/login** e clique em **Explorar demonstração**. Esse acesso pertence somente à empresa fictícia. Não há senha padrão para empresas reais. O worker atualiza leituras fictícias a cada 10 segundos; o frontend consulta a cada 30 segundos.

Para entrar na demo por e-mail e senha, defina `DEMO_PASSWORD` antes do primeiro seed. E-mail fictício: `demo@agro.example`. Sem essa variável, o seed gera uma senha aleatória não divulgada; use o botão da demonstração. Executar o seed novamente preserva os registros existentes.

## Administrador EWS

Gere uma chave de criptografia MFA:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Coloque o valor em `MFA_ENCRYPTION_KEY` no `.env`. Defina seu e-mail em `ADMIN_EMAIL` e uma senha única com pelo menos 12 caracteres em `ADMIN_PASSWORD`. Depois:

```bash
pnpm bootstrap
```

O comando exibe uma chave TOTP **uma única vez**. Cadastre-a em seu aplicativo autenticador e guarde-a de forma segura. Acesse com e-mail, senha e código MFA. O portal EWS permite cadastrar empresas, planos, assinaturas, cobranças manuais, leads e chamados. Nenhum envio de e-mail acontece sem configurar SMTP e rodar o worker.

## Comandos

| Comando | Finalidade |
|---|---|
| `pnpm dev` | API, frontend e worker em desenvolvimento |
| `pnpm api` | API na porta 4000 |
| `pnpm worker` | Processamento periódico, e-mail e demo |
| `pnpm db:migrate` | Esquema inicial idempotente |
| `pnpm db:seed` | Empresa fictícia e planos ilustrativos |
| `pnpm bootstrap` | Criar administrador com MFA |
| `pnpm typecheck` | Verificar TypeScript da API e do frontend |
| `pnpm build` | Build otimizado Next.js |
| `pnpm test` | Testes unitários e de integração SQLite |
| `pnpm test:load` | Microbenchmark sintético, sem rede |
| `pnpm test:e2e` | Playwright local; exige Chromium instalado |
| `pnpm edge` | Gateway simulador com buffer persistente |

## Organização

- `apps/web`: Next.js App Router, React, TypeScript, Recharts, Lucide, CSS responsivo e componentes próprios.
- `apps/api`: regras de domínio e rotas. Fastify é obrigatório em produção. Transporte HTTP nativo existe apenas para desenvolvimento/teste.
- `apps/worker`: demo, sugestões preventivas, e-mails e retenção.
- `apps/edge-gateway`: simulador, interface de leitura e fila SQLite local.
- `packages/database`: acesso SQL parametrizado, transações e migração PostgreSQL/SQLite.
- `packages/shared`: validação Zod, formulários, cálculos, CSV e regras de alerta.
- `infrastructure`: Docker, Nginx, saúde e configuração de operação.
- `docs`: arquitetura, deploy, operação, verificação, comercial e pendências.
- `tests`: integração, cálculos, segurança, buffer, planilhas, PDF, carga e Playwright.

## Produção

Veja `docs/DEPLOY.md`. As opções são Next.js na Vercel + API/PostgreSQL em VPS, ou tudo por Docker Compose. Não publique `.env`, bancos, dumps ou credenciais. `DB_DRIVER=sqlite` é rejeitado com `NODE_ENV=production`.

Não há conector Omron real habilitado. O modelo da CPU ainda é desconhecido. O código não oferece comandos de liga/desliga, escrita em registradores, varredura de rede ou alteração de setpoints.

## Dependências e reprodutibilidade

O repositório contém `pnpm-lock.yaml`. Use pnpm e `--frozen-lockfile`. Next.js e Nodemailer foram atualizados na 2.1 após auditoria de dependências; resultados atuais estão em `docs/verification/v2.1/`. Os logs de versões anteriores permanecem somente como histórico.

A stack preferida foi adaptada: consultas SQL explícitas em vez de Prisma/Drizzle; CSS e componentes nativos em vez de Tailwind/shadcn; transições CSS em vez de Framer Motion; testes `node:test` em vez de Vitest. Essas diferenças são intencionais e estão descritas no relatório. Next.js, TypeScript, Zod, Recharts, Lucide, Fastify e PostgreSQL permanecem no projeto.
