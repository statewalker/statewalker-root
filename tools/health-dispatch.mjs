#!/usr/bin/env node
// health-dispatch.mjs: the weekly health-review plan (docs/process/health-review.md). Plain Node,
// no dependencies.
//
//   node tools/health-dispatch.mjs [--now <ISO date>] [--repos a,b,...] [--layers <file.json>]
//                                  [--json] [--md <file>] [--create] [--fixtures <file.json>]
//
// Decides, from the record tickets here, each project's latest commit on main and the open
// deferred bugs:
//   - which projects to review this week: open (unfinished) record tickets first, counted against
//     the cap of five; then the least recently reviewed projects, lower layer first on ties;
//     projects whose main has not moved since their recorded commit are skipped;
//   - which record tickets to create (never a second open one for a project);
//   - which deferred bugs to escalate: open four weeks (28 days) or more, with no open root issue
//     linking them yet.
// Prints the plan; dry run unless --create, which files the tickets. Starting the sessions is the
// weekly routine's job. Layers come from the table in CLAUDE.md (--layers overrides: { name: n }).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureSource, liveSource } from "./lib/github.mjs";
import { isoWeek } from "./lib/week.mjs";

export { isoWeek };

const ORG = "statewalker";
const SELF = "statewalker-root";
const DAY = 86400000;
const CAP = 5;
const ESCALATE_AFTER_DAYS = 28;
const RECORD_LINE = /<!--\s*health-review:\s*project=(\S+)\s+commit=([0-9a-f]{7,40})\s*-->/;
const STATUS = /^(Claimed by|Released:|Waiting on human:|Resumed:)/;
const HEALTH_ISSUE = 36; // the pinned "Review health" issue
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const a = { now: new Date(), repos: null, layers: null, json: false, md: null, create: false, fixtures: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--now") a.now = new Date(argv[++i]);
    else if (k === "--repos") a.repos = argv[++i].split(",").filter(Boolean);
    else if (k === "--layers") a.layers = JSON.parse(fs.readFileSync(argv[++i], "utf8"));
    else if (k === "--json") a.json = true;
    else if (k === "--md") a.md = argv[++i];
    else if (k === "--create") a.create = true;
    else if (k === "--fixtures") a.fixtures = argv[++i];
    else throw new Error(`unknown argument ${k}`);
  }
  if (Number.isNaN(a.now.getTime())) throw new Error("--now is not a date");
  if (a.create && a.fixtures) throw new Error("--create cannot be used with --fixtures");
  return a;
}

const weekMarker = (week) => `<!-- review-health: week=${week} -->`;

/** { project: layer number } from CLAUDE.md's project table (`| L3 | webrun-vcs | … |`). */
export function layersFromClaudeMd(text) {
  const out = {};
  for (const m of text.matchAll(/^\|\s*L(\d+)\s*\|\s*([^|\s]+)\s*\|/gm)) out[m[2]] = Number(m[1]);
  return out;
}

const projectOf = (issue) =>
  /^Health review: (\S+)/.exec(issue.title)?.[1] ??
  (issue.labels ?? []).map((l) => l.name ?? l).find((n) => n.startsWith("repo:"))?.slice(5) ??
  null;

/** The latest status comment's first word group, or null (docs/agents/issue-tracker.md). */
const statusOf = (comments) => {
  const s = [...comments].reverse().find((c) => STATUS.test((c.body ?? "").trim()));
  return s ? STATUS.exec(s.body.trim())[1].replace(/( by|:)$/, "") : null;
};

