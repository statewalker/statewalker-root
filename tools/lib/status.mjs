// The pure half of tools/status.mjs: which subject an issue belongs to, what state it is in, the
// handoff indexes, and the report. No I/O here, so tests feed it plain objects.
//
// Rules it implements (docs/process/subjects.md, docs/agents/issue-tracker.md):
//   subject     a subject:<id> label; else the parent issue's subject; else area:root -> process;
//               else the subjects of its repo:<name> labels (subjects/subjects.json); else unsorted
//   plan        an open wayfinder:map, or a title starting "Spec:"
//   status      the latest status line decides (a line of a comment starting Claimed / Released: /
//               Waiting on human: / Resumed:): Claimed -> taken, Waiting on human -> human,
//               Released / Resumed -> free; ready-for-human -> human; assigned with no claim -> human
//   stale       taken, but nothing was added to the ticket for STALE_HOURS after the claim's last
//               activity: a session may release it (docs/agents/issue-tracker.md, "Stale claims")
//   frontier    free, no open blocker, and ready-for-agent or an agent-run wayfinder type
//               (research, prototype, task)

const STATUS_WORDS = [
  ["claimed", /^\s*Claimed(\s+by\b|[.:])/i],
  ["waiting", /(^\s*|[.!?]\s+)Waiting on human:/i],
  ["released", /^\s*Released([.:,]|\s+by\b)/i],
  ["resumed", /^\s*Resumed([.:,]|\s+by\b)/i],
];

export const STALE_HOURS = 48;

