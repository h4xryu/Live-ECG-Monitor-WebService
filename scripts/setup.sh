#!/usr/bin/env bash
# One-shot setup after `git clone` / `git pull`: installs deps, creates .env.local with a random
# JWT_SECRET if it doesn't exist yet, and builds. Then run `pnpm start`. See docs/ALWAYS_ON.md.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v pnpm >/dev/null; then
  echo "pnpm not found. Install Node.js 18+ then: npm install -g pnpm (or conda activate ecgweb)" >&2
  exit 1
fi

pnpm install --frozen-lockfile

# Never overwrite an existing secret — rotating it logs every user out.
if [ ! -f .env.local ]; then
  secret="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf 'JWT_SECRET=%s\n' "$secret" > .env.local
  chmod 600 .env.local
  echo "Created .env.local with a random JWT_SECRET."
fi

pnpm build

echo
echo "Done. Start the server with: pnpm start   (http://localhost:3000)"
