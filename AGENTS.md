# EventSourcing.NodeJS

Tutorial, practical samples and workshops about Event Sourcing in Node.js and TypeScript.

## Repository structure

Each sample and workshop is a separate npm project with its own `package.json`, `node_modules`, `.nvmrc` and lockfile. There is no shared workspace.

Workshops:

- `workshops/introduction_to_event_sourcing`: self-paced Event Sourcing kit. Exercises are in numbered folders in `src`, solutions in `src/solved`.
- `workshops/event_driven_architecture`: Event-Driven Architecture workshop with the same exercise and solution layout.

Samples (`samples/*`):

- `decider`: basic building blocks.
- `eventsVersioning`, `snapshots`, `closingTheBooks`: specific Event Sourcing patterns.
- `hotelManagement`, `from_crud_to_eventsourcing`, `unpeelingOnion`, `webinar`: larger examples from talks and articles.

## Agent skills

Shared skills live in `.agents/skills/<name>/SKILL.md`. That file is the canonical body, so edit the skill there.

Codex and OpenCode read `.agents/skills/` directly. Claude Code does not, so `.claude/commands/<name>.md` holds a thin pointer that reads the skill file. OpenCode also gets a pointer in `.opencode/commands/<name>.md`, which exposes the skill as a `/name` slash command.

When adding a skill, write the body in `.agents/skills/` with `name` and `description` in the front matter, then add both pointer files.

See `.agents/README.md` for how skills and the change-check hooks work.

## Development

Run development commands from the folder of the sample or workshop you change.

- Use `npm run build:ts` for routine TypeScript validation.
- Use `npm run fix` to apply ESLint and Prettier fixes.
- Use `npm run lint` to check linting without fixing.

### Testing

Tests are implemented using Vitest. Run a specific test file with, for example:

```shell
npm run test:file -- src/solved/01_events_definition/eventsDefinition.simple.solved.test.ts
```

Use `-t` to run a specific test case:

```shell
npm run test:file -- src/solved/01_events_definition/eventsDefinition.simple.solved.test.ts -t "test name"
```

Samples have `npm test` and, depending on the sample, `test:unit`, `test:int`, `test:api` and `test:e2e`. Integration and API tests may start Docker containers through Testcontainers.

In workshops, exercise tests fail until the attendee solves them. Run `npm run test:solved` to check the solutions. `npm test` also runs the exercises, so failing exercise tests there are expected.

The hooks in `.agents` and `.opencode` have their own tests. Run them from the repository root with `npm run test:agents`.

## Verification

The completion hook runs `npm run fix` and `npm run build:ts` automatically in each sample or workshop edited in the session.

For documentation or agent-configuration changes, validate only the changed files and configuration. Application test suites are not required.

While changing application code, identify and run the smallest relevant set of tests covering the affected behavior. Before reporting a development phase as complete, run `npm test` in a changed sample, or `npm run test:solved` in a changed workshop. If a test run is interrupted, ask before running it again.

Report which verification commands were run, whether they passed, and why any relevant checks were skipped.

## Working rules

- Use simple, direct, straightforward language (STE English). Keep explanations concise, example-based, and focused on the problem. Simplify without oversimplifying.
- If a requirement or intended behavior is unclear, ask instead of assuming.
- Do not monkey-patch globals, prototypes, or third-party modules. If a change appears to require monkey-patching, stop and ask first.
- Prefer simple, easily removable code over premature abstractions. Do not introduce a new abstraction unless explicitly requested.
- Do not use comments inside the code unless asked. If you want to do it, review code and make it self-explanatory instead.
- Use a test-first approach for behavior changes. Name tests after observable behavior from the usage perspective, not implementation details.
- Treat questions, design discussions, and requests for opinions as read-only. Wait for explicit approval before editing files or running mutating commands.
- Never reverse a decision already agreed to (a requirement, a behaviour, a test that guards it) unless explicitly approved by that specific reversal. Ask user and explain tradeoffs.
- Plan to use subagents, when available, for independent, non-sequential work that can usefully run in parallel, such as research, repository exploration, focused implementation, verification, and review. Keep user interaction, cross-cutting decisions, and final synthesis in the main context. Ask for that usage before sending them. Don't start subagents with inherit context. Give subagents sufficient context and require concrete, evidence-backed findings so important details are not lost.
- Do not commit, create branches or tags, rebase, reset, or otherwise modify Git history unless explicitly requested.
- Do not add manual line breaks inside Markdown paragraphs. Keep each paragraph on a single line and let the renderer or editor wrap it.

## Coding guide

- Use the module pattern with functions, closures, and object literals instead of classes.
