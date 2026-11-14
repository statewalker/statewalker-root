#!/usr/bin/env node
// rename-dirs.mjs REPO_DIR PARENT OLD=NEW... [--skip <prefix>]...
//
// Renames package folders (`git mv PARENT/OLD PARENT/NEW`) without renaming the packages, and
// rewrites the paths that point at them in tracked text files:
//   - `PARENT/OLD` (repository-relative, e.g. in vitest aliases, tsconfig paths, docs);
//   - relative paths (`../OLD`, `../../packages/OLD`, ...) that RESOLVE to PARENT/OLD from the file's
//     own folder -- a `../utils` that means a local src/utils folder is left alone.
// Files under a --skip prefix (dated history: planning/, .beads/) and CHANGELOG.md / pnpm-lock.yaml
// are not touched. Prints the files it changed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const skips = [];
const pairs = [];
const [repo, parent] = argv;
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--skip") skips.push(argv[++i]);
  else pairs.push(argv[i].split("="));
}
if (!repo || !parent || pairs.length === 0) {
  console.error("usage: rename-dirs.mjs REPO_DIR PARENT OLD=NEW... [--skip <prefix>]...");
  process.exit(2);
}
const root = path.resolve(repo);
const map = new Map(pairs.map(([o, n]) => [path.join(root, parent, o), path.join(root, parent, n)]));
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });

const files = git("ls-files")
  .split("\n")
  .filter(Boolean)
  .filter((f) => !skips.some((s) => f.startsWith(s)))
  .filter((f) => !/(^|\/)(CHANGELOG\.md|pnpm-lock\.yaml)$/.test(f));

const names = pairs.map(([o]) => o).sort((a, b) => b.length - a.length); // longest first: utils-node before utils
const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
// A path segment ends at one of these (or the end of the string).
const END = "(?=[/\"'`)\\s#:,;\\]>]|$)";
const absRe = new RegExp(`(^|[^\\w./-])(${parent}/)(${alt})${END}`, "gm");
const relRe = new RegExp(`((?:\\.\\./)+(?:[\\w.-]+/)*?)(${alt})${END}`, "gm");

let changed = 0;
for (const f of files) {
  const file = path.join(root, f);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue; // binary
  const dir = path.dirname(file);
  let out = text.replace(absRe, (m, pre, par, name) => {
    const target = map.get(path.join(root, parent, name));
    return target ? `${pre}${par}${path.basename(target)}` : m;
  });
  out = out.replace(relRe, (m, rel, name) => {
    const target = map.get(path.resolve(dir, rel, name));
    return target ? `${rel}${path.basename(target)}` : m;
  });
  if (out !== text) {
    fs.writeFileSync(file, out);
    changed++;
    console.log(`rewrote ${f}`);
  }
}
for (const [o, n] of pairs) git("mv", path.join(parent, o), path.join(parent, n));
console.log(`${pairs.length} folders moved, ${changed} files rewritten`);
