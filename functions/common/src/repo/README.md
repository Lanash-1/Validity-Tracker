# Repository layer

Every function talks to storage through the `Repo` interface documented in
`types.js`. Two implementations exist:

- `memory.js` – in-memory, used by unit tests and by `pnpm dev` in `functions/api`
  so the API can run locally without a Catalyst project.
- `catalyst.js` – Catalyst Data Store via `zcatalyst-sdk-node` (Table API for
  writes/gets, ZCQL for queries). See `../../DATASTORE.md` for the table schema.
