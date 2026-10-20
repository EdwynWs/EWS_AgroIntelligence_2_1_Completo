# SMTP e cobrança

## E-mail

Configure SMTP_HOST, SMTP_PORT, SMTP_FROM e, se necessário, SMTP_USER/SMTP_PASS. Porta 587 utiliza STARTTLS obrigatório; para TLS direto em 465 use SMTP_SECURE=true. Use um remetente autorizado pelo seu provedor. Não desabilite verificação de certificado.

O worker processa até 20 mensagens por ciclo, faz até cinco tentativas com backoff e marca falhas. Mensagens enviadas têm o corpo removido do outbox para reduzir retenção de links sensíveis. Falhas não imprimem senha nem conteúdo nos logs. Convites duram 24 horas; links de recuperação, 30 minutos. A API evita revelar se um e-mail existe.

Sem SMTP, a interface informa indisponibilidade. Alertas internos continuam funcionando. O envio SMTP externo não foi testado, pois não foram fornecidas credenciais.

## Cobrança manual

Cadastre planos e empresas, mude assinaturas e registre cobranças no portal. Ao receber, informe referência do comprovante. O sistema separa faturado, recebido, pendente e vencido. Essa ação registra um recebimento informado; não movimenta dinheiro nem emite boleto/PIX.

MRR usa assinaturas ativas e o preço atual de cada plano. ARR é MRR × 12. Empresas demo são excluídas. Não há reconhecimento contábil, imposto, estorno financeiro ou integração bancária automática.

## Contrato do adaptador de webhook

`POST /api/billing/webhook` fica desativado até `ENABLE_BILLING_WEBHOOK=true` e `WEBHOOK_SECRET` definido. É um contrato interno HMAC, **não** um endpoint diretamente compatível com Asaas ou Mercado Pago.

Corpo JSON, na ordem serializada pelo remetente:

```json
{"id":"evento-unico","charge_id":"UUID-da-cobranca","status":"paid","reference":"comprovante","paid_at":"2026-10-19T15:00:00.000Z"}
```

`x-ews-timestamp`: Unix timestamp em milissegundos, tolerância de 5 minutos. `x-ews-signature`: HMAC-SHA256 hexadecimal de `timestamp + '.' + JSON.stringify(body)` com o segredo compartilhado. Não envie espaços/formatação que alterem a representação esperada.

O evento é único por ID; repetição idêntica é confirmada, conflito de conteúdo é rejeitado. Atualização de cobrança e registro do evento são transacionais. Webhooks não ativam planos automaticamente: a reconciliação de assinatura ainda é administrativa.

Antes de integrar um provedor: implemente seu formato e validação oficiais em adaptador separado, valide conta/valor/moeda/identificador e teste sandbox, estornos, atraso e duplicidade. Não utilize segredos de teste em produção. WhatsApp Business oficial também depende de implementação, conta e custos do fornecedor; não está habilitado.
