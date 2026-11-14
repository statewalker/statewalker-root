#!/usr/bin/env node
// packages.mjs — what the managed projects publish, read-only. Plain Node, no dependencies.
// (The non-publishing half of umbrella's former tools/sw.mjs; publishing is CI's job,
// docs/process/README.md §4.)
//
//   node tools/packages.mjs status [project...] [--deep]
//       per project, in dependency order: versions not `latest` on npm, @statewalker references
//       behind npm's latest (and whether only the lockfile or the range must move); --deep also
//       builds and lists the packages whose contents changed since npm (needs repos/.github)
//   node tools/packages.mjs deps <project>
//       the projects that depend on <project>, directly or not, in the order they update
//
// Works on the clones in repos/ (node tools/repos.mjs clone | pull): what their checked-out
// branch holds, normally main. The order is computed from what each project publishes and what its
// lockfile catalogs reference.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CI_SCRIPTS, packageRepos, repoDir } from "./lib/registry.mjs";

const REGISTRY = "https://registry.npmjs.org/";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const [command, ...targets] = argv.filter((a) => !a.startsWith("--"));

const run = (cmd, args, cwd, opts = {}) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"], ...opts });
const say = (s = "") => console.log(s);
const fail = (msg) => {
  throw new Error(msg);
};

const packuments = new Map();
/** npm's packument (cached for the run; null when the package does not exist). */
async function packument(name, fresh = false) {
  if (!fresh && packuments.has(name)) return packuments.get(name);
  const r = await fetch(`${REGISTRY}${name.replace("/", "%2f")}${fresh ? `?t=${Date.now()}` : ""}`, {
    headers: fresh ? { "cache-control": "no-cache" } : {},
  });
  const doc = r.status === 404 ? null : r.ok ? await r.json() : fail(`npm answered ${r.status} for ${name}`);
  packuments.set(name, doc);
  return doc;
}

// Minimal semver for the ranges the catalogs use: ^x.y.z, ~x.y.z, x.y.z, >=x.y.z, *, joined by ||.
const parse = (v) => (/^v?(\d+)\.(\d+)\.(\d+)/.exec(v) ?? []).slice(1).map(Number);
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
function satisfies(version, range) {
  const v = parse(version);
  if (v.length !== 3) return false;
  return range.split("||").some((part) => {
    const p = part.trim();
    if (p === "*" || p === "") return true;
    const m = /^(\^|~|>=|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(p);
    if (!m) return false;
    const base = [Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0)];
    if (cmp(v, base) < 0) return false;
    if (m[1] === ">=") return true;
    if (m[1] === "^") {
      // ^1.2.3 keeps the major; below 1.0 the minor is the breaking line; ^0.0.3 is exact.
      if (base[0] > 0) return v[0] === base[0];
      if (base[1] > 0) return v[0] === 0 && v[1] === base[1];
      return cmp(v, base) === 0;
    }
    if (m[1] === "~") return v[0] === base[0] && v[1] === base[1];
    return cmp(v, base) === 0;
  });
}

// ---------------------------------------------------------------------------------------------
// Repositories: what they publish, what they reference, in which order

/** The cloned projects that have packages. */
const repos = () => packageRepos();

/** Workspace packages of a repository: [{ name, version, private, dir }]. */
function packagesOf(repo) {
  const listed = JSON.parse(run("pnpm", ["ls", "-r", "--depth", "-1", "--json"], repoDir(repo)));
  return listed
    .map((p) => {
      const m = JSON.parse(fs.readFileSync(path.join(p.path, "package.json"), "utf8"));
      return { name: m.name, version: m.version, private: m.private === true, dir: p.path };
    })
    .filter((p) => p.name);
}
const publicPackages = (repo) => packagesOf(repo).filter((p) => !p.private);

/**
 * The @statewalker entries of the lockfile's `catalogs:` section:
 * [{ catalog, name, range, resolved }]. The lockfile records the catalog range and the version it
 * resolved to, which is what "behind npm" is measured against.
 */
