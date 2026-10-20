# Domínio e HTTPS

1. Crie registro A para o IPv4 da VPS. Crie AAAA somente se o IPv6 estiver realmente configurado.
2. Autorize entrada 80/443 e SSH apenas conforme a política operacional. Não abra interfaces industriais ou PostgreSQL.
3. Obtenha certificado de uma autoridade confiável. No Ubuntu, Certbot com desafio HTTP pode emitir usando `--standalone` enquanto a porta 80 estiver livre; siga a documentação oficial: https://certbot.eff.org/ . A instalação/renovação depende do domínio e não foi executada nesta entrega.
4. Copie de forma protegida o certificado completo e a chave para `certificates/fullchain.pem` e `certificates/privkey.pem`. Não versione essa pasta. O Nginx só inicia com arquivos válidos.
5. Inicie Nginx e valide HTTPS, redirecionamento HTTP e cadeias do certificado.
6. Automatize renovação, atualização desses arquivos e `docker compose -f docker-compose.production.yml exec nginx nginx -s reload`. Teste a renovação antes de depender dela. Não confunda copiar certificados uma vez com renovar automaticamente.

A API exige APP_ORIGIN com HTTPS em produção. `Secure` é ativado nos cookies, e o proxy adiciona HSTS. Não remova essas proteções para resolver erro de configuração. Configure a origem correta e o proxy.
