#!/bin/bash
# ci-local.sh REPO_DIR : run the steps of statewalker/statewalker-ci's ci.yml locally; prints the first failing step.
# The main checkout of statewalker-root (also when run from a worktree of it): repos/ lives there.
H=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
C=$(git -C "$H" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
if [ "$(basename "$C")" = ".git" ]; then D=$(dirname "$C"); else D=$H; fi
S=${SW_CI_SCRIPTS:-${SW_REPOS:-$D/repos}/.github/scripts}
cd "$1" || exit 2
step() { local name=$1; shift; if ! "$@" >/tmp/ci-local-$$.log 2>&1; then echo "FAIL $name"; tail -40 /tmp/ci-local-$$.log; rm -f /tmp/ci-local-$$.log; exit 1; fi; echo "ok   $name"; }
step install pnpm install --frozen-lockfile
step conventions node $S/check-conventions.mjs
step lint pnpm run --if-present lint:check
step format pnpm run --if-present format:check
step build pnpm run --if-present build
step typecheck pnpm run --if-present typecheck
step test pnpm run test
step exports node $S/check-exports.mjs
step dist-imports node $S/check-dist-imports.mjs
step pack node $S/check-pack.mjs
rm -f /tmp/ci-local-$$.log
