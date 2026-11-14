// Tests for git-guardrails.mjs at its command-line seam: JSON on stdin, exit code out.
// Run: node --test .claude/hooks/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "git-guardrails.mjs");

// A throwaway repository with the given branch checked out, so "current branch" cases are real.
function repoOn(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardrails-"));
  spawnSync("git", ["init", "-q", "-b", branch, dir]);
  return dir;
}
const onMain = repoOn("main");
const onFeature = repoOn("feature");

function run(command, cwd) {
  const r = spawnSync("node", [HOOK], { input: JSON.stringify({ tool_input: { command } }), cwd, encoding: "utf8" });
  return r.status;
}

const blocked = [
  ["git push --force origin main", onFeature],
  ["git push -f origin main", onFeature],
  ["git push --force-with-lease origin HEAD:main", onFeature],
  ["git push origin +main", onFeature],
  ["git push origin +feature:refs/heads/main", onFeature],
  ["git -C . push --force origin master", onFeature],
  ["git push --force", onMain],
  ["git push -f origin HEAD", onMain],
  ["git push --force --all origin", onFeature],
  ["git push --mirror origin", onFeature],
  [`cd ${onMain} && git push -f`, onFeature],
  [`cd ${onMain} && git push --force origin HEAD`, onFeature],
  [`cd ${onFeature} && git -C ${onMain} push -f`, onFeature],
  ["git push -f", os.tmpdir()],
  ["git reset --hard origin/main", onFeature],
  ["git reset --hard", onFeature],
  ["cd x && git reset --hard HEAD~1", onFeature],
  ["git branch -D feature", onFeature],
  ["git branch -d old", onFeature],
  ["git branch --delete old", onFeature],
  ["git push origin --delete feature", onFeature],
  ["git push origin :feature", onFeature],
  ['bash -c "git push -f origin main"', onFeature],
  ["echo ok; git -c push.negotiate=true push --force origin main", onFeature],
  ["cat > a <<'EOF'\ntext\nEOF\ngit reset --hard", onFeature],
];
const allowed = [
  ["git push -u origin feature", onFeature],
  ["git push --force-with-lease origin feature", onFeature],
  ["git push -f", onFeature],
  [`cd ${onFeature} && git push -f`, onMain],
  ["git -c push.negotiate=true push -u origin claude/20-prevention", onFeature],
  ["git push origin main", onFeature],
  ["git reset --soft HEAD~1", onFeature],
  ["git reset HEAD file.txt", onFeature],
  ["git branch --show-current", onFeature],
  ["git branch -a", onFeature],
  ["git checkout -b new-branch", onFeature],
  ["echo 'git reset --hard is blocked'", onFeature],
  ["ls -la", onFeature],
  ["cat > notes.md <<'EOF'\nrun git branch -D old and git reset --hard here\nEOF\ngit push -u origin feature", onFeature],
  ["cat <<-EOF > x\n\tgit push --force origin main\n\tEOF", onFeature],
];

for (const [cmd, cwd] of blocked) test(`blocks: ${cmd}${cwd === onMain ? " (on main)" : ""}`, () => assert.equal(run(cmd, cwd), 2));
for (const [cmd, cwd] of allowed) test(`allows: ${cmd}`, () => assert.equal(run(cmd, cwd), 0));
test("allows input that is not JSON", () => {
  const r = spawnSync("node", [HOOK], { input: "not json", encoding: "utf8" });
  assert.equal(r.status, 0);
});
