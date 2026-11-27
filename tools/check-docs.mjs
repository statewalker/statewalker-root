#!/usr/bin/env node
// check-docs.mjs: the checks CI runs on this repository. Plain Node, no dependencies.
//   1. Every relative link in a Markdown file outside .claude/skills/ points at a file that exists.
//   2. skills-lock.json lists exactly the folders in .claude/skills/.
//   3. repos.json parses and every entry is a statewalker GitHub URL.
//   4. subjects/subjects.json: every project of repos.json is in exactly one subject; every subject
//      has its folder, README.md and handoff indexes, and a GLOSSARY-MAP.md row listing the same projects.
//   5. Every handoff note is listed in its folder's index, every index line names a note there, and
//      every line has the form tools/status.mjs parses.
// Exits 1 and lists every problem when any check fails.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHandoffIndex } from "./lib/status.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", "repos", "ws", "notes"]);
const problems = [];

function markdownFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP.has(e.name) || path.relative(ROOT, p) === path.join(".claude", "skills")) continue;
      out.push(...markdownFiles(p));
    } else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

for (const file of markdownFiles(ROOT)) {
  const text = fs
    .readFileSync(file, "utf8")
    .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, "") // fenced blocks, indented too
    .replace(/`[^`\n]*`/g, ""); // inline code
  const targets = [
    ...[...text.matchAll(/\]\((?:<([^>]+)>|(\S+?))(?:\s+"[^"]*")?\)/g)].map((m) => m[1] ?? m[2]), // [a](t), [a](<t>), [a](t "title")
    ...[...text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)].map((m) => m[1]), // [a]: t
  ];
  for (const raw of targets) {
    const target = raw.replace(/^<|>$/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    let rel;
    try {
      rel = decodeURIComponent(target.split("#")[0]);
    } catch {
      problems.push(`${path.relative(ROOT, file)}: malformed link ${target}`);
      continue;
    }
    const resolved = rel.startsWith("/") ? path.join(ROOT, rel) : path.resolve(path.dirname(file), rel);
    if (!fs.existsSync(resolved)) problems.push(`${path.relative(ROOT, file)}: broken link ${target}`);
  }
}

const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "skills-lock.json"), "utf8"));
const locked = Object.keys(lock.skills ?? {}).sort();
const installed = fs
  .readdirSync(path.join(ROOT, ".claude", "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
for (const s of locked) if (!installed.includes(s)) problems.push(`skills-lock.json: ${s} is not installed`);
for (const s of installed) if (!locked.includes(s)) problems.push(`.claude/skills/${s}: missing from skills-lock.json`);

const repos = JSON.parse(fs.readFileSync(path.join(ROOT, "repos.json"), "utf8"));
for (const [name, url] of Object.entries(repos)) {
  if (url !== `https://github.com/statewalker/${name}.git`) problems.push(`repos.json: ${name} -> ${url}`);
}

const { subjects } = JSON.parse(fs.readFileSync(path.join(ROOT, "subjects", "subjects.json"), "utf8"));
const owner = new Map();
for (const [id, s] of Object.entries(subjects)) {
  for (const p of s.projects) {
    if (!(p in repos)) problems.push(`subjects.json: ${id} lists ${p}, which is not in repos.json`);
    if (owner.has(p)) problems.push(`subjects.json: ${p} is in both ${owner.get(p)} and ${id}`);
    owner.set(p, id);
  }
  const need = id === "process" ? ["docs/process/README.md"] : [`${s.folder}/README.md`];
  need.push(`${s.folder}/handoffs/README.md`, `${s.folder}/handoffs.archive/README.md`);
  for (const f of need) if (!fs.existsSync(path.join(ROOT, f))) problems.push(`subjects.json: ${id} needs ${f}`);
}
for (const p of Object.keys(repos)) if (!owner.has(p)) problems.push(`subjects.json: project ${p} has no subject`);
const map = fs.readFileSync(path.join(ROOT, "GLOSSARY-MAP.md"), "utf8");
for (const [id, s] of Object.entries(subjects)) {
  const row = map.split("\n").find((l) => l.startsWith(`| \`${id}\` |`));
  if (!row) {
    problems.push(`GLOSSARY-MAP.md: no row for subject ${id}`);
    continue;
  }
  const listed = (row.split("|")[3] ?? "").split(",").map((x) => x.trim()).filter(Boolean).sort();
  if (listed.join() !== [...s.projects].sort().join()) problems.push(`GLOSSARY-MAP.md: ${id}'s projects (${listed.join(", ")}) differ from subjects.json (${s.projects.join(", ")})`);
}

for (const s of Object.values(subjects)) {
  for (const kind of ["handoffs", "handoffs.archive"]) {
    const dir = path.join(ROOT, s.folder, kind);
    if (!fs.existsSync(dir)) continue;
    const index = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    const listed = new Set([...index.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)].map((m) => m[1]));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
    for (const f of files) if (!listed.has(f)) problems.push(`${s.folder}/${kind}/${f}: missing from its README.md index`);
    for (const f of listed) if (!files.includes(f)) problems.push(`${s.folder}/${kind}/README.md: lists ${f}, which is not in the folder`);
    const parsed = parseHandoffIndex(index, "").length;
    if (parsed !== listed.size) problems.push(`${s.folder}/${kind}/README.md: ${listed.size - parsed} line(s) not in the form "- [name](file): <#n | project#n | no ticket>, <title>"`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-docs: ok");
