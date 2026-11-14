#!/bin/bash
# npmverify.sh REGISTRY REPO PKGDIR... : install the given packages (exact local versions) from REGISTRY into an empty
# folder with npm, then import every exported JS entry in Node. Browser-only entries are reported, not failed.
REG=$1 R=$2; shift 2; abs=(); for d in "$@"; do abs+=("$(cd "$R" && cd "$d" && pwd)") || exit 1; done; set -- "${abs[@]}"; T=$(mktemp -d -t npmverify.XXXX); cd $T; echo '{"type":"module","private":true}' > package.json
specs=(); for d in "$@"; do s=$(node -p "const m=require('$d/package.json');m.name+'@'+m.version") && [ -n "$s" ] || { echo "## cannot read $d/package.json"; exit 1; }; specs+=("$s"); done
[ ${#specs[@]} -gt 0 ] || { echo "## no packages given"; exit 1; }
# A version (or a brand-new package name) can stay invisible to npm install for a minute or two after
# publishing: retry E404 / ETARGET a few times before failing.
for try in 1 2 3 4; do
  timeout 900 npm install --prefer-online --registry $REG --no-audit --no-fund "${specs[@]}" > install.log 2>&1 && break
  grep -qE "E404|ETARGET" install.log && [ $try -lt 4 ] || { echo "## npm install FAILED"; tail -15 install.log; exit 1; }
  echo "   (npm does not see every version yet, retrying in 60s)"; sleep 60
done
echo "## installed ${#specs[@]} packages"
# Optional peers are what a consumer of a platform entry (./browser, ./node) installs: add them, so those entries
# are imported for real rather than failing on a package the consumer is expected to provide.
opt=$(node -e '
const fs=require("fs"),out=new Set();
// The tested packages and, transitively, their @statewalker dependencies: an app using a package also
// provides the optional peers of the statewalker packages it pulls in.
const seen=new Set(), todo=process.argv.slice(1).map((s)=>s.slice(0,s.lastIndexOf("@")));
while (todo.length) { const n=todo.pop(); if (seen.has(n)) continue; seen.add(n);
  let m; try { m=JSON.parse(fs.readFileSync("./node_modules/"+n+"/package.json","utf8")); } catch { continue; }
  const meta=m.peerDependenciesMeta||{}, peers=m.peerDependencies||{};
  for (const k of Object.keys(meta)) if (meta[k].optional && peers[k] && !fs.existsSync("./node_modules/"+k)) out.add(k+"@"+peers[k]);
  for (const d of Object.keys(m.dependencies||{})) if (d.startsWith("@statewalker/")) todo.push(d); }
console.log([...out].join("\n"));' "${specs[@]}")
if [ -n "$opt" ]; then mapfile -t optarr <<< "$opt"; timeout 900 npm install --prefer-online --registry $REG --no-audit --no-fund "${optarr[@]}" > install-opt.log 2>&1 || { echo "## optional peers install FAILED"; tail -8 install-opt.log; exit 1; }; echo "## installed optional peers: $(echo "$opt" | tr -d '"' | tr '\n' ' ')"; fi
# Stylesheets are for a bundler: a loader hook turns .css into an empty module. Node still resolves the
# file first, so a missing stylesheet still fails.
cat > css-loader.mjs <<'JS'
export async function load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  return next(url, context);
}
JS
echo 'import { register } from "node:module"; register("./css-loader.mjs", import.meta.url);' > register-css.mjs
ok=0 bad=0
for s in "${specs[@]}"; do n=${s%@*}
  for sub in $(node -p "const e=require('./node_modules/$n/package.json').exports; Object.keys(typeof e==='object'&&!e['.']&&!Object.keys(e).some(k=>k.startsWith('.'))?{'.':1}:e||{'.':1}).filter(k=>!/\.json$/.test(k)&&!k.includes('*')).join(' ')"); do
    spec=$n${sub#.}
    out=$(timeout 60 node --import ./register-css.mjs --input-type=module -e "await import('$spec')" 2>&1) && ok=$((ok+1)) || { if echo "$out" | grep -qE "is not defined|window|document|self is not|navigator|indexedDB|Worker|HTMLElement|customElements"; then echo "   browser-only: $spec ($(echo "$out" | grep -m1 -oE '[A-Za-z]+Error: .{0,80}'))"; ok=$((ok+1)); else echo "   IMPORT FAILED: $spec: $(echo "$out" | grep -m1 -E 'Error' | cut -c1-200)"; bad=$((bad+1)); fi; }
  done
done
echo "## imports ok=$ok failed=$bad"; rm -rf $T; [ $bad = 0 ] && [ $ok -ge ${#specs[@]} ]
