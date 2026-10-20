# EWS AgroIntelligence — atualização 2.0

Esta atualização reduz digitação em três frentes: Modo Funcionário, reaproveitamento de dados externos e relatórios executivos. Mantém os quatro módulos e o portal EWS. Nenhum deploy foi realizado.

## Atualizar a instalação existente

1. Pare frontend, API e worker. Faça backup do banco e guarde a chave MFA existente. Não substitua `.env` nem apague `.data`.
2. Use o ZIP da atualização em uma pasta nova, preservando o `.env` e o banco da sua instalação. Confira diferenças antes de substituir seus arquivos. A branch `feat/automacao-operacional-v2` existe localmente no trabalho de desenvolvimento; o push está aguardando autorização após bloqueio da revisão automática.
3. Com Node 24 e pnpm 11.25.0, na raiz:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

A migração 002 é aditiva, transacional e registrada em `schema_migrations`. Não reconstrói a tabela de usuários nem descarta produção ou sessões. Pode ser executada novamente. **Não é necessário rodar seed nem resetar a demo ao atualizar.** A migração deve rodar uma vez por implantação, antes de iniciar os processos; não execute migradores simultâneos.

A permissão Operador é armazenada como `users.access_profile=OPERATOR`, sobre a função legada VIEWER, evitando reconstruir o CHECK antigo em SQLite. A API transforma esse perfil no papel efetivo OPERATOR e bloqueia todas as rotas administrativas/financeiras, inclusive leitura. Não altere apenas o campo `role` diretamente no banco: use Equipe e acessos.

## Modo Funcionário

- Gestor: abra **Equipe e acessos**, crie um usuário Operador e informe uma senha inicial exclusiva. Convites dependem de SMTP.
- Abra **Equipe operacional**, selecione o usuário, marque os galpões permitidos e escolha o habitual. Operadores e técnicos sem atribuição veem uma orientação para procurar o gestor.
- Confirme a população atual de cada galpão. Não presumimos que a quantidade legada está atualizada. A confirmação é válida por até 30 dias para reaproveitamento; uma alteração de aves exige novo registro. Há apenas uma confirmação por galpão/data; valores conflitantes não são substituídos automaticamente.
- O operador entra normalmente e é direcionado para `/app/staff`. Ele informa ovos ou um problema; não preenche energia nem custos. A data usa o fuso da granja. O galpão habitual vem preenchido.
- Operadores registram somente o dia atual. A chave galpão/data evita duplicação: mesmo valor retorna confirmação idempotente, valor diferente exige gestor. O gestor pode marcar “Confirmar correção” e informar uma data anterior.
- Ocorrências entram na mesma tabela usada pelo Monitor, com categoria, descrição e equipamento autorizado. Elas **não** acionam controle industrial.
- Ordens: no cadastro existente, use o **e-mail ou ID do técnico** em Responsável e avance a ordem para Atribuída. O técnico vê apenas suas ordens dos galpões permitidos, inicia, marca o checklist original, registra duração/relatório e conclui. O operador pode consultar tarefas atribuídas, mas não executa ordens técnicas.
- O histórico mostra até 30 lançamentos recentes. A conclusão de hoje é consultada separadamente e não fica limitada a esses 30 registros.
- O link direto do galpão, disponível em Equipe operacional, pode ser impresso em QR Code. Continua exigindo login e autorização; o QR não contém credencial.

## Integrações de dados

Acesse **Configurações → Integrações de dados**, também disponível na navegação.

### Recursos e formatos

| Destino | Campos | Observações |
|---|---|---|
| Produção | barn_id, day, eggs, birds | birds opcional se houver população confirmada válida para a data |
| População | barn_id, day, birds | Atualiza a população do galpão sem retroagir sobre o último registro válido |
| Energia | meter_id, day, kwh, evidence | Consumo diário, não contador acumulado; não usa horas de motores |
| Custos | name, barn_id, day, category, amount_cents | Galpão opcional; categoria Ração, Mão de obra, Transporte ou Outros; centavos inteiros |

