// status.mjs: the subject, status and frontier rules (tools/lib/status.mjs), and the command at its
// seam with recorded GitHub responses. No network.
// Run: node --test tools/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStatus, classify, currentNotes, humanItems, latestStatus, parseHandoffIndex, subjectsOf } from "../lib/status.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, "..", "status.mjs");
const subjects = {
  process: { title: "Process", folder: "docs", projects: ["statewalker-ci"] },
  platform: { title: "Platform", folder: "subjects/platform", projects: ["statewalker-kernel"] },
  runtimes: { title: "Runtimes", folder: "subjects/runtimes", projects: ["cellb.dev"] },
};
const issue = (number, labels, extra = {}) => ({ number, title: `issue ${number}`, labels: labels.map((name) => ({ name })), assignees: [], comments: 0, ...extra });
const comment = (body, created_at = "2026-11-20T10:00:00Z") => ({ body, created_at });

test("subject: an explicit label wins over repo: labels", () => {
  const i = issue(1, ["repo:cellb.dev", "subject:platform"]);
  assert.deepEqual(subjectsOf(i, { subjects, byNumber: new Map() }), ["platform"]);
});

test("subject: a child takes its parent's subject before its own repo: labels", () => {
  const map = issue(10, ["wayfinder:map", "subject:platform"]);
  const child = issue(11, ["repo:cellb.dev"], { parent_issue_url: "https://api.github.com/repos/statewalker/statewalker-root/issues/10" });
  assert.deepEqual(subjectsOf(child, { subjects, byNumber: new Map([[10, map]]) }), ["platform"]);
});

test("subject: area:root is process; repo: labels map through subjects.json; nothing is unsorted", () => {
  const none = new Map();
  assert.deepEqual(subjectsOf(issue(2, ["area:root"]), { subjects, byNumber: none }), ["process"]);
  assert.deepEqual(subjectsOf(issue(3, ["repo:cellb.dev", "repo:statewalker-kernel"]), { subjects, byNumber: none }).sort(), ["platform", "runtimes"]);
  assert.deepEqual(subjectsOf(issue(4, ["needs-triage"]), { subjects, byNumber: none }), ["unsorted"]);
});

test("status: the latest status comment decides", () => {
  assert.equal(latestStatus([comment("Claimed by x"), comment("Released: stopping")]).word, "released");
  assert.equal(latestStatus([comment("Waiting on human: publish"), comment("a note")]).word, "waiting");
  assert.equal(latestStatus([comment("hello")]), null);
});

test("classify: plans, taken, human, blocked, frontier and triage", () => {
  assert.equal(classify(issue(1, ["wayfinder:map"]), []).kind, "plan");
  assert.equal(classify({ ...issue(2, []), title: "Spec: a thing" }, []).kind, "plan");
  assert.equal(classify(issue(3, ["ready-for-agent"]), [comment("Claimed by s")], "2026-11-21T00:00:00Z").kind, "taken");
  assert.equal(classify(issue(4, ["ready-for-agent"]), [comment("Waiting on human: decide")]).kind, "human");
  assert.equal(classify(issue(5, ["ready-for-human"]), []).kind, "human");
  assert.equal(classify(issue(6, ["ready-for-agent"], { assignees: [{ login: "a" }] }), []).kind, "human", "assigned with no claim is the human's");
  assert.equal(classify(issue(7, ["ready-for-agent"], { issue_dependencies_summary: { blocked_by: 1 } }), []).kind, "blocked");
  assert.equal(classify(issue(8, ["ready-for-agent"]), [comment("Claimed by s"), comment("Released: done for now")]).kind, "frontier");
  assert.equal(classify(issue(9, ["wayfinder:research"]), []).kind, "frontier");
  assert.equal(classify(issue(10, ["wayfinder:grilling"]), []).kind, "human", "grilling needs the human");
  assert.equal(classify(issue(11, ["needs-triage"]), []).kind, "triage");
});

test("regression: a claimed, unblocked grilling still waits on the human (#194)", () => {
  assert.equal(classify(issue(194, ["wayfinder:grilling"]), [comment("Claimed by session_x")]).kind, "human");
});

test("regression: a bare 'Claimed.' comment counts as a claim (#164)", () => {
  assert.equal(classify(issue(164, ["ready-for-agent"], { assignees: [{ login: "a" }] }), [comment("Claimed. Building in ws/164")], "2026-11-21T00:00:00Z").kind, "taken");
});

