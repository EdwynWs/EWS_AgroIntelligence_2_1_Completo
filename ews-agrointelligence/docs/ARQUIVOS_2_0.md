# Arquivos da atualização 2.0

| Área | Alteração |
|---|---|
| API e banco | Perfil operador, atribuições, população, integrações, relatórios e transporte testável |
| Frontend | Modo Funcionário, formulários administrativos, resumo diário, navegação e estilos |
| Worker | Coleta HTTPS, agendamentos, fila de relatórios e retenção |
| Scripts | Preservação das novas relações no reset e na portabilidade/exclusão |
| Testes | Regressão, automação, migração, SMTP, HTTP e roteiro E2E |
| Operação | Variáveis, build reproduzível e guias |

## Lista exata

- `.env.example`
- `README.md`
- `apps/api/src/app.ts`
- `apps/api/src/automation-core.ts`
- `apps/api/src/automation-routes.ts`
- `apps/api/src/fastify-transport.ts`
- `apps/api/src/safe-source.ts`
- `apps/api/src/scheduled-reports.ts`
- `apps/api/src/server.ts`
- `apps/web/app/globals.css`
- `apps/web/app/login/page.tsx`
- `apps/web/components/Automation.tsx`
- `apps/web/components/StaffMode.tsx`
- `apps/web/components/Workspace.tsx`
- `apps/web/lib/client.ts`
- `apps/worker/automation.ts`
- `apps/worker/index.ts`
- `docs/ARQUIVOS_2_0.md`
- `docs/ATUALIZACAO_2_0.md`
- `docs/DEPLOY.md`
- `docs/ENTREGA_2_0.md`
- `docs/RELATORIO_ENTREGA.md`
- `docs/TESTES.md`
- `docs/verification/v2/build.txt`
- `docs/verification/v2/tests.txt`
- `docs/verification/v2/typecheck.txt`
- `infrastructure/docker/Dockerfile`
- `package.json`
- `packages/database/migrate.ts`
- `packages/database/migrations/002_automation.sql`
- `packages/shared/resources.ts`
- `scripts/seed.ts`
- `scripts/tenant-data.ts`
- `tests/automation.test.ts`
- `tests/browser-v2.mjs`
- `tests/core.test.ts`
- `tests/transport-migration.test.ts`
