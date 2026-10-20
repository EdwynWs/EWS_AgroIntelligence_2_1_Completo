#!/usr/bin/env bash
set -euo pipefail
umask 077
mkdir -p backups
backup_file="backups/agro-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.production.yml exec -T db pg_dump -U agro -d agro -Fc > "$backup_file"
if [ ! -s "$backup_file" ]; then echo 'Backup vazio' >&2; exit 1; fi
sha256sum "$backup_file" > "$backup_file.sha256"
printf 'Backup criado: %s
' "$backup_file"