function read(src, repos, now) {
  const records = src.list(`repos/${ORG}/${SELF}/issues?state=all&labels=health-review`).filter((i) => !i.pull_request);
  const rootBugs = src.list(`repos/${ORG}/${SELF}/issues?state=open&labels=bug`).filter((i) => !i.pull_request);
  const projects = [];
  const skipped = [];
  for (const repo of repos) {
    try {
      const mine = records.filter((r) => projectOf(r) === repo);
      const open = mine.filter((r) => r.state === "open").sort((a, b) => a.number - b.number);
      // The last finished run: the most recently closed record with a valid record line.
      let last = null;
      for (const r of mine.filter((x) => x.state === "closed").sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))) {
        const line = src.list(`repos/${ORG}/${SELF}/issues/${r.number}/comments`).map((c) => RECORD_LINE.exec(c.body ?? "")).filter(Boolean).pop();
        if (line && line[1] === repo) {
          last = { number: r.number, commit: line[2], at: new Date(r.closed_at) };
          break;
        }
      }
      const openRecords = open.map((r) => ({ number: r.number, created: new Date(r.created_at), status: statusOf(src.list(`repos/${ORG}/${SELF}/issues/${r.number}/comments`)) }));
      const head = src.get(`repos/${ORG}/${repo}/commits/main`);
      // Deferred bugs: every open issue labelled bug in the project's tracker (docs/process/prevention.md).
      const bugs = src.list(`repos/${ORG}/${repo}/issues?state=open&labels=bug`).filter((i) => !i.pull_request);
      projects.push({ repo, last, openRecords, head: head.sha, bugs });
    } catch (e) {
      if (!e.unreadable) throw e;
      skipped.push({ repo, reason: e.message });
    }
  }
  return { projects, skipped, rootBugs };
}

