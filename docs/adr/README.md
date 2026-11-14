# Architecture decision records

Ecosystem-wide decisions. File name: `YYYY-MM-DD-<slug>.md` (`../agents/domain.md`). Append one
line per ADR, newest last.

- [2026-11-14 root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md): this repository is where every session starts; state in issues, knowledge via one PR per session.
- [2026-11-14 ci-publishing-and-umbrella-retired](2026-11-14-ci-publishing-and-umbrella-retired.md): releases only through CI version pull requests; umbrella archived, its tools moved into `tools/`.
- [2026-11-14 two-tier-review](2026-11-14-two-tier-review.md): a short merge gate blocking only critical findings on every pull request, plus a weekly health review per project.
- [2026-11-14 issues-placed-by-subject](2026-11-14-issues-placed-by-subject.md): an issue about one project goes to that project's tracker; root holds plans and the process; deferred bugs are every open `bug` in a project.