function internalCatalogEntries(repo) {
  const file = path.join(repoDir(repo), "pnpm-lock.yaml");
  if (!fs.existsSync(file)) return [];
  const out = [];
  let inCatalogs = false;
  let catalog = null;
  let current = null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (/^\S/.test(line)) {
      inCatalogs = line.startsWith("catalogs:");
      continue;
    }
    if (!inCatalogs) continue;
    let m = /^ {2}(\S[^:]*):\s*$/.exec(line);
    if (m) {
      catalog = m[1].replace(/['"]/g, "");
      continue;
    }
    m = /^ {4}'?(@statewalker\/[^':]+)'?:\s*$/.exec(line);
    if (m) {
      current = { catalog, name: m[1] };
      out.push(current);
      continue;
    }
    if (/^ {4}\S/.test(line)) current = null;
    m = /^ {6}(specifier|version):\s*(.+)$/.exec(line);
    if (m && current) current[m[1] === "specifier" ? "range" : "resolved"] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}

/** Repositories in dependency order (a repository after every repository it references). */
function dependencyOrder(all = repos()) {
  const owner = new Map();
  for (const r of all) for (const p of publicPackages(r)) owner.set(p.name, r);
  const deps = new Map(
    all.map((r) => [r, new Set(internalCatalogEntries(r).map((e) => owner.get(e.name)).filter((o) => o && o !== r))]),
  );
  const order = [];
  const seen = new Set();
  const visit = (r, stack = new Set()) => {
    if (seen.has(r)) return;
    if (stack.has(r)) fail(`dependency cycle through ${r}`);
    stack.add(r);
    for (const d of deps.get(r) ?? []) visit(d, stack);
    stack.delete(r);
    seen.add(r);
    order.push(r);
  };
  for (const r of all) visit(r);
  return { order, deps, owner };
}

/** Repositories that depend on `repo`, directly or not, in dependency order. */
function dependentsOf(repo) {
  const { order, deps } = dependencyOrder();
  const affected = new Set([repo]);
  for (const r of order) if ([...(deps.get(r) ?? [])].some((d) => affected.has(d))) affected.add(r);
  affected.delete(repo);
  return order.filter((r) => affected.has(r));
}

/** Public packages whose local version is not npm's latest: [{ ...pkg, onNpm }]. */
async function unpublished(repo) {
  const out = [];
  for (const p of publicPackages(repo)) {
    const doc = await packument(p.name, true);
    const onNpm = Boolean(doc?.versions?.[p.version]);
    if (!onNpm || doc["dist-tags"]?.latest !== p.version) out.push({ ...p, onNpm });
  }
  return out;
}

/** @statewalker references behind npm's latest: [{ ...entry, latest, fits }]. */
async function behind(repo) {
  const out = [];
  for (const e of internalCatalogEntries(repo)) {
    const latest = (await packument(e.name))?.["dist-tags"]?.latest;
    if (!latest || latest === e.resolved) continue;
    out.push({ ...e, latest, fits: satisfies(latest, e.range ?? "") });
  }
  return out;
}

async function status() {
  const { order } = dependencyOrder();
  const list = targets.length ? order.filter((r) => targets.includes(r)) : order;
  for (const repo of list) {
    const pend = await unpublished(repo);
    const refs = await behind(repo);
    const parts = [];
    if (pend.length) parts.push(`${pend.length} version(s) not latest on npm`);
    if (refs.length) parts.push(`${refs.length} @statewalker reference(s) behind npm`);
    say(`${repo}: ${parts.join(", ") || "up to date"}`);
    for (const p of pend) say(`    unpublished  ${p.name}@${p.version}${p.onNpm ? " (on npm, not latest)" : ""}`);
    for (const r of refs)
      say(`    behind       ${r.name} ${r.resolved} -> ${r.latest} (${r.fits ? "lockfile" : `range ${r.range} must change`})`);
    if (flags.has("--deep")) {
      say("    building to compare contents with npm...");
      run("pnpm", ["install", "--frozen-lockfile"], repoDir(repo));
      run("pnpm", ["run", "--if-present", "build"], repoDir(repo));
      const plan = run("node", [path.join(CI_SCRIPTS, "release-changesets.mjs"), "--dry-run"], repoDir(repo));
      for (const l of plan.split("\n").filter((l) => /: (patch|minor|major)$/.test(l))) say(`    changed      ${l}`);
    }
  }
}

const usage = "usage: node tools/packages.mjs status [project...] [--deep] | deps <project>";
try {
  if (command === "status") await status();
  else if (command === "deps") {
    if (targets.length !== 1 || !repos().includes(targets[0])) fail(`${usage} (the project must be cloned in repos/)`);
    const list = dependentsOf(targets[0]);
    say(list.length ? list.join("\n") : "no project depends on it");
  } else fail(usage);
} catch (error) {
  console.error(`stopped: ${error.message}`);
  process.exitCode = 1;
}
