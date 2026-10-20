# Backup e restauração

Produção usa `pg_dump -Fc`; os anexos também estão no banco. Os scripts não enviam dados a nenhum serviço externo.

```bash
./scripts/backup.sh
./scripts/restore-check.sh backups/NOME_DO_BACKUP.dump
```

O segundo comando cria um banco temporário novo, restaura com `--exit-on-error`, consulta contagens e o remove ao finalizar. Não sobrescreve o banco `agro`. Compare contagens, datas e registros críticos com a origem. Uma restauração tecnicamente válida não comprova que o backup contém o período esperado.

Agende um backup diário após definir horário e retenção; copie de forma cifrada para um destino externo autorizado. Exemplo de política inicial a contratar: sete diários e quatro semanais, com teste mensal de restauração. Defina RPO/RTO com o cliente. Não apague automaticamente arquivos nesta entrega.

Guarde também a chave MFA em cofre separado. O banco contém segredos MFA cifrados que dependem dessa chave. Restrinja a leitura de dumps e não os comite.

Para recuperação real, interrompa escritores, preserve uma cópia do estado atual, restaure em um banco novo, compare a integridade, aponte a aplicação para ele e só então reabra o serviço. Não automatizamos troca ou destruição do banco de produção.

Foi verificado backup/restore **SQLite de desenvolvimento**, com `integrity_check=ok` e contagens iguais. PostgreSQL não estava disponível; seu restore permanece pendente. Evidência em `verification/backup-sqlite.json`.

Referências: https://www.postgresql.org/docs/17/app-pgdump.html e https://www.postgresql.org/docs/17/app-pgrestore.html .
