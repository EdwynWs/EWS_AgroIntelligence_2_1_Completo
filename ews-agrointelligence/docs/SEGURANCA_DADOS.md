# Segurança, dados e checklist de implantação

## Controles implementados

- Sessões HttpOnly, Secure em produção, SameSite Strict; segredo de sessão armazenado em hash.
- Hash scrypt para senhas; MFA TOTP para administradores em produção, segredo cifrado e proteção contra replay.
- CSRF por token + Origin, autorização por função e módulo na API.
- Tenant derivado da sessão, referências compostas e consultas parametrizadas.
- Limites de lote, corpo, anexos, imports, busca, paginação e rate limiting.
- Credenciais individuais de gateway, rotação/revogação e sem escrita industrial.
- Trilha de auditoria, segregação da demo, identificação de origem e qualidade.
- SQL transactions, idempotência e checagem de divergência em reenvio.
- HTML escapa conteúdo no relatório; React escapa dados; CSV neutraliza fórmulas.
- Arquivos aceitos por lista restrita e assinatura básica, servidos como download com autenticação. Não há antivírus incorporado.

## Governança inicial

A granja define a finalidade dos dados e autoriza a coleta. A EWS documenta operação, acessos, suporte e subprocessadores contratados. Antes do piloto, defina responsáveis, necessidade de cada dado, tempo de retenção, procedimento de atendimento a solicitações, exclusão, cópias de segurança e resposta a incidentes. Este registro técnico não constitui contrato nem certificação de conformidade.

Não colete documentos pessoais ou informações de saúde em chamados/anexos. Nomes, e-mails, funções, eventos de uso e dados industriais devem ter acesso limitado à finalidade contratada. Alertas críticos não dependem da entrega de e-mail.

Exportações CSV da interface têm limite de 10.000 linhas por recurso. Para portabilidade dos registros empresariais ou exclusão de empresa, use o procedimento administrativo `scripts/tenant-data.ts`, em janela autorizada, depois de verificar identidade, alcance e obrigações de retenção. A interface não faz exclusão em massa.

## Checklist obrigatório antes de cliente real

- [ ] Instalar dependências, gerar lockfile e revisar versões.
- [ ] Passar build, TypeScript, testes locais e suíte PostgreSQL.
- [ ] Rodar testes HTTP com Fastify e revisar erros de configuração.
- [ ] Rodar Playwright nas larguras 360, 390, 768, 1024 e 1440.
- [ ] Verificar teclado, foco, contraste, gráficos, formulários e estados vazios.
- [ ] Validar Docker/Compose e recursos da VPS sob carga realista.
- [ ] Ativar HTTPS válido, renovação e monitoramento.
- [ ] Confirmar que banco/API interna não estão expostos.
- [ ] Provisionar MFA do administrador EWS e dos proprietários.
- [ ] Usar segredos distintos e guardar chave MFA em cofre.
- [ ] Testar revogação de usuário, gateway, CSRF e isolamento via rede.
- [ ] Configurar SMTP e testar entrega/falha sem dados sensíveis.
- [ ] Testar backup PostgreSQL e restauração em banco separado.
- [ ] Definir política de retenção, portabilidade e exclusão.
- [ ] Firmar responsabilidades, suporte e critérios de aceite do piloto.
- [ ] Identificar Omron e validar somente leitura em bancada antes da granja.

Não considerar essas caixas preenchidas por existir código ou documentação. Evidências executadas constam no relatório de entrega.

## Procedimento administrativo de portabilidade

Execute em janela de manutenção, com API e worker parados, para impedir mudanças durante a leitura paginada. O export cria um arquivo novo com permissão 0600; não substitui arquivo existente. Senhas, segredos MFA, tokens de gateways, sessões, tokens de recuperação e a fila de e-mails são omitidos. O resultado é NDJSON para consulta/portabilidade, não um backup restaurável. Use pg_dump para backup.

```bash
node --env-file=.env scripts/tenant-data.ts export UUID_DA_EMPRESA exportacao.ndjson
```

Após autorização e revisão das retenções, a exclusão exige repetir o mesmo UUID:

```bash
node --env-file=.env scripts/tenant-data.ts delete UUID_DA_EMPRESA UUID_DA_EMPRESA
```

Essa operação é irreversível sem backup. Foi testada em banco SQLite descartável, incluindo preservação de outra empresa. A homologação PostgreSQL ainda é necessária.