test("regression: unreadable comments are 'unknown', never the frontier", () => {
  assert.equal(classify(issue(199, ["wayfinder:research"]), null).kind, "unknown");
  const model = buildStatus({ subjects, issues: [issue(199, ["wayfinder:research", "subject:platform"])], comments: new Map([[199, null]]), handoffs: {} });
  const platform = model.find((s) => s.id === "platform");
  assert.equal(platform.frontier.length, 0);
  assert.equal(platform.unknown.length, 1);
});

test("regression: a status line inside a longer comment counts (#69's handoff comment)", () => {
  const c = [comment("Claimed by s", "2026-11-15T10:00:00Z"), comment("Handoff note: docs/handoffs/x.md\n\nWaiting on human: the npm trusted publisher", "2026-11-27T09:00:00Z")];
  assert.equal(latestStatus(c).word, "waiting");
  assert.equal(classify(issue(69, ["area:root"], { assignees: [{ login: "a" }] }), c, "2026-11-27T10:00:00Z").kind, "human");
});

test("regression: 'Waiting on human:' after a sentence counts; a bullet 'Released 0.5' does not", () => {
  assert.equal(latestStatus([comment("Handoff note: [x](y). Waiting on human: the publisher.")]).word, "waiting");
  assert.equal(latestStatus([comment("Claimed by s"), comment("### Done\n- Released 0.5 of the kernel")]).word, "claimed");
});

test("regression: 'Resumed.' and 'Released.' as the human writes them are status lines (#228, #132)", () => {
  assert.equal(latestStatus([comment("Waiting on human: pick"), comment("Resumed. The human chose option B.")]).word, "resumed");
  assert.equal(latestStatus([comment("Claimed by s"), comment("Released. Every acceptance criterion is met.")]).word, "released");
  assert.equal(latestStatus([comment("Waiting on human: x"), comment("Resumed by the human in the session")]).word, "resumed");
});

test("stale claims: claimed and quiet for over 48 hours", () => {
  const c = [comment("Claimed by https://claude.ai/code/session_old", "2026-11-23T10:00:00Z")];
  assert.equal(classify(issue(215, ["ready-for-agent"]), c, "2026-11-27T10:00:00Z").kind, "stale");
  assert.equal(classify(issue(215, ["ready-for-agent"]), c, "2026-11-24T10:00:00Z").kind, "taken");
  const later = [...c, comment("Progress: step 2 merged", "2026-11-26T20:00:00Z")];
  assert.equal(classify(issue(215, ["ready-for-agent"]), later, "2026-11-27T10:00:00Z").kind, "taken", "a progress comment keeps the claim alive");
});

test("regression: human waits recorded only in a note are found (#232, #70)", () => {
  const note = ["# Handoff", "## What is left", "- ticket the fog", "## Waiting on the human", "- The fog proposal above.", "  - a sub-point", "1. **Fork** wasmer-sdk", "## Skills", "- grilling", "## Left", "- **Waiting on human:** whether to file two upstream issues"].join("\n");
  assert.deepEqual(humanItems(note), ["The fog proposal above. a sub-point", "**Fork** wasmer-sdk", "whether to file two upstream issues"]);
});

test("regression: an item's continuation lines are kept", () => {
  assert.deepEqual(humanItems("## Waiting on the human\n- **#245:**\n  - repoint the publishers;\n  - archive shell-react\n- next"), ["**#245:** repoint the publishers; archive shell-react", "next"]);
});

test("regression: a retargeted note and a newer note for the same ticket: only the newer is current", () => {
  const notes = parseHandoffIndex("- [a](a.md): #456 (continues plan #282), Batch\n- [b](b.md): #456, Batch", "f");
  assert.deepEqual(currentNotes(notes).map((n) => n.name), ["b"]);
});

test("regression: a note's waits already on its waiting ticket are not reported again", () => {
  const model = buildStatus({
    subjects,
    issues: [issue(456, ["ready-for-human", "subject:platform"])],
    comments: new Map(),
    handoffs: { platform: [{ name: "n", path: "n.md", ref: "#456", rootTicket: 456, title: "t" }] },
    noteText: new Map([["n.md", "## Waiting on the human\n- choose the batch"]]),
  });
  assert.equal(model.find((s) => s.id === "platform").notes[0].ticketWaits, true);
});

test("index: a ref naming the open ticket that continues a closed plan", () => {
  const [n] = parseHandoffIndex("- [a](a.md): #456 (continues plan #282), Choose the batch", "f");
  assert.equal(n.rootTicket, 456);
});

test("frontier in map order", () => {
  const issues = [issue(273, ["ready-for-agent", "subject:platform"]), issue(265, ["ready-for-agent", "subject:platform"]), issue(269, ["ready-for-agent", "subject:platform"])];
  const planOrder = new Map([[265, [0, 21]], [269, [0, 25]], [273, [0, 29]]]);
  const model = buildStatus({ subjects, issues, comments: new Map(), handoffs: {}, planOrder });
  assert.deepEqual(model.find((s) => s.id === "platform").frontier.map((c) => c.issue.number), [265, 269, 273]);
});

