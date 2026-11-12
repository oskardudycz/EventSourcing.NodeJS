# Dev setup alignment with Emmett

Reference: `../emmett/src` (library) and `../emmett/samples/webApi/expressjs-with-postgresql` (sample), checked 2026-11-12 at Emmett `3271b3f9`.

## Emmett target setup

- Node `v24.22.1` in `.nvmrc`, `"type": "module"`, `engines.node >=24`.
- TypeScript 6 (`moduleResolution: bundler`, `target`/`lib` `ESNext`, `types: ["node"]`, `rewriteRelativeImportExtensions`, no `baseUrl`).
- ESLint 10 flat config without `FlatCompat`: `js.configs.recommended`, `typescriptEslint.configs['flat/recommended']`, `['flat/recommended-type-checked']`, `eslint-plugin-prettier/recommended`, `consistent-type-imports`, `--cache`.
- Prettier 3 for `json`/`md` only (`.ts` formatting goes through ESLint), `.prettierrc.json` `{ tabWidth: 2, singleQuote: true }`.
- `npm-run-all2`, `tsx` instead of `ts-node`/`nodemon`.
- Tests: Vitest (`vitest.config.ts`, `testTimeout`/`hookTimeout`, `.unit/.int/.e2e.spec` split).
- VS Code: extensions `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `vitest.explorer`; settings with `[typescript]` format-on-save off; launch "Debug Current Test File" through `vitest.mjs`; tasks `build:ts:watch` + install recommended extensions.
- CI: Node from `.nvmrc`.

## Inventory

| Project                                    | Specs | Node  | ESLint              | Test runner | Emmett | CI workflow                                    | Status                                                                                                                                   |
| ------------------------------------------ | ----- | ----- | ------------------- | ----------- | ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (root)                                 | –     | –     | –                   | –           | –      | –                                              | todo                                                                                                                                     |
| `samples/closingTheBooks`                  | 15    | 20.10 | 8 legacy            | Jest 29     | –      | `samples_closingTheBooks.yml`                  | migrated: tsc clean, tests green, 120 pre-existing ESLint errors                                                                         |
| `samples/decider`                          | 5     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_decider.yml`                          | migrated: tsc clean, tests green, 43 pre-existing ESLint errors                                                                          |
| `samples/eventsVersioning`                 | 11    | 20.10 | 8 legacy            | Jest 29     | –      | `samples_eventsVersioning.yml`                 | migrated: tsc clean, tests green, ESLint clean                                                                                           |
| `samples/foundations`                      | 1     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_foundations.yml`                      | migrated: tsc clean, tests green, 2 pre-existing ESLint errors                                                                           |
| `samples/from_crud_to_eventsourcing`       | 4     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_from_crud_to_event_sourcing.yml`      | migrated: tsc clean, tests green, 4 pre-existing ESLint errors                                                                           |
| `samples/hotelManagement`                  | 1     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_hotelManagement.yml`                  | migrated: tsc clean, tests green, ESLint clean                                                                                           |
| `samples/optimisticConcurrency`            | 4     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_optimisticConcurrency.yml`            | migrated: tsc clean, tests green, 16 pre-existing ESLint errors                                                                          |
| `samples/simple`                           | 2     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_simple.yml`                           | migrated: tsc clean, tests green, ESLint clean                                                                                           |
| `samples/snapshots`                        | 10    | 20.10 | 8 legacy            | Jest 29     | –      | `samples_snapshots.yml`                        | migrated: tsc clean, tests green, 101 pre-existing ESLint errors                                                                         |
| `samples/unpeelingOnion`                   | 3     | 20.10 | 8 legacy            | Jest 29     | –      | `samples_unpeelingOnion.yml`                   | migrated: tsc clean, tests green, 13 pre-existing ESLint errors                                                                          |
| `samples/webinar`                          | 1     | 20.10 | 8 legacy            | none        | –      | `samples_webinar.yml`                          | migrated: tsc clean, no tests, 16 pre-existing ESLint errors                                                                             |
| `workshops/event_driven_architecture`      | 103   | 20.11 | 9 flat + FlatCompat | Jest 29     | 0.38.0 | `workshops_event_driven_architecture.yml`      | done: tsc + lint clean, solved 59 files / 239 tests green                                                                                |
| `workshops/introduction_to_event_sourcing` | 113   | 20.11 | 9 flat + FlatCompat | Jest 29     | 0.38.0 | `workshops_introduction_to_event_sourcing.yml` | done: tsc + lint clean, solved 67 files / 118 tests green (KurrentDB, PostgreSQL, MongoDB from Testcontainers, no docker compose needed) |

Per project, the files to touch: `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `eslint.config.mjs` (replacing `.eslintrc.json` + `.eslintignore`), `.prettierrc.json`, `.prettierignore`, `jest.config.*` + `jest.setup.*` → `vitest.config.ts`, `jest.setTimeout` calls in specs, `.vscode/*`, `Dockerfile` (Node image), the CI workflow, README test instructions.

