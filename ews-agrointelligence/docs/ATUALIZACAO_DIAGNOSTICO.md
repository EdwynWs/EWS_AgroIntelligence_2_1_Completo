# Atualização e diagnóstico

## Atualizar

Faça backup e restaure em teste. Versione o código e o lockfile. Construa e teste a nova imagem antes de substituir os serviços. Aplique migrações em uma janela definida; a migração 001 é idempotente, mas futuras alterações precisam de arquivos versionados e estratégia de reversão. Registre versão e data.

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml run --rm migrate
docker compose -f docker-compose.production.yml up -d api worker web nginx
```

Cheque saúde, autenticação, relatórios e ingestão. Em falha, volte à imagem anterior se o esquema for compatível. Se não for, restaure em outro banco e valide antes de apontar a aplicação. Não há rollback automático destrutivo.

## Diagnóstico

| Sintoma | Verificação |
|---|---|
| `Origem não autorizada` | APP_ORIGIN precisa ser exatamente a origem do navegador, incluindo protocolo e porta, sem barra final. |
| Login volta para a tela inicial | Confira cookie Secure/HTTPS, relógio, MFA e expiracão da sessão. |
| Código MFA já utilizado | Espere o próximo código; a aplicação bloqueia replay. |
| Proprietário sem acesso em produção | Cadastre MFA pelo bootstrap e entregue a chave ao titular. |
| Recuperação indisponível | Configure SMTP, remetente, credenciais e worker. |
| `Módulo não incluído` | Verifique plano e estado da assinatura no portal EWS. |
| `Sem comunicação` | Último timestamp, stale_seconds, qualidade, gateway, relógio e conectividade. Não aumente limites para esconder perda de dados. |
| Energia sem custo | Falta tarifa válida ou existem leituras sem cobertura tarifária. |
| Custo por mil ovos ausente | Exige medição por galpão e produção no mesmo dia. Fatura geral não é rateada. |
| Disponibilidade ou MTBF ausentes | Complete operação diária validada para todos os equipamentos e dias do escopo. |
| Importação rejeitada | Use cabeçalhos corretos, IDs da empresa, ponto decimal e datas YYYY-MM-DD. O lote inteiro é revertido. |
| XLSX com fórmula | Salve valores em CSV; fórmulas não são executadas nem aceitas por cache. |
| 429 | Rate limiting. Reduza frequência, confira IP visto pelo proxy e perfis de carga. |
| Buffer crescendo | API/TLS/token, erros de unidade, mapa de tags, relógio ou dados mais antigos que retenção. Não apague o buffer para esconder erros. |
| E-mail repetido após falha | Outbox é at-least-once. Consulte Message-ID e histórico; mantenha só um worker. |
| Falha no Docker build | Gere lockfile em ambiente com npm, confira versões e rode build local antes de publicar. |

API registra tipo de erro e rota sem corpo/credenciais. Para investigação controlada, reproduza em teste. Não adicione logs de tokens, cookies, senhas ou corpo completo em produção.

`docker compose -f docker-compose.production.yml logs --tail=100 api worker` ajuda a verificar falhas. Evite compartilhar logs que contenham dados empresariais. Telemetria histórica é retida conforme política; aumenta continuamente se a limpeza ficar atrás da entrada.
