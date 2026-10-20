# Diagnóstico e decisões da versão 2.1

Base: repositório EdwynWs/EWS_AgroIntelligence_2_0, commit e32bf64. Trabalho somente na branch feat/agrointelligence-production-ready-2-1. Não houve deploy nem alteração da main.

## Problemas comprovados e tratados

| Severidade | Problema | Correção / evidência |
|---|---|---|
| Alta | Reset de senha marcava active=1 e reativava conta desabilitada | Recuperação recusa conta inativa; regressão automatizada |
| Alta | Rotas de configurações/atribuições não verificavam suspensão | Verificação central de assinatura em rotas de tenant, exceto autenticação/admin |
| Alta | Buffer cheio impedia executar flush após reconexão | Drenagem antes da coleta; preservação e acumulação durante indisponibilidade; testes |
| Alta | ACK com contagens negativas ou fracionárias podia apagar fila | Contadores inteiros não negativos com soma exata |
| Alta | Totais de manutenção restritos às primeiras 100 ordens | Agregação SQL separada da paginação de cartões; teste com 120 ordens |
| Alta | Alterar galpão do medidor reatribuía todo o histórico | Escopo de medidor com leituras torna-se imutável |
| Média | Reenvio de ocorrência após resposta perdida duplicava lançamento | Chave por usuário, hash do payload e resposta persistida na mesma transação |
| Média | Abas EWS se sobrepunham no celular e reutilizavam dados ao trocar de tela | Largura intrínseca nas abas e estado separado por tela; verificação em navegador |
| Média | Leituras de sessão consumiam o limite de tentativas de login | Limite estrito aplicado às operações POST de autenticação; teste com 35 leituras e 31 tentativas |
| Média | Datas como 30/02 eram aceitas em filtros | Validação de calendário por round-trip ISO |
| Média | XLSX vazio ou cabeçalho esparso causava erro inconsistente | Validação explícita de ambos os casos |
| Média | Dias sem tarifa apareciam no gráfico com custo zero | Custo diário ausente torna-se null |
| Média | Prevenção aceitava contador ambíguo e ignorava assinatura | Um contador confiável, validade específica da tag e assinatura elegível |
| Média | Worker não tinha confirmação de saúde persistida | Heartbeat de ciclo completo, diagnóstico EWS e healthcheck Docker |
| Média | Documentação não explicava a subpasta do ZIP/repositório | Guias PowerShell/bash corrigidos |
| Alta/Crítica (pacotes) | Auditoria inicial reportou 21 avisos em Next/Nodemailer | Next 16.3.8, Nodemailer 10.1.7; nova auditoria e regressão de SMTP/build |

O aviso crítico GHSA-vcvr-r3jv-pc5j exige uso específico de ImageResponse com SVG controlado pelo atacante, não encontrado no código. Não foi declarada exploração do produto. A atualização também cobre os demais avisos reportados pelo registro.

## Decisões de arquitetura

- Manter monólito e contratos existentes. Novas rotas de operação, geração de recebíveis e manutenção preventiva foram extraídas em módulos próprios.
- Migrações 001 e 002 não foram alteradas. A 003 adiciona tabelas, colunas e índices. Backup é obrigatório antes da aplicação em instalação existente.
- SQLite permanece exclusivo de desenvolvimento/teste. PostgreSQL continua obrigatório para produção.
- Não habilitar RLS sem homologar papéis distintos para API, migrations, EWS e worker. Proprietários das tabelas podem contornar RLS por padrão; uma política inserida sem modelar os papéis não prova segregação. Autorização por tenant e FKs compostas continuam sendo as defesas implementadas. Referência: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Uma instância do worker permanece a configuração suportada. Leases e transações reduzem duplicações; não garantem entrega SMTP exatamente uma vez.
- Recorrência gera recebíveis locais, sem cobrança externa. O webhook HMAC existente continua sendo um contrato interno, não um adaptador Asaas/Mercado Pago.
- Offline: aviso e preservação do formulário enquanto a página permanece aberta. Não há persistência de rascunho após fechar/recarregar nem sincronização offline automática.

## Limites que bloqueiam homologação comercial plena

PostgreSQL e Docker não estavam instalados; apt-get falhou por restrições de setgroups/seteuid do ambiente. Não foi usado banco de cliente como substituto. Os testes PostgreSQL e a restauração estão preparados no CI, mas precisam de uma execução efetiva com evidência antes do piloto.

Omron físico depende de modelo, firmware, interface, mapeamento autorizado e bancada. SMTP do cliente, entregabilidade, HTTPS público, provedor de cobrança e consumo em VPS representativa dependem de ambiente externo. Testes em Chromium emulado não equivalem a testes em iPhone/Safari físico.

Não houve auditoria externa, pentest independente ou certificação WCAG/LGPD. Consultas SQL parametrizadas, autenticação e testes de tenant não eliminam todos os riscos possíveis.