## Decisions from the EDA workshop (template for the rest)

- Vitest 5 with explicit `import { describe, it, ... } from 'vitest'`, as in Emmett src. Added by the scratchpad script `add-vitest-imports.mjs`; test helpers that call `expect` get the import too.
- `jest.setTimeout` → `testTimeout`/`hookTimeout: 30_000` in `vitest.config.ts`.
- TypeScript as in Emmett src: `typescript` → `npm:@typescript/typescript6` (used by typescript-eslint, `tsc6`), `@typescript/native` → `npm:typescript@^7` (tsgo, the `tsc` bin used by `build:ts`). VS Code: `TypeScriptTeam.native-preview` + `js/ts.experimental.useTsgo`. tsconfig adds `rewriteRelativeImportExtensions`.
- TS 6 needs explicit `rootDir`; set to `./src` so `dist/` layout stays the same. `baseUrl` removed, `moduleResolution: bundler`.
- Express 5 per emmett-expressjs peers; `express-async-errors` and `http-problem-details` dropped (Express 5 handles async errors, emmett-expressjs ships its own problem details, neither was imported).
- `allowScripts` for esbuild, protobufjs, ssh2, cpu-features, as in Emmett.
- Tests in files not matching `*.test.ts` (never ran under Jest) renamed to `.test.ts`.
- Unused infrastructure packages (esdb, mongodb, postgresql, express, testcontainers) kept and bumped.
- `expect.arrayContaining<Message>(...)`: Vitest's typing needs the explicit type argument.
- `Promise.reject(error instanceof Error ? error : new Error(String(error)))`: `no-unnecessary-type-assertion` and `prefer-promise-reject-errors` conflict on `error as Error`.
- `vitest.config.ts` as in Emmett's `vitest.shared.ts`: `resolve.tsconfigPaths: true` (replaces Jest's `moduleNameMapper` for `#core/*`) and `maxWorkers: '50%'` outside CI.
- ESLint 10 recommended adds `no-useless-assignment` and `preserve-caught-error`: drop unread final assignments, pass `{ cause: error }` when rethrowing; exercise scaffolding that assigns before `throw new Error('Not Implemented!')` gets a line disable.
- `@typescript-eslint/no-unnecessary-type-assertion` misfires on evolving arrays (`const events = []`); type the array (`const events: StreamEvent[] = []`) instead of dropping the assertion that TS needs.
- emmett-testcontainers 0.43: `EventStoreDBContainer` moved to `@event-driven-io/emmett-testcontainers/esdb`; testcontainers 12 `MongoDBContainer`/`PostgreSqlContainer` need the image (same as docker-compose).
- `pg` (+ `@types/pg`) is an optional peer of emmett-postgresql 0.43, so projects that use PostgreSQL declare it.
- Express 5: `import 'express-async-errors'` removed; `http-problem-details` kept where imported.
- Database tests as in Emmett's `sharedEventStoreDBGlobalSetup`/`sharedPostgreSQLGlobalSetup`/`sharedMongoDBGlobalSetup`: Vitest projects `kurrentdb`/`postgresql`/`mongodb` with a `globalSetup` starting one container from `emmett-testcontainers` and `provide`-ing its connection string; PostgreSQL/MongoDB spec files get their own database (`sharedPostgreSQLDatabase`/`sharedMongoDBDatabase` in `src/core/testing`), KurrentDB specs share the server with unique stream names; CI needs no docker compose. Containers start only when that project has files to run. This also avoids dumbo's migration race (pending migrations computed before the advisory lock), since no two files migrate the same database.
- CI: `actions/checkout@v6`, `actions/setup-node@v6` with `node-version-file` and npm cache.