export const labelsOf = (issue) => (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
export const numberFromUrl = (url) => (url ? Number(String(url).split("/").pop()) : null);

export function projectSubjects(subjects) {
  const map = new Map();
  for (const [id, s] of Object.entries(subjects)) for (const p of s.projects) map.set(p, id);
  return map;
}

/** The subjects an issue belongs to. `byNumber` holds every issue known (open, plus fetched parents). */
export function subjectsOf(issue, { subjects, byNumber, seen = new Set() }) {
  const labels = labelsOf(issue);
  const explicit = labels.filter((l) => l.startsWith("subject:")).map((l) => l.slice(8)).filter((id) => id in subjects);
  if (explicit.length) return explicit;
  const parent = numberFromUrl(issue.parent_issue_url);
  if (parent && byNumber.has(parent) && !seen.has(parent)) {
    seen.add(issue.number);
    const fromParent = subjectsOf(byNumber.get(parent), { subjects, byNumber, seen });
    if (!fromParent.includes("unsorted")) return fromParent;
  }
  if (labels.includes("area:root")) return ["process"];
  const owners = projectSubjects(subjects);
  const viaRepo = [...new Set(labels.filter((l) => l.startsWith("repo:")).map((l) => owners.get(l.slice(5))).filter(Boolean))];
  return viaRepo.length ? viaRepo : ["unsorted"];
}

/** The latest status line: { word, at, body } or null. Comments are oldest first; within a comment the last status line wins. */
export function latestStatus(comments = []) {
  for (let i = comments.length - 1; i >= 0; i--) {
    const lines = (comments[i].body ?? "").split("\n").map((l) => l.replace(/^[\s>*_-]+/, ""));
    for (let j = lines.length - 1; j >= 0; j--) {
      for (const [word, re] of STATUS_WORDS) if (re.test(lines[j])) return { word, at: comments[i].created_at, body: lines[j].trim() };
    }
  }
  return null;
}

/** Hours since the ticket's last comment (any comment counts as activity), at `now`. */
export function hoursQuiet(comments = [], now) {
  const last = comments.at(-1)?.created_at;
  return last ? (Date.parse(now) - Date.parse(last)) / 3.6e6 : Infinity;
}

export const isPlan = (issue) => labelsOf(issue).includes("wayfinder:map") || /^Spec:/i.test(issue.title ?? "");

/** One of: plan, unknown, taken, human, blocked, frontier, triage, other. `comments` null = unreadable. */
export function classify(issue, comments, now = new Date().toISOString()) {
  if (comments === null) return { issue, status: null, blocked: false, kind: "unknown" };
  const labels = labelsOf(issue);
  const status = latestStatus(comments);
  const blocked = (issue.issue_dependencies_summary?.blocked_by ?? 0) > 0;
  const human =
    labels.includes("ready-for-human") ||
    status?.word === "waiting" ||
    (!status && (issue.assignees ?? []).length > 0 && !isPlan(issue)) ||
    (labels.includes("wayfinder:grilling") && !blocked);
  const base = { issue, status, blocked };
  base.stale = status?.word === "claimed" && hoursQuiet(comments, now) > STALE_HOURS;
  if (isPlan(issue)) return { ...base, kind: "plan", human: status?.word === "waiting" || labels.includes("ready-for-human") };
  // A grilling needs the human's answers even while a session holds it.
  if (labels.includes("wayfinder:grilling") && !blocked) return { ...base, kind: "human" };
  if (status?.word === "claimed") return { ...base, kind: base.stale ? "stale" : "taken" };
  if (human) return { ...base, kind: "human" };
  if (blocked) return { ...base, kind: "blocked" };
  const agentReady = labels.includes("ready-for-agent") || ["wayfinder:research", "wayfinder:prototype", "wayfinder:task"].some((l) => labels.includes(l));
  if (agentReady) return { ...base, kind: "frontier" };
  if (labels.some((l) => l === "needs-triage" || l === "needs-info") || !labels.some((l) => l.startsWith("wayfinder:") || l.startsWith("ready-"))) return { ...base, kind: "triage" };
  return { ...base, kind: "other" };
}

/** The human's open items in a handoff note: the top-level items under a heading that says
 * "waiting on (the) human", and bullets that start with a bold "Waiting on human". */
export function humanItems(text) {
  const items = [];
  const lines = text.split("\n");
  let level = 0;
  let open = false; // the last item can still take continuation lines
  for (const line of lines) {
    const h = /^(#+)\s+(.*)$/.exec(line);
    if (h) {
      level = /waiting on (the )?human/i.test(h[2]) ? h[1].length : level && h[1].length <= level ? 0 : level;
      open = false;
      continue;
    }
    if (!line.trim()) {
      open = false;
      continue;
    }
    const top = /^(?:-|\d+\.)\s+(.*)$/.exec(line);
    const bold = /^\s*-\s+\*\*Waiting on (the )?human:?\*\*:?\s*(.*)$/i.exec(line);
    if (bold) {
      items.push(bold[2]);
      open = true;
    } else if (level && top) {
      items.push(top[1]);
      open = true;
    } else if (open && /^\s+/.test(line)) {
      const sub = /^\s+(?:-|\d+\.)\s+(.*)$/.exec(line);
      const last = items.length - 1;
      if (sub) items[last] = (open === "sub" ? items[last].replace(/[;,]\s*$/, "") + "; " : items[last] + " ") + sub[1].trim();
      else items[last] += " " + line.trim();
      if (sub) open = "sub";
    } else open = false;
  }
  return items.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).map((t) => (t.length > 300 ? `${t.slice(0, 297)}…` : t));
}

/** Parse a handoff index: lines `- [name](file): <ref>, <title>`. The ref's first #n is the root ticket. */
export function parseHandoffIndex(text, folder) {
  const notes = [];
  for (const line of text.split("\n")) {
    const m = /^- \[([^\]]+)\]\(([^)]+)\):\s*([^,]+?),\s*(.*)$/.exec(line);
    if (!m) continue;
    const ref = m[3].trim();
    const root = /^#(\d+)\b/.exec(ref);
    notes.push({ name: m[1], path: `${folder}/${m[2]}`, ref, rootTicket: root ? Number(root[1]) : null, title: m[4].trim() });
  }
  return notes;
}

/** The current note per ticket: the last index line for each ref ("no ticket" notes are each their own). */
export function currentNotes(notes) {
  const byRef = new Map();
  for (const n of notes) byRef.set(n.ref === "no ticket" ? `${n.ref}:${n.name}` : n.rootTicket != null ? `#${n.rootTicket}` : n.ref, n);
  return [...byRef.values()];
}

