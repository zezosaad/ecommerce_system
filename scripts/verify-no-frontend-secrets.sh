#!/usr/bin/env bash
set -euo pipefail

allowlist_regex='NEXT_PUBLIC_'

scan_dir() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    if rg -n "SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|SUPABASE_JWT_SECRET|JWT_AUDIENCE" "$dir" | rg -v "$allowlist_regex"; then
      echo "Potential secret reference found in $dir"
      exit 1
    fi
  fi
}

scan_dir "apps/dashboard/.next"
scan_dir "apps/website/.next"

echo "No frontend secret leaks detected"
