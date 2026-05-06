#!/usr/bin/env bash
set -euo pipefail

required=(
  "apps/backend"
  "apps/dashboard"
  "apps/website"
  "apps/mobile"
  "packages/api-client"
  "packages/config"
  "packages/i18n"
  "packages/shared"
  "packages/types"
  "docker"
  "docs"
  "specs"
)

for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required path: $path"
    exit 1
  fi
done

echo "Folder structure verification passed"