test("handoff index: the last line per ticket is the current note; 'no ticket' notes stay separate", () => {
  const text = [
    "# Handoff notes",
    "- [2026-11-25.282-a](2026-11-25.282-a.md): #282, Plan",
    "- [2026-11-27.282-a-0835](2026-11-27.282-a-0835.md): #282, Plan",
    "- [2026-11-27.kite](2026-11-27.kite.md): no ticket, Kitesurf",
    "- [2026-11-27.arch](2026-11-27.arch.md): no ticket, Architecture",
    "- [2026-11-27.vcs-399](2026-11-27.vcs-399.md): webrun-vcs#399, SQL store",
  ].join("\n");
  const notes = currentNotes(parseHandoffIndex(text, "subjects/vcs/handoffs"));
  assert.deepEqual(notes.map((n) => n.name), ["2026-11-27.282-a-0835", "2026-11-27.kite", "2026-11-27.arch", "2026-11-27.vcs-399"]);
  assert.equal(notes[0].rootTicket, 282);
  assert.equal(notes[0].path, "subjects/vcs/handoffs/2026-11-27.282-a-0835.md");
  assert.equal(notes[3].rootTicket, null);
});

test("buildStatus: a live note on a closed root ticket is flagged", () => {
  const model = buildStatus({
    subjects,
    issues: [issue(20, ["ready-for-agent", "subject:platform"])],
    comments: new Map(),
    handoffs: { platform: [{ name: "n", path: "p", ref: "#19", rootTicket: 19, title: "t" }] },
  });
  const platform = model.find((s) => s.id === "platform");
  assert.equal(platform.frontier.length, 1);
  assert.equal(platform.notes[0].closed, true);
});

test("status.mjs: renders every subject from recorded responses", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "status-"));
  const fixtures = path.join(dir, "fixtures.json");
  const R = "repos/statewalker/statewalker-root";
  fs.writeFileSync(
    fixtures,
    JSON.stringify({
      [`${R}/issues?state=open`]: [
        issue(215, ["ready-for-agent", "subject:platform"], { title: "Spec: the empty fragment platform", sub_issues_summary: { total: 4, completed: 1 } }),
        issue(260, ["ready-for-agent", "repo:cellb.dev"], { parent_issue_url: `https://api.github.com/${R}/issues/215` }),
        issue(266, ["ready-for-agent"], { parent_issue_url: `https://api.github.com/${R}/issues/215`, comments: 1 }),
        issue(98, ["ready-for-human", "area:root", "subject:runtimes"]),
        issue(5, ["needs-triage"]),
      ],
      [`${R}/issues/266/comments`]: [comment("Claimed by https://claude.ai/code/session_x", "2026-11-26T08:00:00Z")],
    }),
  );
  const r = spawnSync("node", [TOOL, "--fixtures", fixtures, "--no-projects", "--now", "2026-11-27 10:00 UTC"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /Generated 2026-11-27 10:00 UTC/);
  assert.match(out, /\| platform \| 1 \| 1 \| 0( \+ \d+ in notes)? \| 1 \| 0 \| 0 \| 0 \|/, "platform: the spec, #260 on the frontier, #266 taken (26 hours quiet: not stale)");
  assert.match(out, /## platform[\s\S]*Next for an agent[\s\S]*#260/);
  assert.match(out, /#266[^\n]*claimed 2026-11-26/);
  assert.match(out, /## runtimes[\s\S]*Waiting on the human[\s\S]*#98/);
  assert.match(out, /## unsorted[\s\S]*#5/, "an issue with no subject is listed for labelling");
});

test("status.mjs: a failed comment fetch is reported, and the ticket stays off the frontier", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "status-"));
  const fixtures = path.join(dir, "fixtures.json");
  const R = "repos/statewalker/statewalker-root";
  fs.writeFileSync(fixtures, JSON.stringify({ [`${R}/issues?state=open`]: [issue(199, ["wayfinder:research", "subject:platform"], { comments: 2 })] }));
  const r = spawnSync("node", [TOOL, "--fixtures", fixtures, "--no-projects", "platform"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /comments of #199 unreadable/);
  assert.match(r.stdout, /Status unknown[\s\S]*#199/);
  assert.doesNotMatch(r.stdout, /Next for an agent/);
});

test("status.mjs: an unknown subject is refused", () => {
  const r = spawnSync("node", [TOOL, "nope", "--no-projects"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown subject nope/);
});
