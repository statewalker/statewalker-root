#!/usr/bin/env node
// check-metadata.mjs [REPO...] : validate package.json metadata and GitHub references.
//
// For every workspace package of every project in repos.json that is cloned in repos/ (or the given ones):
//   - repository.url is git+https://github.com/statewalker/<repo>.git, repository.directory is the
//     package's path (absent for the root), homepage and bugs point at the same repository;
//   - every github.com URL anywhere in the manifest names a repository that exists, is not
//     archived, and is reached under its current name (no rename redirect);
//   - for public packages: the manifest npm serves as `latest` carries the same repository.
// Prints one line per problem and a summary; exits 1 when there are problems.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { packageRepos, repoDir } from "./lib/registry.mjs";

const repos = process.argv.slice(2).length ? process.argv.slice(2) : packageRepos();

const ghCache = new Map();
/** { full_name, archived } of a GitHub repository, or null when it does not exist. */
function ghRepo(slug) {
  if (!ghCache.has(slug)) {
    try {
      const out = execFileSync("gh", ["api", `repos/${slug}`, "--jq", "{full_name, archived}"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      ghCache.set(slug, JSON.parse(out));
    } catch {
      ghCache.set(slug, null);
    }
  }
  return ghCache.get(slug);
}

/** Every string value in a JSON value, with its key path. */
function* strings(v, at = "") {
  if (typeof v === "string") yield [at, v];
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) yield* strings(x, at ? `${at}.${k}` : k);
}

const problems = [];
let manifests = 0;
let published = 0;
const npmChecks = [];

for (const repo of repos) {
  const root = repoDir(repo);
  const base = `https://github.com/statewalker/${repo}`;
  const listed = JSON.parse(
    execFileSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }),
  );
  const dirs = new Set([root, ...listed.map((p) => p.path)]);
  for (const dir of dirs) {
    const file = path.join(dir, "package.json");
    if (!fs.existsSync(file)) continue;
    manifests++;
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    const rel = path.relative(root, dir);
    const where = `${repo}/${rel ? `${rel}/` : ""}package.json`;
    const say = (msg) => problems.push(`${where}: ${msg}`);

    const repoUrl = typeof m.repository === "string" ? m.repository : m.repository?.url;
    if (repoUrl !== `git+${base}.git`) say(`repository.url is ${JSON.stringify(repoUrl)}, expected git+${base}.git`);
    const dirField = typeof m.repository === "object" ? m.repository.directory : undefined;
    if ((dirField ?? "") !== rel) say(`repository.directory is ${JSON.stringify(dirField)}, expected ${JSON.stringify(rel || undefined)}`);
    const home = rel ? `${base}/tree/main/${rel}#readme` : `${base}#readme`;
    if (m.homepage !== home) say(`homepage is ${JSON.stringify(m.homepage)}, expected ${home}`);
    const bugs = typeof m.bugs === "string" ? m.bugs : m.bugs?.url;
    if (bugs !== `${base}/issues`) say(`bugs is ${JSON.stringify(bugs)}, expected ${base}/issues`);
    if (m.name && rel) {
      // The directory under packages/ or apps/ matches the unscoped name (naming convention).
      const unscoped = m.name.replace(/^@[^/]+\//, "");
      if (path.basename(rel) !== unscoped && !m.private) say(`directory ${rel} does not match the package name ${m.name}`);
    }

    // Every GitHub reference in the manifest.
    for (const [key, value] of strings(m)) {
      for (const match of value.matchAll(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[/#?"'\s]|$)/g)) {
        const slug = `${match[1]}/${match[2]}`;
        const info = ghRepo(slug);
        if (!info) say(`${key}: ${slug} does not exist on GitHub`);
        else if (info.full_name.toLowerCase() !== slug.toLowerCase()) say(`${key}: ${slug} was renamed to ${info.full_name}`);
        else if (info.archived) say(`${key}: ${slug} is archived`);
      }
    }

    if (m.name && !m.private) {
      published++;
      npmChecks.push({ name: m.name, where, expected: `git+${base}.git`, version: m.version });
    }
  }
}

// What npm serves as `latest` (changes reach it with the next release).
const stale = [];
await Promise.all(
  npmChecks.map(async ({ name, where, expected }) => {
    const r = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}/latest`);
    if (!r.ok) {
      problems.push(`${where}: ${name} is not on npm (${r.status})`);
      return;
    }
    const doc = await r.json();
    const url = typeof doc.repository === "string" ? doc.repository : doc.repository?.url;
    if (url !== expected) stale.push(`${name}@${doc.version}: npm says ${JSON.stringify(url)}`);
  }),
);

for (const p of problems.sort()) console.log(`PROBLEM ${p}`);
for (const s of stale.sort()) console.log(`NPM-STALE ${s}`);
console.log(
  `\n${repos.length} repositories, ${manifests} manifests, ${published} public packages: ${problems.length} problems, ${stale.length} npm manifests with an older repository field`,
);
process.exitCode = problems.length ? 1 : 0;
