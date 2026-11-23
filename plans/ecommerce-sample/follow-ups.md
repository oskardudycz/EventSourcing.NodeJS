# Follow-ups

Work that is out of this spec and plan, to do later. Each item says where it came from.

## Emmett

- **Workflow inbox mode doesn't skip an input it already handled.** Filed as [emmett#434](https://github.com/event-driven-io/emmett/issues/434), with three possible fixes. Source: spec review r3, Quality-4, Q43.
- **`getETagFromIfNotMatch` in emmett-honojs reads the wrong header.** `HeaderNames.IF_NOT_MATCH` is `'if-not-match'` ([etag.ts L10](https://github.com/event-driven-io/emmett/blob/main/src/packages/emmett-honojs/src/etag.ts#L10)), but the HTTP header is `If-None-Match`. The function also throws when the header is missing, so a first conditional read can't use it. The sample's `conditionalRead.ts` reads `If-None-Match` itself until this is fixed. Source: plan step 2.

- `conflictingEventStore` in `packages/application/src` moves to Emmett's `WrapEventStore` behaviours when [emmett#435](https://github.com/event-driven-io/emmett/issues/435) lands.

- The core `ApiE2ESpecification` with `expectAppended` moves to Emmett's merged API specification when [emmett#436](https://github.com/event-driven-io/emmett/issues/436) lands (given requests or event streams, and a check of the events the `when` step appended). Step 8's `hono_api_e2e_specification_steps` branch should build on it.
