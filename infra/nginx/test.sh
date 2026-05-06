#!/usr/bin/env bash
set -euo pipefail

nginx -t -c "$(pwd)/docker/nginx/nginx.conf"
echo "Nginx configuration OK"
