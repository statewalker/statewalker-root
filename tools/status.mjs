#!/usr/bin/env node
// status.mjs: where every subject stands and what to do next, read live from GitHub and from the
// handoff indexes. Plain Node, no dependencies; needs `gh` (authenticated) for live data.
// Nothing it prints is committed: state lives in issues (CLAUDE.md, "Do not create files that track state").
//
//   node tools/status.mjs                 every subject
//   node tools/status.mjs vcs platform    only these subjects
//   --no-projects                         skip the projects' open pull requests and bugs (faster)
//   --json                                the model instead of Markdown
//   --fixtures <file>                     recorded GitHub responses instead of the network (tests)
//   --now <iso>                           the time printed in the header (tests)
//
// Rules: tools/lib/status.mjs (header) and docs/process/subjects.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureSource, liveSource } from "./lib/github.mjs";
import { buildStatus, classify, isPlan, parseHandoffIndex, renderStatus, numberFromUrl } from "./lib/status.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "repos/statewalker/statewalker-root";
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const valued = new Set(["--fixtures", "--now"]);
const only = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));

const { subjects } = JSON.parse(fs.readFileSync(path.join(ROOT, "subjects", "subjects.json"), "utf8"));
for (const id of only) {
  if (!(id in subjects) && id !== "unsorted") {
    console.error(`unknown subject ${id}; known: ${Object.keys(subjects).join(", ")}`);
    process.exit(2);
  }
}
const source = value("--fixtures") ? fixtureSource(value("--fixtures")) : liveSource();

let issues;
try {
  issues = source.list(`${REPO}/issues?state=open`).filter((i) => !i.pull_request);
} catch (e) {
  console.error(`cannot read the root's issues: ${e.message}\nThis needs \`gh\` authenticated for statewalker/statewalker-root.`);
  process.exit(1);
}
const known = new Set(issues.map((i) => i.number));

// Parents that are closed (a closed map still names the subject of its open children).
const parents = [];
for (const i of issues) {
  const p = numberFromUrl(i.parent_issue_url);
  if (p && !known.has(p)) {
    try {
      parents.push(source.get(`${REPO}/issues/${p}`));
      known.add(p);
    } catch {}
  }
}

// Status comments, only where they can change the answer.
const comments = new Map();
for (const i of issues) {
  if (!i.comments) continue;
  const probe = classify(i, []);
  const matters = probe.kind === "human" || probe.kind === "frontier" || probe.kind === "plan" || (i.assignees ?? []).length > 0 || probe.kind === "triage" || probe.kind === "blocked";
  if (!matters) continue;
  try {
    comments.set(i.number, source.list(`${REPO}/issues/${i.number}/comments`));
  } catch (e) {
    comments.set(i.number, null); // reported under "Status unknown", never on the frontier
    console.error(`warning: comments of #${i.number} unreadable: ${e.message}`);
  }
}

// Handoff indexes, and the text of each live note.
const handoffs = {};
const noteText = new Map();
for (const [id, s] of Object.entries(subjects)) {
  const folder = `${s.folder}/handoffs`;
  const file = path.join(ROOT, folder, "README.md");
  if (!fs.existsSync(file)) continue;
  handoffs[id] = parseHandoffIndex(fs.readFileSync(file, "utf8"), folder);
  for (const n of handoffs[id]) {
    const p = path.join(ROOT, n.path);
    if (fs.existsSync(p)) noteText.set(n.path, fs.readFileSync(p, "utf8"));
  }
}

// Map order: each open plan's sub-issues, in the order the plan lists them.
const planOrder = new Map();
issues.filter(isPlan).forEach((plan, pi) => {
  if (!plan.sub_issues_summary?.total) return;
  try {
    source.list(`${REPO}/issues/${plan.number}/sub_issues`).forEach((c, ci) => planOrder.set(c.number, [pi, ci]));
  } catch {}
});

// Projects: open pull requests and open bugs, where this session can read them.
const projects = {};
if (!flag("--no-projects")) {
  const wanted = (only.length ? only : Object.keys(subjects)).flatMap((id) => subjects[id]?.projects ?? []);
  for (const p of wanted) {
    try {
      const pulls = source.list(`repos/statewalker/${p}/pulls?state=open`).map((x) => ({ number: x.number, title: x.title, draft: x.draft }));
      const bugs = source.list(`repos/statewalker/${p}/issues?state=open&labels=bug`).filter((x) => !x.pull_request).map((x) => ({ number: x.number, title: x.title }));
      projects[p] = { pulls, bugs };
    } catch {
      projects[p] = { unread: "not readable from this session: select or attach the project to see its pull requests and bugs" };
    }
  }
}

// Blockers by number, for the blocked tickets.
const blockers = new Map();
for (const i of issues) {
  if (!(i.issue_dependencies_summary?.blocked_by > 0)) continue;
  try {
    blockers.set(i.number, source.list(`${REPO}/issues/${i.number}/dependencies/blocked_by`).filter((b) => b.state === "open").map((b) => b.number));
  } catch {}
}

const nowArg = value("--now");
const nowDate = nowArg ? new Date(nowArg.replace(" UTC", "Z").replace(" ", "T")) : new Date();
if (Number.isNaN(nowDate.getTime())) {
  console.error(`--now ${nowArg}: not a date (use 2026-11-27T10:00:00Z or "2026-11-27 10:00 UTC")`);
  process.exit(2);
}
const now = nowDate.toISOString();
const model = buildStatus({ subjects, issues, comments, parents, handoffs, projects, only, now, blockers, planOrder, noteText });
if (flag("--json")) {
  console.log(JSON.stringify(model.map((s) => ({ ...s, ...Object.fromEntries(["plans", "unknown", "frontier", "human", "taken", "stale", "blocked", "triage", "other"].map((k) => [k, s[k].map((c) => ({ number: c.issue.number, title: c.issue.title, status: c.status?.word ?? null }))])) })), null, 2));
} else {
  console.log(renderStatus(model, { generatedAt: value("--now") ?? new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC" }));
}
