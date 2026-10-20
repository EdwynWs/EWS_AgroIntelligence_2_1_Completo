# Gateway e integração industrial

## Simulador funcional

No portal de uma empresa **demo**, provisione um gateway e copie a credencial exibida uma vez. Cadastre uma tag de temperatura, unidade `C`, intervalo 0–100 e associe-a a esse gateway/equipamento. Configure:

```dotenv
EDGE_API_URL=http://127.0.0.1:4000
EDGE_ALLOW_LOCAL_HTTP=true
EDGE_TOKEN=credencial-do-seu-gateway-demo
EDGE_TAG_ID=uuid-da-tag
EDGE_UNIT=C
EDGE_BUFFER_PATH=.data/edge.sqlite
EDGE_MAX_BUFFER=100000
```

Execute `pnpm edge`. Em uma rede real, EDGE_API_URL deve ser HTTPS e EDGE_ALLOW_LOCAL_HTTP=false. A exceção HTTP só aceita loopback e serve a testes locais.

O simulador produz temperatura sintética com origem SIMULATED. A API rejeita SIMULATED em empresas reais. O buffer SQLite mantém sequência monotônica e lotes pendentes entre reinícios, envia até 100 leituras por chamada e remove somente depois da confirmação integral. Falhas HTTP, timeout ou confirmação incompleta preservam os dados. O backoff cresce até 60 segundos com jitter. Ao encher, a coleta interrompe em vez de descartar silenciosamente.

Instale o gateway sob um usuário dedicado, com diretório persistente, permissão de escrita apenas nesse diretório e env protegido. Configure reinício via systemd ou processo equivalente. Mantenha o relógio sincronizado. Nunca reinicie a sequência reutilizando uma identidade antiga: preserve o buffer ou provisione outra identidade. Rotacionar token mantém o gateway e a sequência; criar outro gateway cria outra identidade.

## Omron: pendência explícita

O arquivo `adapters.ts` define `ReadOnlyAdapter.read(...)`. A função `omronAdapter()` lança erro de indisponibilidade. Não há implementação FINS, Host Link ou OPC UA real nem promessa de compatibilidade universal.

Para desenvolver o primeiro conector:

1. Código completo da CPU, família, firmware, portas e módulos instalados.
2. Manual oficial correspondente, mapa de tags/endereços/tipos/unidades e autorização escrita de coleta.
3. Responsável de automação, rede segregada e taxas de leitura aprovadas.
4. Bancada ou ambiente de teste isolado, separado da produção.
5. Validação de timestamps, qualidade, reconexão, indisponibilidade, escala, endianess e comportamento em falha.
6. Piloto limitado com aceite do responsável e monitoramento de carga do controlador.

**Limites de desenho:** nenhuma escrita, nenhum método genérico de executar comandos, nenhuma varredura de rede, nenhuma exposição do CLP à internet e nenhuma dependência de nuvem para proteção local. Ventilação, alimentação e segurança continuam no controle local.

A demonstração utiliza somente dados sintéticos. Nenhum programa, projeto ou dado da JCortiça ou de outra empresa foi usado.
