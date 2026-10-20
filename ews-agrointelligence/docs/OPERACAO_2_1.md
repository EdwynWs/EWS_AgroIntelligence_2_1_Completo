# Operação da plataforma 2.1

## Proprietário / gestor

Cadastre unidade, galpões e equipamentos em Cadastros. Registre capacidade e população real; confirme a população na Equipe operacional antes de pedir lançamentos ao funcionário. A confirmação tem validade de 30 dias. Não se presume população a partir da produção ou do motor.

Equipe e acessos permite criar Operador, Técnico, Gestor e Leitor conforme permissões. Atribua galpões e preferência em Equipe operacional. O link do galpão pode ser convertido em QR sem credenciais; autenticação continua obrigatória.

## Funcionário

Selecione o galpão autorizado, informe ovos e salve. A data é a da granja; operador/técnico não alteram datas anteriores. Repetir a mesma produção não duplica o registro; corrigir valor diferente exige gestor e confirmação. O histórico de operador/técnico é filtrado por seus lançamentos auditados. A conclusão diária mostra o estado do galpão, mesmo quando outro funcionário lançou.

Ocorrência: escolha equipamento, categoria e breve descrição. Reenvios do mesmo formulário usam uma chave idempotente. Alterar os campos inicia uma nova solicitação. Sem conexão, aguarde para salvar. Fechar a página perde campos não enviados; não há sincronização offline.

Operador consulta tarefas. Execução/checklist exige perfil Técnico ou gestão e tarefa atribuída ao usuário, com galpão autorizado. Inicie antes de concluir e complete checklist/relatório.

## Monitor

Estados só são operacionais com leitura válida e recente da tag de estado. Sem tag de estado, há estado desconhecido; sem leitura válida/recente, não se presume funcionamento. Ajuste validade e intervalos das tags com autorização técnica. Alertas, histerese, duração e encerramento preservam trilha. Não é sistema de segurança industrial nem comando do CLP.

## Predict

Planos podem usar horas, ciclos ou calendário. Em calendário, informe periodicidade em dias e próxima data. Em ciclos, informe periodicidade e próximo contador. Em horas, os campos legados permanecem compatíveis. Campos que não pertencem ao critério escolhido não são usados na geração.

Para horas/ciclos, deve haver exatamente uma tag do critério no equipamento, qualidade GOOD e leitura dentro da validade configurada. Contadores ambíguos/desatualizados não geram ordem. Calendário atrasado gera uma ordem de atenção e avança para a próxima janela, sem criar dezenas de ordens retroativas. Planos não são uma IA de previsão de falha.

Inspeções têm registros próprios com equipamento, data, checklist, resultado e evidências. Ordens mantêm prioridade, responsável, peças, mão de obra, duração e relatório. A lista do dashboard mostra até 100 cartões; indicadores contabilizam todo o escopo. MTBF exige cobertura completa; ausência de dados não significa zero falhas.

## Energy / Performance

Medidores são gerais ou por galpão. Consumo é diário, não contador acumulado. Valide diferenças antes de importar registradores cumulativos. Medidor com histórico não pode mudar de galpão: cadastre outro. Não misture medição geral e setorial no mesmo dia. Tarifas não podem se sobrepor; dia sem tarifa tem custo ausente.

Performance usa população por ave-dia e produção registrada. Custo operacional, energia estimada e manutenção são rubricas separadas; evite dupla contabilização na gestão. Faturas gerais não são rateadas automaticamente. Oportunidades verificadas exigem base, comparação, metodologia, evidências e ajustes, sem atribuição automática de economia ao software.

## Importação

Crie fonte, selecione recurso/formato e mapeie nomes das colunas. Faça prévia, corrija a linha indicada e importe. Um erro desfaz o lote; registro diário conflitante exige correção explícita. Formatos: CSV e primeira aba XLSX sem fórmulas, até 1.000 linhas. Identificadores devem pertencer à empresa. API usa token por fonte, mostrado uma vez e rotacionável. HTTPS só permite hosts públicos explicitamente autorizados; nenhuma URL privada de CLP é aceita.

## Relatórios

PDF e CSV exigem sessão autorizada. PDF apresenta período, produção, energia, manutenção, ocorrências, metodologia e origem. Ausência de dados é explícita. CSV tem limite de 10.000 registros por recurso; exportação integral usa CLI administrativa protegida. Relatórios programados enviam HTML a proprietários/gestores ativos da empresa. Destinatários são revalidados no envio; retries preservam identidade da mensagem, mas SMTP não garante exatamente uma entrega.

## Portal EWS

Clientes, planos, testes, suspensão, cobranças manuais, leads, suporte e auditoria permanecem disponíveis. Recorrências geram contas a receber mensais para assinaturas ativas, com um agendamento ativo por empresa e dia 1–28. A próxima data pode ser editada; ocorrências já geradas são deduplicadas. Suspensão/cancelamento bloqueia novas gerações, sem apagar dívidas. Uma execução atrasada recupera um mês por ciclo para evitar explosão de trabalho.

Saúde operacional apresenta último ciclo completo do worker, filas por estado e gateways. Ausência de confirmação por 180 segundos é sinalizada. Investigue logs, banco, SMTP e fontes HTTPS; healthcheck não substitui monitoramento externo.

MRR usa assinaturas ativas e preço vigente do plano; não é receita recebida. Contagem de cancelamentos não é taxa de churn. Não há taxa de churn histórica homologada nesta versão.