export function plan({ projects, skipped, rootBugs }, layers, now) {
  const layer = (repo) => layers[repo] ?? Infinity; // apps, infra and this repository last on ties
  const review = [];
  // 1. Unfinished runs, oldest record first. Each counts against the cap; only the available ones
  //    (no claim, or released, or resumed by the human) are started again.
  for (const p of projects) for (const r of p.openRecords.slice(0, 1)) review.push({ repo: p.repo, action: "resume", record: r.number, status: r.status, start: [null, "Released", "Resumed"].includes(r.status), created: r.created });
  review.sort((a, b) => a.created - b.created);
  const waiting = review.splice(CAP).map((r) => r.repo); // more unfinished runs than the cap: oldest first
  // 2. Changed projects without an open record: least recently reviewed (never first), lower layer on ties.
  const unchanged = [];
  const candidates = [];
  for (const p of projects) {
    if (p.openRecords.length) continue;
    if (p.last && p.head.startsWith(p.last.commit)) unchanged.push(p.repo); // a full or abbreviated sha
    else candidates.push(p);
  }
  candidates.sort((a, b) => (a.last?.at ?? -Infinity) - (b.last?.at ?? -Infinity) || layer(a.repo) - layer(b.repo) || a.repo.localeCompare(b.repo));
  for (const p of candidates) {
    const entry = { repo: p.repo, action: "create", title: `Health review: ${p.repo}`, base: p.last?.commit ?? null, lastRecord: p.last?.number ?? null, head: p.head };
    if (review.length < CAP) review.push(entry);
    else waiting.push(p.repo);
  }
  // 3. Deferred bugs open four weeks or more, not yet linked from an open root issue.
  const escalate = [];
  for (const p of projects) {
    for (const b of p.bugs) {
      if (now - new Date(b.created_at) < ESCALATE_AFTER_DAYS * DAY) continue;
      const url = `https://github.com/${ORG}/${p.repo}/issues/${b.number}`;
      const linked = new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`); // #7 is not #70
      const existing = rootBugs.find((i) => linked.test(i.body ?? ""));
      escalate.push({ repo: p.repo, issue: b.number, title: b.title, url, ageDays: Math.floor((now - new Date(b.created_at)) / DAY), duplicateOf: existing?.number ?? null });
    }
  }
  escalate.sort((a, b) => b.ageDays - a.ageDays);
  return {
    now: now.toISOString(),
    cap: CAP,
    review: review.map(({ created, ...r }) => r),
    waiting,
    unchanged,
    skippedRepos: skipped,
    escalate,
  };
}

function recordBody(e) {
  return [
    `Health review of **${e.repo}** (\`docs/process/health-review.md\`).`,
    "",
    `- **Base commit**: ${e.base ? `\`${e.base}\` (reviewed in #${e.lastRecord})` : "first run: review the whole project"}.`,
    `- **main when planned**: \`${e.head}\`; the run records the commit it actually reviews.`,
    "",
    "## Acceptance criteria",
    "",
    "- [ ] Findings filed in the project's tracker as the process says (bugs, at most ten improvements, one to three architecture candidates).",
    "- [ ] Deferred bugs sorted; at most one tidy pull request, through the merge gate.",
    "- [ ] The record comment posted, ending with the `<!-- health-review: … -->` line, and this ticket closed.",
    "",
    "_Opened by `tools/health-dispatch.mjs --create`._",
  ].join("\n");
}

function escalationBody(e) {
  return [
    `The deferred bug ${e.url} (**${e.title}**) has been open ${e.ageDays} days, past the four-week limit (\`docs/process/prevention.md\`).`,
    "",
    "## Acceptance criteria",
    "",
    `- [ ] The bug is fixed in ${e.repo} with a regression test, through the merge gate.`,
    `- [ ] ${e.url} is closed with a comment linking the fix.`,
    "",
    "_Opened by `tools/health-dispatch.mjs --create`._",
  ].join("\n");
}

function markdown(p) {
  const lines = [`## Health reviews, week ${p.week} (${p.now.slice(0, 10)})`, ""];
  if (p.alreadyPlanned) return [...lines, `Already planned this week (#${HEALTH_ISSUE} has the marker): nothing to do.`].join("\n");
  lines.push(p.review.length ? `**Review** (${p.review.length} of at most ${p.cap}):` : "Nothing to review this week.");
  for (const r of p.review) {
    if (r.action === "resume") lines.push(`- ${r.repo}: resume #${r.record}${r.start ? "" : ` (not started: ${r.status})`}`);
    else lines.push(`- ${r.repo}: new record ticket, ${r.base ? `since ${r.base.slice(0, 7)}` : "first run"}${r.created ? ` (#${r.created})` : ""}`);
  }
  if (p.waiting.length) lines.push("", `Over the cap, next week: ${p.waiting.join(", ")}.`);
  if (p.unchanged.length) lines.push("", `Unchanged since their last review, skipped: ${p.unchanged.join(", ")}.`);
  if (p.skippedRepos.length) lines.push("", `Not readable, skipped: ${p.skippedRepos.map((x) => x.repo).join(", ")}.`);
  if (p.escalate.length) {
    lines.push("", "**Deferred bugs to escalate** (open four weeks or more):");
    for (const e of p.escalate) lines.push(`- ${e.repo}#${e.issue} (${e.ageDays} days): ${e.duplicateOf ? `already escalated in #${e.duplicateOf}` : e.created ? `escalated in #${e.created}` : "to escalate"}`);
  }
  lines.push("", weekMarker(p.week));
  return lines.join("\n");
}

function ensureLabel(src, name) {
  try {
    src.create(`repos/${ORG}/${SELF}/labels`, { name, color: "ededed" });
  } catch {
    // already exists (422), which is fine
  }
}

export function main(argv) {
  const args = parseArgs(argv);
  const src = args.fixtures ? fixtureSource(args.fixtures) : liveSource();
  const repos = args.repos ?? [...Object.keys(JSON.parse(fs.readFileSync(path.join(HERE, "repos.json"), "utf8"))), SELF];
  const layers = args.layers ?? layersFromClaudeMd(fs.readFileSync(path.join(HERE, "CLAUDE.md"), "utf8"));
  // The weekly routine posts the plan on the Review health issue, ending with this week's marker:
  // once it is there, this week's runs are planned, and a second run plans nothing.
  const week = isoWeek(args.now);
  const ran = src.list(`repos/${ORG}/${SELF}/issues/${HEALTH_ISSUE}/comments`).some((c) => (c.body ?? "").includes(weekMarker(week)));
  const p = ran
    ? { now: args.now.toISOString(), week, alreadyPlanned: true, cap: CAP, review: [], waiting: [], unchanged: [], skippedRepos: [], escalate: [] }
    : { week, alreadyPlanned: false, ...plan(read(src, repos, args.now), layers, args.now) };
  if (args.create && !ran) {
    for (const r of p.review.filter((x) => x.action === "create")) {
      ensureLabel(src, `repo:${r.repo}`);
      r.created = src.create(`repos/${ORG}/${SELF}/issues`, { title: r.title, body: recordBody(r), labels: ["health-review", `repo:${r.repo}`] }).number;
    }
    for (const e of p.escalate.filter((x) => !x.duplicateOf)) {
      ensureLabel(src, `repo:${e.repo}`);
      e.created = src.create(`repos/${ORG}/${SELF}/issues`, { title: `Deferred bug: ${e.repo}#${e.issue} ${e.title}`, body: escalationBody(e), labels: ["bug", "ready-for-agent", `repo:${e.repo}`] }).number;
    }
  }
  if (args.md) fs.writeFileSync(args.md, `${markdown(p)}\n`);
  return args.json ? JSON.stringify(p, null, 2) : markdown(p);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`health-dispatch: ${e.message}`);
    process.exit(1);
  }
}
