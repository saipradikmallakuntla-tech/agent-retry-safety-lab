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

## Enterprise case studies and reliability benchmarks — 2026-11-15

Illustrative deployment scenarios and reproducible synthetic diagnostics for the existing three utilities, not customer endorsements or production performance claims.

- [English case study](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/case-studies.html#retry)
- [Caso de estudio en español](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/es/case-studies.html#retry)
- [Estudo de caso em português](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/pt/case-studies.html#retry)
- [Dated release evidence](https://github.com/saipradikmallakuntla-tech/zion-ai-apps-hub/blob/main/CASE_STUDIES_CYCLE_RELEASE.md)

The hub documentation is fully available in EN/ES/PT; this utility interface remains English-only. Links carry no diagnostic input. This cycle changes only `index.html`, `README.md`, and `NETWORK.md` in this repository; `app.js` and `styles.css` are unchanged. Reference outcomes are synthetic and point-in-time, not an SLA, security certification, browser-conformance proof, or exactly-once guarantee.

## Architecture and diagnostic continuation — 2026-11-15

Three practical checks for the existing engine, not new functionality or production guarantees:

### Ambiguous response loss
- **Setup:** Compare the same synthetic layered-retry configuration with no key and a stable intent key retained beyond the loss window.
- **Expected finding:** Inspect effects, duplicates, deduplications, and server-completion order rather than treating a timeout as proof of failure.
- **Interpretation and limits:** A server mutation may finish after a client timeout. Safety assumes atomic server-side enforcement, not merely a client header.

### Retention and key identity
- **Setup:** Keep the fixture and seed fixed; shorten key TTL, then compare per-attempt keys with a stable intent key.
- **Expected finding:** Expired or rotated keys can allow a later request to repeat the side effect; a cache hit does not extend retention.
- **Interpretation and limits:** The model does not verify provider contracts. Real systems need payload fingerprints, adequate retention, and reconciliation.

### Layer budgets and jitter
- **Setup:** Count attempts at agent, SDK, and transport layers; compare backoff modes with the same seed and bounded budgets.
- **Expected finding:** A retry count adds attempts at its layer; nested layers can amplify total requests. Jitter changes scheduling, not intent identity.
- **Interpretation and limits:** Fixed-bucket counts are not measured RPS. Independent parent deadlines, cancellation, rate limits, and speculative concurrency are not modeled.

### Continue through the owned network
- [Inspect stream framing](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/#diagnostic-notes)
- [Inspect browser access and cookies](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/#diagnostic-notes)
- [Architecture and roadmap — English](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/changelog.html#architecture)
- [Arquitectura y hoja de ruta — Español](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/es/changelog.html#architecture)
- [Arquitetura e roteiro — Português](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/pt/changelog.html#architecture)

[Central hub](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/) · [Existing case studies](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/case-studies.html) · [Batch release evidence](https://github.com/saipradikmallakuntla-tech/zion-ai-apps-hub/blob/main/NETWORK_INTERLINK_BATCH_RELEASE.md)

All six roadmap candidates remain proposals, not launched apps. Links carry no diagnostic inputs. EN/ES/PT parity applies to hub documentation; this utility interface remains English-only. This content-only batch preserves `app.js` and `styles.css`, existing showcases, and historical dated evidence. No third-party repository or Pages/DNS setting is changed.

## Failure-mode diagnostics and cross-app triage — 2026-11-15

Batch: `zion-diagnostics-matrix-2026-11-15-en-es-pt`.

Use synthetic or approved sanitized evidence. Review summaries manually: sanitization is not automatic. Links carry no diagnostic inputs, uploads, or shared state. Hub guides have full EN/ES/PT coverage; this utility interface remains English-only.

### Response loss needs framing evidence

- **Trigger:** A timeout leaves stream completion unknown or duplicate intent is suspected.
- **Carry manually:** Synthetic intent label, configured budgets/TTL, modeled attempt/effect counts, and known/unknown completion; never real keys or payloads.
- **Next action and limits:** Inspect an approved sanitized saved capture, not a new production replay. A terminal flag is structural evidence, not proof of semantic correctness or exactly-once execution.
- **Continue:** [LLM Stream Inspector](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/#diagnostic-notes)

### Client failure may hide server success

- **Trigger:** A browser reports failure after a request may have reached the server.
- **Carry manually:** Synthetic origin/site relationship, credential mode, preflight outcome, and whether sending/completion is known; omit credentials.
- **Next action and limits:** Separate response access from cookie policy before classifying a retryable failure. Reconcile server state first; never blindly reflect Origin or automatically repeat a mutation.
- **Continue:** [CORS & Cookie Doctor](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/#diagnostic-notes)

### Matrix languages and reciprocal network

- [Diagnostics matrix — English](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/diagnostics-matrix.html#triage-retry)
- [Matriz de diagnóstico — Español](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/es/diagnostics-matrix.html#triage-retry)
- [Matriz de diagnóstico — Português](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/pt/diagnostics-matrix.html#triage-retry)

[Central hub](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/) · [LLM Stream Inspector](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/#diagnostic-notes) · [CORS & Cookie Doctor](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/#diagnostic-notes)

[Diagnostics cycle release evidence](https://github.com/saipradikmallakuntla-tech/zion-ai-apps-hub/blob/main/DIAGNOSTICS_MATRIX_RELEASE.md). Existing scenarios, case studies, architecture links, engines and styles are preserved. No third-party repository or Pages/DNS setting is changed.

## Batch 22 — Production architecture integration

Keep one synthetic logical intent stable across bounded agent, SDK and transport attempts. Compare key identity, retention and loss/timeout assumptions. An actual backend must coordinate the operation ledger with its side effect; this simulator supplies neither.

Use approved saved framing evidence when completion is unknown, and separate browser access from cookie eligibility. Reconcile actual server outcomes before replay; a timeout is not proof that a mutation failed.

Carry only manually reviewed, synthetic summaries. Omit payloads, personal data, credentials, cookie values and real keys; never encode inputs in navigation URLs. Links transfer no data and provide no automatic sanitizer or shared backend. This utility interface remains English-only.

- [Architecture recipes — English](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/architecture-patterns.html#recipe-retry)
- [Recetas de arquitectura — Español](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/es/architecture-patterns.html#recipe-retry)
- [Receitas de arquitetura — Português](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/pt/architecture-patterns.html#recipe-retry)

[Central hub](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/) · [LLM Stream Inspector](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/#batch-22-integration) · [CORS & Cookie Doctor](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/#batch-22-integration)

[Batch-22 release evidence](https://github.com/saipradikmallakuntla-tech/zion-ai-apps-hub/blob/main/BATCH_22_CONTENT_RELEASE.md). Prior scenarios and links, analysis engines, styles, and Pages/DNS settings are preserved. No third-party repository is changed.


## Batch 99 — expanded seven-node network

This current expansion adds three independent browser-local utilities; all earlier dated notes above remain historical. The original analysis engine and stylesheet are unchanged. No third-party repositories, shared runtime, custom domains or diagnostic URL parameters are introduced.

- [Zion AI Apps Hub](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/) · [source](https://github.com/saipradikmallakuntla-tech/zion-ai-apps-hub)
- [LLM Stream Inspector](https://saipradikmallakuntla-tech.github.io/llm-stream-inspector/) · [source](https://github.com/saipradikmallakuntla-tech/llm-stream-inspector)
- [CORS & Cookie Doctor](https://saipradikmallakuntla-tech.github.io/cors-cookie-doctor/) · [source](https://github.com/saipradikmallakuntla-tech/cors-cookie-doctor)
- [Prompt Token Budget Lab](https://saipradikmallakuntla-tech.github.io/prompt-token-budget-lab/) · [source](https://github.com/saipradikmallakuntla-tech/prompt-token-budget-lab)
- [Tool Schema Drift Auditor](https://saipradikmallakuntla-tech.github.io/tool-schema-drift-auditor/) · [source](https://github.com/saipradikmallakuntla-tech/tool-schema-drift-auditor)
- [Webhook Replay Guard](https://saipradikmallakuntla-tech.github.io/webhook-replay-guard/) · [source](https://github.com/saipradikmallakuntla-tech/webhook-replay-guard)

[Discovery EN](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/batch-99-discovery.html) · [ES](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/es/batch-99-discovery.html) · [PT](https://saipradikmallakuntla-tech.github.io/zion-ai-apps-hub/pt/batch-99-discovery.html). Use only sanitized, manually reviewed evidence. Copy/export/mailto drafts omit raw diagnostic inputs; no email is sent automatically. The full graph has seven repository nodes and 42 non-self directed links, not 42 apps. New estimates and simulations are not tokenization, compatibility, security or exactly-once guarantees. See the hub's `BATCH_99_NETWORK_EXPANSION_RELEASE.md` for dated evidence.