O formulário associa campos do banco aos nomes exatos das colunas. Os modelos ficam salvos por empresa. IDs dos galpões e medidores aparecem em “Referências para o arquivo”. Referências de outra empresa são rejeitadas. Datas são AAAA-MM-DD; CSV usa vírgula como separador, números com ponto decimal e aspas quando necessário. XLSX lê a primeira aba, aceita datas seriais em campos mapeados para `day` e rejeita fórmulas. Máximo: 1.000 linhas e arquivo de 1,5 MB; XLSX tem limites adicionais de expansão.

Exemplo de CSV para o mapeamento inicial:

```csv
galpao,data,ovos,aves
UUID_DO_GALPAO,2026-10-19,19500,22000
```

**Validar sem gravar** executa as mesmas validações/transações e desfaz tudo. **Importar** grava o lote integralmente ou nenhum registro. O histórico inclui resultado e erro com a linha. A origem é IMPORTED; em empresa demo, SIMULATED. Informações manuais permanecem MANUAL, e leituras do gateway continuam distinguindo MEASURED.

Deduplicação: o conteúdo mapeado de cada registro é identificado por hash dentro da fonte; reenvio do mesmo arquivo não duplica registros. Produção e energia também validam suas chaves diárias entre fontes. Conflitos com valores existentes exigem revisão/correção autorizada, sem sobrescrita silenciosa. Para custos, mantenha uma fonte estável e descrições que identifiquem cada lançamento: dois custos com todos os campos idênticos na mesma fonte são tratados como repetição. Não troque de fonte para tentar reprocessar um mesmo custo.

Arquivos com falha ficam retidos no banco por até 7 dias para reprocessamento; após isso, envie novamente. Arquivos concluídos são removidos do histórico, preservando metadados/hashes. Os dados ficam sujeitos às mesmas regras de backup/acesso do banco. Não envie senhas ou dados desnecessários em planilhas.

### API de envio

Crie uma fonte do tipo API. Copie o token exibido uma vez. Ele é armazenado apenas como hash e pode ser rotacionado; o anterior deixa de funcionar. O token identifica a fonte e a empresa, sem aceitar `tenant_id` escolhido pelo remetente.

```http
POST /api/import-feed
Authorization: Bearer TOKEN_DA_FONTE
Content-Type: application/json

{"rows":[{"galpao":"UUID_DO_GALPAO","data":"2026-10-19","ovos":19500,"aves":22000}]}
```

Os nomes das propriedades seguem o mapeamento da fonte. Alternativamente envie `{"content":"CONTEUDO_CSV"}` ou XLSX em Base64 conforme o formato configurado. Não envie `rows` e `content` juntos. Fontes desativadas e assinaturas suspensas são rejeitadas. A API pública não usa cookie/CSRF, mas exige Bearer, limite de corpo, validação e limite de requisições.

### Arquivo HTTPS programado

1. Configure uma chave MFA de 64 caracteres hexadecimais em `MFA_ENCRYPTION_KEY` e mantenha-a estável. Credenciais HTTPS usam a mesma criptografia AES-GCM dos segredos MFA.
2. Acrescente ao `.env` do worker os **hosts exatos** permitidos:

```dotenv
IMPORT_ALLOWED_HOSTS=exportacao.seu-fornecedor.com,arquivos.sua-granja.com
```

3. Crie a fonte HTTPS, informe URL sem query string, formato, token Bearer opcional, mapeamento e intervalo de 15 minutos a 7 dias. A URL é um arquivo fixo que o fornecedor atualiza.
4. Mantenha o worker ativo. “Sincronizar” antecipa a próxima execução. Fonte desativada não é coletada.

O downloader exige TLS válido, porta 443, hostname autorizado e DNS resolvendo exclusivamente IPv4 públicos. Recusa IP literal, credenciais/query na URL, IPs privados/reservados e redirecionamentos. A conexão usa o endereço DNS já validado, mantendo SNI/verificação do certificado, para evitar troca de DNS entre validação e conexão. Timeout total de requisição: 15 s; limite de corpo: 1,5 MB. O destino precisa aceitar Bearer; endpoints com autenticação distinta precisam de adaptação explícita.

