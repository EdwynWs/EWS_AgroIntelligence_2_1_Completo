A configuração operacional está em `.env.example` e é lida no processo inicial.
O bootstrap de produção rejeita banco SQLite, origem sem HTTPS e chave MFA ausente.
Credenciais de gateway ficam somente em hash SHA-256; MFA é cifrado com AES-256-GCM.
Não inclua `.env`, bancos, dumps, logs de sessão ou chaves em commits.
