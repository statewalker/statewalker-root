# statewalker-root

The root project of the [statewalker](https://github.com/statewalker) ecosystem: where every
development session starts, human or agent. No product code lives here.

| What | Where |
|---|---|
| Agent instructions and the project map | [`CLAUDE.md`](CLAUDE.md) |
| Projects: layers, inventory, known problems | [`docs/projects.md`](docs/projects.md) |
| How work flows: routes, parallel work, releases | [`docs/process/README.md`](docs/process/README.md) |
| How to start, run and end a session; how sessions contribute here | [`docs/process/sessions.md`](docs/process/sessions.md) |
| The reorganization plan | [`docs/refactoring/README.md`](docs/refactoring/README.md) |
| Shared vocabulary and decisions | [`GLOSSARY.md`](GLOSSARY.md), [`docs/adr/`](docs/adr/README.md) |
| Agent skills (from [mattpocock/skills](https://github.com/mattpocock/skills)) | [`.claude/skills/`](.claude/skills), pinned in `skills-lock.json` |
| Plan and progress | [GitHub issues](https://github.com/statewalker/statewalker-root/issues) |

Update the skills with `npx skills@latest update` and review the diff like any other change.