Nesta versão **não há conector SFTP, ERP, Google Drive ou Omron**. O requisito inicial de arquivo programado foi implementado pela opção HTTPS. Os conectores futuros podem usar a mesma validação/transação e os mesmos registros.

## Relatórios programados

Abra **Relatórios programados** pela navegação ou Configurações. Escolha frequência, horário/fuso, galpões, indicadores e destinatários. Destinatários precisam ser usuários ativos OWNER ou MANAGER da mesma empresa; o acesso é revalidado imediatamente antes de cada envio. Não basta informar um e-mail arbitrário.

- Diário: dia anterior completo. Semanal: sete dias anteriores, no dia da semana configurado.
- Nenhum galpão selecionado: toda a granja; medição geral não é rateada nos relatórios por galpão.
- Inclui ovos por ave-dia, produção por galpão, energia/tarifa, comparações quando há cobertura compatível, ocorrências e ordens. Estados de equipamentos e pendências são atuais, identificados como tal.
- Comparações sem base positiva ou com registros faltantes ficam indisponíveis. População diária vem dos registros de produção. Aumento de energia acima de 20% gera ponto de investigação, não diagnóstico nem promessa de economia.
- O e-mail é HTML responsivo, com identificação explícita de demonstração e “Sem dados”. A prévia HTML pode ser baixada. O PDF sob demanda continua em Relatórios, com autenticação; não são enviados anexos PDF automaticamente nesta versão.
- SMTP usa a configuração já existente (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Exige TLS no worker; testes locais de SMTP não representam entrega na caixa de entrada de um provedor.
- Sem SMTP, relatórios podem ficar pendentes na fila. Sem agendamentos, nenhuma mensagem de relatório é criada.
- Há chave única por agendamento/destinatário/data local, locks com vencimento no banco e Message-ID estável. Falhas têm até cinco tentativas com espera crescente; o histórico permite nova tentativa controlada.
- SMTP não oferece exatamente uma entrega: queda do processo após aceitação pelo servidor e antes da confirmação no banco pode causar reenvio. Não prometemos ausência absoluta de duplicatas. Reagendamento não gera outro envio para o mesmo destinatário na mesma data já processada.
- Um relatório pendente que perdeu destinatário autorizado ou foi desativado é cancelado. O HTML enviado é retido por 30 dias; depois o worker limpa o corpo e mantém metadados. Não há envio WhatsApp.

## Operação e produção

Execute uma instância do worker inicialmente. Locks por execução evitam concorrência nas novas tarefas e se recuperam após 10 minutos de interrupção. O worker identifica importações interrompidas há mais de 15 minutos para reprocessamento. Para aumentar concorrência ou volume, homologue PostgreSQL e dimensionamento antes.

No Docker, o worker já possui rede de saída para HTTPS/SMTP; banco e API continuam internos. O Dockerfile agora copia o lockfile e usa instalação congelada. Antes da atualização em produção: backup restaurável, migração em homologação, testes PostgreSQL, validação da imagem, certificados, origem HTTPS, chave MFA e SMTP. Consulte também os guias existentes de deploy, HTTPS e backup.

Na Vercel, mantenha frontend separado da API/worker e configure o endereço interno/proxy conforme o guia original. Tarefas programadas não rodam no frontend da Vercel; precisam do worker persistente na VPS.

## Verificação desta entrega

Consulte `verification/v2/` e `ENTREGA_2_0.md`. Não confunda build bem-sucedido com homologação visual ou industrial. A inspeção visual deste ambiente foi bloqueada pela política do navegador na sessão; não houve tentativa de contorná-la. O roteiro Playwright foi acrescentado para execução local:

```bash
pnpm exec playwright install chromium
pnpm dev
# Em outro terminal:
pnpm test:e2e
pnpm test:e2e:v2
```

O roteiro V2 usa somente empresa demo, cria fixtures, testa 360, 390, 768, 1024 e 1440 px, produção, ocorrência, acesso financeiro negado e novas páginas. Ao terminar, suspende o operador criado; um reset de demo pode limpar os demais registros. Não execute em uma demo compartilhada com demonstração comercial em andamento.