const link = (i) => `[#${i.number}](${i.html_url ?? `https://github.com/statewalker/statewalker-root/issues/${i.number}`})`;
const day = (iso) => (iso ? iso.slice(0, 10) : "");

/** Build the report model for the chosen subjects. */
export function buildStatus({ subjects, issues, comments, parents = [], handoffs, projects = {}, only, now, blockers = new Map(), planOrder = new Map(), noteText = new Map() }) {
  const byNumber = new Map([...parents, ...issues].map((i) => [i.number, i]));
  const ids = only?.length ? only : [...Object.keys(subjects), "unsorted"];
  const out = Object.fromEntries(ids.map((id) => [id, { id, title: subjects[id]?.title ?? "Unsorted (no subject: label)", plans: [], unknown: [], frontier: [], human: [], taken: [], stale: [], blocked: [], triage: [], other: [], notes: [], projects: [] }]));
  const openNumbers = new Set(issues.map((i) => i.number));
  for (const issue of issues) {
    const c = classify(issue, comments.has(issue.number) ? comments.get(issue.number) : undefined, now);
    c.blockers = blockers.get(issue.number) ?? [];
    for (const id of subjectsOf(issue, { subjects, byNumber })) {
      const s = out[id];
      if (!s) continue;
      const bucket = c.kind === "plan" ? "plans" : c.kind === "human" ? "human" : c.kind;
      s[bucket].push(c);
      if (c.kind === "plan" && c.human) s.human.push(c);
    }
  }
  for (const [id, notes] of Object.entries(handoffs)) {
    if (!out[id]) continue;
    out[id].notes = currentNotes(notes).map((n) => ({ ...n, closed: n.rootTicket != null && !openNumbers.has(n.rootTicket), waits: humanItems(noteText.get(n.path) ?? "") }));
  }
  // A note's waits are already on its ticket when that ticket is listed as waiting on the human.
  for (const s of Object.values(out)) {
    const waiting = new Set(s.human.map((c) => c.issue.number));
    for (const n of s.notes) n.ticketWaits = n.rootTicket != null && waiting.has(n.rootTicket);
  }
  // The frontier in map order: by the plan's sub-issue order, then oldest first.
  const rank = (c) => planOrder.get(c.issue.number) ?? [Infinity, c.issue.number];
  for (const s of Object.values(out)) s.frontier.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1] || a.issue.number - b.issue.number);
  for (const id of Object.keys(out)) {
    for (const p of subjects[id]?.projects ?? []) if (projects[p]) out[id].projects.push({ name: p, ...projects[p] });
  }
  return Object.values(out);
}

