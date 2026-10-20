> Para a atualização 2.0, veja `ENTREGA_2_0.md` e as evidências em `verification/v2/`. O conteúdo abaixo registra a entrega inicial.

# Testes e verificação

## Executados neste ambiente

- Next.js build otimizado e TypeScript (frontend/API).
- 36 testes com `node:test`, banco SQLite real em memória e regras da API reais.
- Migração idempotente, CRUD, papéis, isolamento entre empresas e FKs compostas.
- Credenciais, CSRF, origem, MFA RFC 6238 e proteção de replay.
- Ingestão atômica, deduplicação, dados inválidos, timestamps e rotação de gateway.
- Alertas com histerese, duração, silenciamento e prevenção de duplicação.
- Ordem de serviço com sequência, responsável, checklist e encerramento.
- Tarifas, escopo energético, custos, cobertura de operação e produção.
- CSV/XLSX, proteção de fórmulas, PDF válido e anexos isolados por empresa.
- Webhook HMAC, timestamp, duplicidade e conflito de payload.
- Painel comercial sem dados demo; administração de assinatura.
- Persistência do buffer edge entre reinícios, limite, reenvio e confirmação.
- Portabilidade sem credenciais; confirmação de exclusão e preservação de outras empresas.
- Backup SQLite e restauração com integridade/contagens iguais.
- Microbenchmark de 5.000 leituras em 100 lotes e 100 consultas de dashboard, concorrência 1, sem rede.

Evidências brutas: pasta `verification/`. O microbenchmark não mede HTTP, TLS, Fastify, PostgreSQL, VPS, SMTP ou múltiplos clientes simultâneos.

## Ainda não executados

O ambiente não tinha PostgreSQL/Docker/Fastify instalados e o acesso para instalação completa não ficou disponível. A política do navegador bloqueou a inspeção visual. Não houve tentativa de contornar a restrição. Portanto não são afirmados:

- testes reais PostgreSQL ou restore PostgreSQL;
- execução da imagem Docker;
- equivalência HTTP do transporte Fastify;
- screenshots ou verificação de responsividade em navegador;
- Playwright executado;
- entrega de SMTP, cobrança de fornecedor ou conexão Omron.

## Como executar localmente

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:load
pnpm exec playwright install chromium
pnpm dev
```

Em outro terminal, com a demo habilitada:

```bash
pnpm test:e2e
```

O script Playwright testa 360/390/768/1024/1440, landing, login demo, módulos, cadastros, busca, modo escuro, overflow, console e respostas de API. Ele cria unidades fictícias; restaure a demo depois. O script é entregue, mas não foi validado no navegador deste ambiente.

Teste PostgreSQL descartável:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

Não aponte testes para bancos reais. A suíte PostgreSQL só permite apagar o esquema do banco `agro_test`. Após testar, rode `docker compose -f docker-compose.test.yml down`.