## Decisions from the samples

- Samples moved from CommonJS to ESM (`"type": "module"`), with the workshop `tsconfig.json`; `noUncheckedIndexedAccess` kept as each sample had it. Samples with a root `config.ts` use `rootDir: ./` and include it.
- `baseUrl`-relative imports (`from 'src/...'`) rewritten to relative paths.
- Samples and the intro workshop's raw-client exercises (03, 05, 09, 10) use `@kurrent/kurrentdb-client` instead of `@eventstore/db-client`; the workshops keep `@eventstore/db-client` only for Emmett, since `emmett-esdb` peers on it (the Emmett exercises build their `EventStoreDBClient` from `getKurrentDBConnectionString()`). API changes: `EventStoreDBClient` → `KurrentDBClient`, append option `expectedRevision` → `streamState`, `AppendExpectedRevision` → `AppendStreamState`, `WrongExpectedVersionError.expectedVersion`/`actualVersion` → `expectedState`/`actualState`, `readStream` returns `AsyncIterableIterator` (not `StreamingRead`), option types come from the package root. Server image everywhere (samples and workshops, docker-compose and test containers) is `kurrentplatform/kurrentdb:26.2.3` (ARM: `26.2.3-experimental-arm64-10.0-noble`) with `KURRENTDB_*` settings; KurrentDB rejects the removed external TCP options (`EXT_TCP_PORT`, `ENABLE_EXTERNAL_TCP`), so those and the `1113` port are gone. Compose service, volumes and network are named `kurrentdb`, `kurrentdb-volume-*`, `kurrentdb_network` (the three `docker-compose.esdb.yml` files and from_crud referenced a network they never defined; now defined). The intro workshop passes the KurrentDB image to Emmett's `EventStoreDBContainer`, which still sets `EVENTSTORE_*` variables; KurrentDB accepts that legacy prefix. Everything this repo names uses KurrentDB: workshop exercise folders, the Vitest project, the test helpers (`#core/testing/kurrentDB`, `#testing/kurrentDB`, `getKurrentDBTestClient`, `KurrentDBContainer`), config (`config.kurrentDB`, `KURRENTDB_CONNECTION_STRING`, `kurrentdb://` connection strings), `KurrentDBSubscription`, `getSubscriptionToAllWithKurrentDBCheckpointing`, `docker-compose.kurrentdb.yml`, variables and READMEs (linking to `docs.kurrent.io`). Only Emmett's identifiers (`emmett-esdb`, `getEventStoreDBEventStore`, `EventStoreDBEventStore`, Emmett's `EventStoreDBContainer`) and the `EventStoreDBClient` it takes keep their names.
- Subscriptions are consumed with `for await (const resolvedEvent of subscription)` instead of `finished(subscription.on('data', ...))`: no cast to Node's `Readable` (the client's iterator type lacks `Symbol.asyncDispose`), and events are handled one at a time instead of overlapping async `data` handlers. `KurrentDBSubscription` uses the client's `ReadableSubscription<AllStreamResolvedEvent>`.
- Code calling Jest's global `fail(...)` in production code now calls the sample's `failure(...)` Result helper.
- Express 5: optional route params use `{/:param}`; `isNotEmptyString` is a type guard so `req.params` narrows to `string`.
- mongodb 7 / bson 7: `Long.fromBigInt` rejects numbers, `Long.fromValue` used instead.
- Samples keep their own Testcontainers setup (one container per test file); files using the shared, reused `KurrentDBContainer` run with `fileParallelism: false`, so one file stopping the container doesn't break another.
- Dockerized samples bundle with `tsdown` (`build:bundle`), as in the Emmett sample, since Node can't run extensionless ESM imports from `tsc` output. Images copy `package.json` and `config/`. Node image `node:24-alpine`.
- Lint scripts quote the glob (`"**/*.ts"`); the unquoted glob under `sh` only matched one directory level, so most sample code was never linted. The errors this exposed are fixed: string throws became `throw new Error(CODE)` (the two places comparing thrown values check `error.message`), `any` became `unknown` with type guards, route bodies are typed per route, async Promise executors were removed, and floating promises are awaited.