function line(c) {
  const i = c.issue;
  const labels = labelsOf(i).filter((l) => !l.startsWith("repo:") && !l.startsWith("subject:")).join(", ");
  const extra = [];
  if (c.status) extra.push(`${c.status.word} ${day(c.status.at)}${c.stale ?  (/claude\.ai\/code\/session_|\bclaude\/|\bccr-/.test(c.status.body) && !/\blocal\b|guided by the human/i.test(c.status.body) ? " (stale)" : " (stale, local or human-guided claim: comment `Waiting on human: confirm the claim of <date> is stale`, don't release)") : ""}`);
  const deps = i.issue_dependencies_summary;
  if (deps?.blocked_by) extra.push(c.blockers?.length ? `blocked by ${c.blockers.map((n) => `#${n}`).join(", ")}` : `blocked by ${deps.blocked_by}`);
  const sub = i.sub_issues_summary;
  if (sub?.total) extra.push(sub.completed === sub.total ? `all ${sub.total} tickets done: its handoff note says what is next; with nothing left, close it` : `${sub.completed}/${sub.total} tickets done`);
  return `- ${link(i)} ${i.title}${labels ? ` _(${labels})_` : ""}${extra.length ? ` — ${extra.join("; ")}` : ""}`;
}

/** Render the model as Markdown. */
export function renderStatus(model, { generatedAt }) {
  const L = [`# Status of the subjects`, "", `Generated ${generatedAt} by \`node tools/status.mjs\` from GitHub and the handoff indexes. Not a file to commit.`, ""];
  L.push("| Subject | Plans | Frontier (agent can start) | Waiting on the human | Taken | Stale claims | Blocked | To triage | Live notes |", "|---|---|---|---|---|---|---|---|---|");
  for (const s of model) {
    const human = new Set(s.human.map((c) => c.issue.number)).size;
    const noteWaits = s.notes.filter((x) => !x.ticketWaits).reduce((n, x) => n + x.waits.length, 0);
    L.push(`| ${s.id} | ${s.plans.length} | ${s.frontier.length} | ${human}${noteWaits ? ` + ${noteWaits} in notes` : ""} | ${s.taken.length} | ${s.stale.length} | ${s.blocked.length} | ${s.triage.length} | ${s.notes.length} |`);
  }
  for (const s of model) {
    const empty = !s.unknown.length && !s.stale.length && !s.plans.length && !s.frontier.length && !s.human.length && !s.taken.length && !s.blocked.length && !s.triage.length && !s.notes.length;
    if (s.id === "unsorted" && empty) continue;
    L.push("", `## ${s.id}: ${s.title}`, "");
    const section = (name, items, hint) => {
      if (!items.length) return;
      L.push(`**${name}**${hint ? ` (${hint})` : ""}`, "", ...items.map(line), "");
    };
    section("Plans", s.plans, "maps and specs: the subject's entry points");
    section("Status unknown", s.unknown, "its comments could not be read: check the ticket by hand before claiming it; run again");
    section("Next for an agent", s.frontier, "free, unblocked: claim one and start");
    section("Waiting on the human", [...new Map(s.human.map((c) => [c.issue.number, c])).values()], "answer, decide or hand back with `Resumed:`");
    section("Taken", s.taken, "claimed by a session, active in the last 48 hours: leave it");
    section("Stale claims", s.stale, "claimed, then quiet on the ticket for over 48 hours: check the session, its branch and pull request are idle too before releasing (docs/agents/issue-tracker.md, \"Stale claims\")");
    section("Blocked", s.blocked);
    section("To triage", s.triage, "needs-triage, needs-info or no triage label: `/triage`");
    if (s.notes.length) {
      L.push("**Live handoff notes** (current note per ticket: read before continuing)", "");
      for (const n of s.notes) L.push(`- [${n.name}](${n.path}): ${n.ref}, ${n.title}${n.closed ? " — **ticket closed**: if the note still lists open items, file them as issues and point the index line at the new ticket; if not, archive it (docs/process/handoffs.md)" : ""}`);
      L.push("");
      const waits = s.notes.filter((n) => n.waits.length && !n.ticketWaits);
      if (waits.length) {
        L.push("**Waiting on the human, from handoff notes whose ticket records no wait** (check each against its ticket; record what is still open there as a `Waiting on human:` line, or file it as an issue)", "");
        for (const n of waits) {
          L.push(`- ${n.ref} ([${n.name}](${n.path})):`);
          for (const w of n.waits) L.push(`  - ${w}`);
        }
        L.push("");
      }
    }
    const projects = s.projects;
    if (projects.length) {
      L.push("**Projects**", "");
      for (const p of s.projects) {
        if (p.unread) L.push(`- ${p.name}: ${p.unread}`);
        else L.push(`- ${p.name}: ${p.pulls.length} open pull request(s)${p.pulls.length ? ` (${p.pulls.map((x) => `#${x.number}${x.draft ? " draft" : ""}`).join(", ")})` : ""}; ${p.bugs.length} open bug(s)${p.bugs.length ? ` (${p.bugs.map((x) => `#${x.number}`).join(", ")})` : ""}`);
      }
      L.push("");
    }
    if (empty && !projects.length) L.push("Nothing open in the root. See the subject's README for its entry points.", "");
  }
  return L.join("\n");
}
