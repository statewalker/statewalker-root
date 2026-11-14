// The automatic lockfile updates after a publish (statewalker-root#15; statewalker-ci README,
// "Dependents update themselves after a publish"), added to a project's workflows:
//   .github/workflows/statewalker-update.yml   created when missing (an existing one is kept);
//   ci.yml `lockfile` job                       merges the lockfile-only pull request when green,
//                                               inserted after the check jobs;
//   ci.yml `notify` job                         after `publish`, in a project that publishes.
// ci.yml is edited as text, so its comments and layout stay. Idempotent: a ci.yml that already
// calls merge-lockfile.yml or notify-dependents.yml is left alone for that job.
import fs from "node:fs";
import path from "node:path";

const UPDATE = ".github/workflows/statewalker-update.yml";
const CI = ".github/workflows/ci.yml";
const RELEASE_JOBS = new Set(["version", "pack", "publish", "release", "notify", "lockfile"]);

export const UPDATE_WORKFLOW = `name: Update @statewalker

# Moves the lockfile to the newest @statewalker/* versions within the ranges declared here, in a
# lockfile-only pull request that ci.yml's \`lockfile\` job merges once green. Ranges never change,
# so nothing is republished (statewalker/statewalker-ci, "Dependents update themselves after a
# publish"). Run when a publisher sends \`statewalker-published\`, daily in case one was missed,
# and by hand.
on:
  repository_dispatch:
    types: [statewalker-published]
  schedule:
    - cron: "23 4 * * *"
  workflow_dispatch:

concurrency:
  group: statewalker-update

jobs:
  update:
    uses: statewalker/statewalker-ci/.github/workflows/statewalker-update.yml@main
    secrets: inherit
`;

const lockfileJob = (checks) => `  # The lockfile-only pull request that .github/workflows/statewalker-update.yml opens: merged
  # once every other check on it passes, after checking it changes pnpm-lock.yaml alone
  # (statewalker/statewalker-ci's merge-lockfile.yml; statewalker-root docs/process/merging.md).
  lockfile:
    needs: ${checks.length === 1 ? checks[0] : `[${checks.join(", ")}]`}
    # !cancelled(): also after a failed check job, so the pull request gets a comment saying why.
    if: \${{ !cancelled() && github.event_name == 'pull_request' && github.head_ref == 'deps/statewalker-lockfile' }}
    permissions:
      contents: read
      pull-requests: read
      checks: read
      statuses: read
      actions: read
    uses: statewalker/statewalker-ci/.github/workflows/merge-lockfile.yml@main
    secrets: inherit
`;

const NOTIFY_JOB = `  # What this run published reaches the other repositories of the statewalker-release App's
  # installation as a \`statewalker-published\` dispatch; each dependent then moves its lockfile
  # within its ranges (statewalker/statewalker-ci's notify-dependents.yml, which reads the
  # published tarballs from the \`packages\` artifact). Also after a partly failed publish.
  notify:
    needs: publish
    if: \${{ !cancelled() && needs.publish.result != 'skipped' }}
    permissions: {}
    uses: statewalker/statewalker-ci/.github/workflows/notify-dependents.yml@main
    secrets: inherit
`;

/**
 * The top-level jobs of a workflow, as text: { jobs: [{ name, start, end }], checks }, lines
 * counted from 0, `end` exclusive (up to the next job's leading comments or the file's end).
 * `checks`: the jobs that run on pull requests (not release jobs, no push-only `if:`).
 */
export function ciJobs(text) {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const jobs = [];
  for (let i = from + 1; from >= 0 && i < lines.length; i++) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (m) jobs.push({ name: m[1], start: i });
  }
  for (let k = 0; k < jobs.length; k++) {
    let end = k + 1 < jobs.length ? jobs[k + 1].start : lines.length;
    // The next job's leading comments and the blank lines before them belong to it.
    while (end > jobs[k].start + 1 && /^\s*(#.*)?$/.test(lines[end - 1]) && k + 1 < jobs.length) end--;
    jobs[k].end = end;
  }
  const body = (j) => lines.slice(j.start, j.end).join("\n");
  const checks = jobs
    .filter((j) => !RELEASE_JOBS.has(j.name) && !/^ {4}if:.*github\.event_name == 'push'/m.test(body(j)))
    .map((j) => j.name);
  return { jobs, checks };
}

/** Add the lockfile updates to the project in `dir`; returns what changed. */
export function adoptLockfile(dir) {
  const at = (rel) => path.join(dir, rel);
  if (!fs.existsSync(at(CI))) return [];
  const changes = [];
  if (!fs.existsSync(at(UPDATE))) {
    fs.writeFileSync(at(UPDATE), UPDATE_WORKFLOW);
    changes.push(`added ${UPDATE}`);
  }
  let text = fs.readFileSync(at(CI), "utf8");
  if (!text.includes("merge-lockfile.yml")) {
    const { jobs, checks } = ciJobs(text);
    if (checks.length) {
      const last = jobs.filter((j) => checks.includes(j.name)).at(-1);
      const lines = text.split("\n");
      const isEnd = last.end >= lines.length || lines.slice(last.end).every((l) => l.trim() === "");
      const head = lines.slice(0, last.end).join("\n").replace(/\n*$/, "\n");
      const tail = isEnd ? "" : `\n${lines.slice(last.end).join("\n").replace(/^\n+/, "")}`;
      text = `${head}\n${lockfileJob(checks)}${tail}`;
      changes.push(`updated ${CI} (lockfile job)`);
    }
  }
  if (!text.includes("notify-dependents.yml") && ciJobs(text).jobs.some((j) => j.name === "publish")) {
    text = `${text.replace(/\n*$/, "\n")}\n${NOTIFY_JOB}`;
    changes.push(`updated ${CI} (notify job)`);
  }
  if (changes.some((c) => c.startsWith(`updated ${CI}`))) fs.writeFileSync(at(CI), text);
  return changes;
}
