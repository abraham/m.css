#!/bin/sh
# Runs the visual tests in the Playwright image that matches the pinned @playwright/test, so screenshots match CI.
set -eu
cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').devDependencies['@playwright/test']")
exec docker run --rm --ipc=host -v "$PWD":/work -v /work/node_modules -w /work \
  "mcr.microsoft.com/playwright:v$version-noble" \
  sh -c 'npm ci --no-audit --no-fund && npx playwright test --grep @visual "$@"' -- "$@"
