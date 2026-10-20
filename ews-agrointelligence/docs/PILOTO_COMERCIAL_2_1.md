# Piloto comercial — EWS AgroIntelligence 2.1

## Demonstração de 10 minutos

| Minutos | Ação | Mensagem |
|---|---|---|
| 0–1 | Apresentar situação da granja | Organizar informação e priorizar problemas; sem promessa de economia |
| 1–3 | Dashboard / três galpões fictícios | Produção pendente, atenção operacional e dados desatualizados |
| 3–4 | Modo Funcionário no celular | Selecionar galpão, lançar ovos, comunicar problema |
| 4–5 | Monitor | Qualidade, origem e validade do dado; nunca controle remoto |
| 5–6 | Predict | Inspeção, ordem, responsável, custo e regra preventiva |
| 6–7 | Energy | Consumo e tarifa, fatura separada, sem rateio inventado |
| 7–8 | Performance | Produção, ave-dia, custos e oportunidades com evidência |
| 8–9 | Importação / PDF | Planilha com prévia, histórico e relatório executivo |
| 9–10 | Proposta de piloto | Definir escopo, responsáveis, aceites, preço e prazo |

Use sempre a empresa demo, identificada na interface e nos relatórios. Não demonstre com banco de outro cliente. Confirme API, frontend e worker antes da reunião. Dados fictícios não são testemunho de resultado real.

## Questionário da granja

- Nome comercial, responsável operacional, responsável financeiro e contato autorizado.
- Número de unidades/galpões, capacidade e população atual por galpão.
- Como são registrados ovos, perdas, população, manutenção, energia e custos?
- Quem registra, quem valida e quem precisa receber os relatórios? Quais fusos/turnos?
- Planilhas de exemplo sem dados pessoais desnecessários; formatos, colunas e periodicidade.
- Medição geral ou por galpão? Tarifa, faturas e método de leitura do contador.
- Equipamentos prioritários, histórico de falhas, contadores confiáveis e rotinas de inspeção.
- Rede disponível, estabilidade de internet, uso de celular e restrições de acesso.
- Sistema atual, exportação disponível e autorização de integração.
- Retenção, backup, suporte, horário de atendimento e responsável pelo aceite.

## Checklist industrial — levantamento, sem conectar

Registrar fabricante, modelo exato da CPU, código da fonte, módulos, firmware, modelo da IHM, interfaces físicas e topologia. Obter manual oficial correspondente e lista de tags autorizada: endereço, tipo, escala, unidade, frequência, origem e limite válido. Fotografias somente com autorização, evitando credenciais e informações sensíveis.

Definir um responsável técnico da granja e integrador autorizado. Validar adaptador somente leitura em bancada isolada, com perda de rede, reinício, buffer e reenvio. Não inferir protocolo apenas pela marca Omron. Não executar escrita, alteração de programa ou setpoint. Gateways/sensores e instalação não estão automaticamente incluídos na assinatura.

## Critérios de aceite de piloto (modelo para acordo)

- Escopo explícito: galpões, equipamentos, usuários, módulos e fontes.
- Cada perfil executa suas ações e recebe bloqueio fora do escopo.
- Dados de uma empresa não aparecem para outra em testes autorizados.
- Dez lançamentos representativos conferidos contra a fonte; duplicatas/conflitos rejeitados.
- Uma importação válida e uma inválida, com rollback, histórico e erro de linha.
- Cinco ordens/inspeções verificadas do cadastro à conclusão.
- Relatório conferido pelo gestor; campos ausentes não apresentados como zero ou economia.
- Perda de rede simulada no gateway autorizado; buffer preservado e reenvio sem duplicação.
- Backup restaurado em banco separado e contagens conferidas.
- Telas principais usadas nos aparelhos efetivos do cliente, incluindo Safari se houver iPhone.
- SMTP/HTTPS/monitoramento externo validados no ambiente de homologação.
- Pendências documentadas, responsável e prazo acordados; aceite escrito antes da abertura comercial.

## Planos e custos separados

Os planos iniciais do seed são exemplos configuráveis, não preços obrigatórios. MONITOR inclui monitoramento; PRO acrescenta Predict e Energy; INTELLIGENCE inclui Performance. Os limites de equipamentos/usuários e o preço são administrados no Portal EWS. Confirme escopo e disponibilidade de cada fonte antes de contratar.

Assinatura: acesso à plataforma, módulos, limites e suporte acordados. Implantação: levantamento, cadastro, importação inicial, treinamento, configuração, infraestrutura e eventual integração industrial. Hardware, sensores, conectividade, domínio, SMTP, backup externo e fornecedor de cobrança devem constar da proposta quando aplicáveis.

Não ofereça economia garantida ou compatibilidade Omron sem homologação. Separe prazo de atendimento de prazo de resolução. Disponibilidade contratada exige infraestrutura e monitoramento compatíveis, ainda não medidos em VPS de cliente.

## Pontos para revisão jurídica

Documento técnico, não contrato: delimitar tratamento de dados, papéis das partes, subprocessadores, autorização de coleta, propriedade/exportação dos dados, retenção/exclusão, suporte, aceite, indisponibilidade, pagamentos/cancelamento e responsabilidades do integrador industrial. O SaaS observa dados e apoia decisões; não substitui proteção elétrica, intertravamento, supervisão presencial ou responsável técnico.
