# Agent Retry Safety Lab

A working, zero-dependency static simulator for nested agent → SDK → transport retries. It models response loss, client timeouts, server completion, retry amplification, stable versus rotating idempotency keys, retention expiry, and reproducible full jitter.

**Live:** https://saipradikmallakuntla-tech.github.io/agent-retry-safety-lab/

## Run
Open `index.html` or serve the directory with any static server. No npm, build step, model API, credentials or backend. GitHub Pages publishes `main` at `/`; `.nojekyll` skips Jekyll processing.

## Working analysis
- Worst-case request count is the product of `(retries + 1)` across the three layers.
- Recursive retry scheduling stops when a child operation receives success.
- Failed requests consume their timeout; successful responses consume fixed processing time.
- Backoff is capped exponential at each layer, optionally sampled with a seeded PRNG.
- Server events are ordered by completion; timed-out work can complete after the caller stops waiting.
- The server ledger models atomic per-intent deduplication until the key expires. Hits do not refresh TTL.
- Duplicate effects count server mutations after the first mutation for each logical operation.
- Fixed 1-second bucket counts visualize synchrony. They are not measured production RPS.

Six built-in scenarios cover an unprotected retry storm, retained stable keys, expired keys, rotating keys, healthy service and definite pre-commit failures. Use **Compare jitter on / off** to compare the same scenario and seed.

## Regression tests
Use the in-app **Run built-in tests** button, or run the exported pure engine without a browser:
```sh
node -e "const a=require('./app.js');const t=a.selfTest();console.table(t);if(t.some(x=>!x.pass))process.exit(1)"
```

## Assumptions and limits
All logical operations start together; layers execute sequentially. Fixed latency, explicit response-loss window, bounded retries and atomic server idempotency are assumptions, not verified provider capabilities. Independent parent deadlines, cancellation, concurrency, speculative retries, queueing, rate limits, circuit breakers and variable processing times are not modeled. Definite pre-commit failure is intentionally different from ambiguous timeouts. Maximum 20,000 potential transport attempts per run; UI shows the first 200 timeline events and 60 occupied histogram buckets.

No real request, tool action, load test, chaos experiment, billing action, or agent execution is performed. This is an offline design aid, not an exactly-once guarantee. Real systems need stable intent keys, payload fingerprints, server enforcement, adequate retention and reconciliation.

## Privacy and structure
No uploads, persistence, analytics, external assets or dependencies. `index.html` contains semantic HTML5 and WebApplication JSON-LD. `styles.css` is responsive and keyboard-friendly. `app.js` contains the engine, fixtures, regression tests, interface and local JSON export. `NETWORK.md` records interlinks.

[Central hub](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/) · [Stream Inspector](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/) · [CORS & Cookie Doctor](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/)

The hub URL is owner-supplied and its availability is independent of this app. No upstream Zion repository or DNS settings are changed.
