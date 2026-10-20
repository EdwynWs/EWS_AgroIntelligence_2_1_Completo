#!/usr/bin/env bash
set -euo pipefail
curl --fail --silent --show-error --max-time 10 "${AGRO_URL:?Defina a URL HTTPS}/api/health"
