# Implantação em Ubuntu 24.04 LTS

**Configuração preparada, não executada neste ambiente.** Antes de conectar clientes, valide PostgreSQL, Fastify, Docker, HTTPS, e-mail, MFA, backup e Playwright. Não use os resultados SQLite como comprovação de funcionamento no PostgreSQL.

## A. Docker Compose em VPS

1. Instale Docker Engine e o plugin Compose pelo repositório oficial para Ubuntu: https://docs.docker.com/engine/install/ubuntu/ . Confirme `docker version` e `docker compose version`.
2. Copie o projeto para uma pasta dedicada, com usuário de implantação e acesso SSH restrito. Entre em `ews-agrointelligence/` antes de executar os comandos Compose.
3. Faça a primeira instalação com acesso ao npm, use o lockfile versionado e rode os testes. O Dockerfile da atualização 2.0 copia `pnpm-lock.yaml` e usa `--frozen-lockfile`. A instalação congelada foi verificada; a imagem Docker ainda precisa ser homologada.
4. Copie `.env.example` para `.env` e proteja com `chmod 600 .env`.
5. Gere senhas e chave MFA sem valores padrão. Use senha hexadecimal em `POSTGRES_PASSWORD`, pois ela compõe a URL do banco. Configure:

```dotenv
NODE_ENV=production
DB_DRIVER=postgres
APP_ORIGIN=https://agro.seudominio.com.br
ENABLE_DEMO=false
MFA_ENCRYPTION_KEY=COLOQUE_64_CARACTERES_HEXADECIMAIS
POSTGRES_PASSWORD=COLOQUE_UMA_SENHA_FORTE_HEXADECIMAL
ADMIN_EMAIL=seu-email
ADMIN_PASSWORD=sua-senha-unica
```

Os serviços internos recebem DATABASE_URL do Compose. A chave MFA precisa de backup separado e protegido; perdê-la impede validar os segredos existentes.

6. Configure certificado válido e DNS conforme `HTTPS.md`. O Nginx espera `certificates/fullchain.pem` e `certificates/privkey.pem`.
7. Verifique a configuração e construa:

```bash
docker compose -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d db migrate api worker web
docker compose -f docker-compose.production.yml run --rm api node scripts/bootstrap.ts
docker compose -f docker-compose.production.yml up -d nginx
```

8. Cadastre a chave MFA impressa pelo bootstrap no autenticador. Acesse o portal EWS e crie uma empresa. Em produção, provisione o MFA de seu proprietário antes do login:

```bash
docker compose -f docker-compose.production.yml run --rm api node scripts/bootstrap.ts email-do-proprietario
```

Entregue a chave ao titular por canal seguro. Esse comando revoga as sessões anteriores. Não grave o terminal ou divulgue a chave em chamados.

9. Verifique `https://agro.seudominio.com.br/api/health`, login com MFA e um ciclo de cadastro, importação e exportação. Não exponha portas 5432 ou 4000 à internet. O Compose de produção não publica essas portas.
10. Teste restauração e monitore CPU, RAM, disco, latência, quantidade de tags e tamanho da fila do gateway.

Para demo isolada, habilite `ENABLE_DEMO=true`, rode o seed e reinicie API/worker. Toda leitura nesse tenant é marcada SIMULATED. A demonstração é uma conta compartilhada com dados fictícios; considere uma implantação separada para apresentações públicas.

## B. Next.js na Vercel + API/banco na VPS

- Importe seu repositório na Vercel e escolha Root Directory `ews-agrointelligence/apps/web`, preset Next.js e Node 24.
- Habilite acesso aos arquivos fora do diretório raiz do frontend para resolver o workspace.
- Defina `API_INTERNAL_URL=https://api.seudominio.com.br` **antes do build**. As rewrites são compiladas pelo Next.js. Refaça o build se mudar essa URL.
- No backend, `APP_ORIGIN` deve ser o domínio final do frontend, por exemplo `https://agro.seudominio.com.br`, sem barra no final.
- O navegador chama `/api` no domínio do frontend; a Vercel reencaminha para a API. O cookie fica no domínio do frontend. Não mude para fetch direto entre origens sem redesenhar cookie, CORS e CSRF.
- Publique API via HTTPS no Nginx da VPS, mantendo PostgreSQL privado e worker em execução.
- A configuração Nginx fornecida é para a opção A. Para a opção B, remova a rota ao serviço `web` e use o domínio da API no virtual host. Preserve TLS e bloqueie exposição do banco.
- Configure domínio estável no backend. URLs dinâmicas de preview da Vercel não são automaticamente autorizadas por Origin.

Referência: https://vercel.com/docs/monorepos e https://vercel.com/docs/monorepos/monorepo-faq .

## PostgreSQL local para homologar

Defina `POSTGRES_PASSWORD` e execute `docker compose up -d db`. Configure `DB_DRIVER=postgres` e DATABASE_URL para seu PostgreSQL local; aplique migração e seed em banco de desenvolvimento. Nunca use o banco do cliente para testes.

A suíte destrutiva exclusiva de teste é:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml down
```

O banco chama-se `agro_test`, é temporário e não publica porta. A suíte se recusa a apagar esquema em qualquer outro nome de banco. Esse teste ainda não foi executado na entrega.

## Recursos e custos

Não foi validada uma VPS mínima. Para o primeiro ensaio de todos os serviços, reserve como hipótese de engenharia 2 vCPU, 4 GB RAM e espaço para banco + backups; construa a imagem fora da VPS quando possível. Uma VPS de 1 GB não foi homologada e não deve ser vendida como capacidade comprovada.

Estimativa de orçamento, apenas exemplo de cálculo (não cotação): VPS R$ 80 + backup externo R$ 20 + e-mail R$ 0 dentro de uma franquia a contratar + domínio amortizado R$ 4 = R$ 104/mês. Substitua cada valor pela proposta real do fornecedor. PostgreSQL no mesmo servidor não adiciona uma licença, mas consome seus recursos. Não estão incluídos gateway, instrumentos, instalação, suporte, impostos, tráfego excedente, WhatsApp ou provedores de cobrança. Não há garantia de franquia gratuita.

## Atualização 2.1 e gates

Aplique também a migration 003, sem modificar 001/002. O worker possui healthcheck persistido e o Portal EWS mostra filas/gateways. A configuração do Compose continua sem porta pública do PostgreSQL. Na Vercel, o frontend usa Node 24, instalação pnpm a partir do workspace e API_INTERNAL_URL definida no build. Use o domínio exato em APP_ORIGIN.

Antes de produção, execute `.github/workflows/verify.yml` em CI e guarde os logs PostgreSQL, restauração e Docker. Depois homologue o Compose completo com certificados de teste e volumes descartáveis. CI de build de imagem não prova renovação de TLS ou capacidade de VPS. `docs/INSTALACAO_2_1.md` descreve atualização e variáveis.
