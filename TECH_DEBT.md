# Technical Debt

Known technical debt and future improvements for MyOhana.

## Architecture

1. **`server/routes.ts` is ~2,200+ lines** — should be split into domain modules (auth, billing, messages, vault, memories, graph, etc.) with a proper router pattern
2. **No service/controller separation** — business logic is mixed with route handlers. Extract services for auth, billing, memory engine, etc.
3. **Wouter hash-based routing** — migrate to history-based routing (React Router or Wouter history mode) if a public landing page is needed

## Performance

4. **`crypto.scryptSync` blocks the event loop** — switch to async `crypto.scrypt` with `util.promisify` if scaling beyond a single-family workload
5. **SQLite single-writer** — migrate to PostgreSQL if >1,000 families (Drizzle ORM supports both dialects with minimal migration effort)
6. **WebSocket has no heartbeat/keepalive** — connections may go stale on mobile or behind proxies. Add ping/pong interval.

## Type Safety & Quality

7. **No TypeScript strict mode** — enable incrementally (`strict: true` in tsconfig.json)
8. **React 18 (not 19)** — upgrade when ecosystem (TanStack Query, Radix, etc.) stabilizes on React 19

## Observability & Testing

9. **No Sentry or error tracking service** — add post-launch for production error visibility
10. **No E2E tests (Playwright)** — add for critical user flows (registration, login, vault upload, billing) post-launch
11. **No automated database backups** — implement nightly backup of `data.db` to S3/R2

## Data

12. **Session store shares the same host as app** — `sessions.db` is separate but on the same volume. Consider Redis for session storage at scale.
13. **Memory engine uses deterministic templates, not AI** — upgrade to LLM-powered narrative generation post-launch
