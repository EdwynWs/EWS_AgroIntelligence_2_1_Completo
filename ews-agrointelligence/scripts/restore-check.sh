#!/usr/bin/env bash
# Restores into a NEW disposable database; never overwrites agro.
set -euo pipefail
backup_file="${1:?Informe o dump a verificar}"
test_database="agro_restore_$(date -u +%Y%m%d%H%M%S)"
docker compose -f docker-compose.production.yml exec -T db createdb -U agro "$test_database"
trap 'docker compose -f docker-compose.production.yml exec -T db dropdb -U agro "$test_database"' EXIT
docker compose -f docker-compose.production.yml exec -T db pg_restore -U agro -d "$test_database" --no-owner --exit-on-error < "$backup_file"
docker compose -f docker-compose.production.yml exec -T db psql -U agro -d "$test_database" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS tenants FROM tenants; SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS equipment FROM equipment;'
printf 'Restauração concluída em banco temporário. Verifique as contagens e compare com a origem.
'
