# Luna Decisions reviewer

## Design and provenance (2026-11-08)

This fork adds `luna` beside `llm` and `jev`. The adapter returns `ReviewCallResult`; it does not duplicate the answerer. Policy routing, risk ceiling, scope/authorization gates, review/failure budgets, circuit breaker, sandbox and human answerer chain remain shared. The existing Approvals picker gains the reserved route `openai-decisions/gpt-6-luna`, only with deployment egress consent. Its selection persists using the existing command/session projection, independent of the main agent's model.

Primary specifications inspected:

- [Official Decisions guide](https://developers.openai.com/api/docs/guides/decisions): POST `/v1/decisions`, `gpt-6-luna`, named question/answer arrays, predicates and choices, refusal, application-specific calibration.
- [Official create reference](https://developers.openai.com/api/reference/typescript/resources/decisions/methods/create): response model/answers/usage. The reference fetch timed out; protocol fields were cross-checked against the official guide's complete native examples, not inferred from the reference search snippet.
- [Reference plugin](https://github.com/luobosibing2/deepseek-harness-jev/tree/d2b72299ece45ee0468632e7c4c538798352ea8b), MIT: inspected `packages/jev/src/wire.ts`, types and README. No source copied. It separates Jev/OpenRouter System One from native OpenAI and rejects malformed named arrays. This implementation independently reuses this repository's Apache-2.0 Jev rubric semantics, not reference-plugin code.

| Aspect | Jev (unchanged) | Luna |
|---|---|---|
| Destination | TypeSafe/configured gateway | Official OpenAI URL only |
| Request | `state`, question map, `noul` | JSON string in `input`, named array, `predicate`, choice array |
| Answer | Question-keyed object, probabilities map | Named array; full candidate probability array |
| Probability | Existing Jev thresholds/fallback | Independent Luna margins; no confidence substitution |
| Inspection | No local tools | No local tools; bounded read-only action family |
| Egress | Existing bounded evidence | Smaller packet described below |

## Configuration

Inside the existing approval-review plugin row in the active profile:

```yaml
reviewer:
  engine: luna
  mode: direct
  luna:
    endpoint: https://api.openai.com/v1/decisions
    model: gpt-6-luna
    apiKeyEnv: OPENAI_LUNA_DECISIONS_API_KEY
    timeoutMs: 8000
    allowEgress: true
    autoAllow: false
    allowProbabilityMin: 0.99
    classificationProbabilityMin: 0.99
    prohibitionProbabilityMax: 0.001
```

Use DSH's Credentials settings to save the key under that reference (or resolve it securely via the host credential service); never put its value in YAML. On this Mac the managed credential file is `~/.dsh/.credentials.yaml`; keep it mode 0600. Credential resolution reuses the existing DSH-first/environment-fallback seam on every review, so Finder launch works without shell exports. Exception details from that seam are not logged by Luna. A project key must be permitted to call Decisions; Responses permission alone does not establish that access. Do not change key permissions or issue keys merely to run unit tests.

`allowEgress` is off by default. An LLM/Jev deployment can set `luna.allowEgress: true` to offer Luna in the same Approvals picker without changing its default engine. Existing `typesafe/*` routes still select Jev; normal provider routes still select LLM. `openai-decisions` is now reserved. Invalid Luna model selections are rejected. The only currently documented model is supported; arbitrary model names and gateways are deliberately rejected. No new runtime dependency or SDK is added.

## Meaning of the decision and margins

All eight questions must be valid. Choice names and all candidates must match, with unique probabilities in [0,1], sum within 0.0001 of 1, and a selected maximum. Predicate values must be finite [0,1]. Missing/extra/duplicate answers, refusal, wrong model/type, non-JSON and invalid confidence/distributions fail the entire review. `confidence` is validated but never used as the selected candidate probability.

- Any prohibition at least 0.5, or an explicit refuse choice, yields Deny.
- Otherwise an uncertain choice, low permit/risk/authorization probability, unbounded scope, or any prohibition above the configured maximum yields Delegate.
- `autoAllow: false` also delegates every would-be Allow. With explicit opt-in, only a complete above-margin permit proceeds to the common gates. Critical risk still denies; high-risk authorization/scope and the deployment risk ceiling still apply.
- Equality at permit/classification minima qualifies; equality at prohibition maximum qualifies; equality at 0.5 denies. Ties in a choice cannot pass the >=0.9 minimum.

These are conservative **provisional application margins**, not OpenAI-recommended/calibrated thresholds and not Jev defaults. Evaluate labeled cases before enabling automatic allowance. Shared legacy `onUncertain: allow` and `onReviewerFailure: allow-once` are forcibly overridden to delegate for Luna only. API errors must never become Allow. Jev/LLM behavior is unchanged.

## Egress and deterministic restrictions

Only the proposed tool name, complete already-redacted/bounded arguments (up to 6000 characters) and host-selected user intent (up to 3000 characters, additionally scrubbed) are transmitted. No transcript, tool output, arbitrary ask reason, inspection, attachments or deployment policy override is transmitted. Oversized evidence delegates rather than relying on a truncated action. API credentials appear only in Authorization headers.

Local rules reject recognizable sensitive targets/terms before network dispatch and delegate all tool families except `read`, `glob`, `grep`. Consequently shell, edits, deletion, network and security changes cannot be auto-authorized by Luna. These conservative rules can produce false positives and are not a general secret detector; the host's sandbox/path permissions remain essential. Tools with unknown semantics must not be registered under trusted read-tool names. No file contents are fetched by the adapter. API output prose never becomes an instruction, reason or tool invocation; audit reasons are local templates containing validated enums/numbers.

Redirects are rejected, timeouts/cancellation abort the request, responses are capped at 64KiB while streaming, and raw HTTP bodies/errors are excluded from logs. No retries are added (avoids hidden billing/review duplication).

## macOS Desktop installation and verification

1. Build/test on the feature branch: `npm ci --ignore-scripts && npm run check`. `lib/` is tracked as upstream requires; GitHub installations do not need prepare scripts.
2. Identify the actual active profile (on Neo: `desktop` under `~/.dsh/profiles/desktop`), then back up its package, lock and patch files privately. Never commit those copies.
3. Quit DSH normally. Install a reviewed pinned fork commit:
   `'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh' plugin --profile desktop add 'github:mutsuki629/dsh-approval-review#<reviewed-commit>'`.
4. Inspect the bundle patch before installing: upstream also registers an Auto approval preset and restates the permission table. Reconcile any customized presets rather than overwriting them. Keep the normal interactive approval mode while configuring.
5. Save the credential via DSH, edit only this plugin's `reviewer.luna` settings through the profile UI, enable egress intentionally, and restart. Keep `autoAllow: false` initially.
6. In Approvals select `openai-decisions/gpt-6-luna`; confirm engine/model and reason/duration. Use synthetic read evidence, then uncertainty/error cases with the mock suite. Human delegation remains owned by DSH. Test an allowance only after calibration/explicit autoAllow opt-in.
7. Revert to `llm`/`typesafe/*` using the same picker, or quit and remove this plugin through the CLI to remove its preset. Restore any private profile backup if necessary.

No current Desktop profile or credentials have been modified as part of this delivery. Desktop UI rendering/profile install and paid API calls remain unverified; only source/build and real DSH **library** approval-service integration were tested. This distinction matters: passing a library test is not proof that the installed Desktop exposes the expected extension points.

## Validation and remaining work

`npm run check` covers typecheck, full mock suite (including existing LLM/Jev regressions) and both tracked bundles. New cases cover low-risk Allow, sensitive-target Deny, ambiguity Delegate, 401/403/429/500, timeout, invalid/oversized responses, thresholds, native request shape, egress, model choice, common critical gate, real approval-service budget/fail-open isolation, projection replay and marker round-trip.

Live tests are separately opt-in: `LUNA_LIVE=1 npm test -- tests/luna-live.test.ts`. Obtain user approval for cost and synthetic evidence transmission first; inject the credential only inside the process through a secure resolver. Never put it in command arguments. The test makes one Decisions request and executes no tools. Jev live tests remain opt-in as upstream designed. No measured Jev/Luna latency, cost or accuracy comparison is claimed.

The inherited audit carrier is a tool-result marker. Reviewed allow/deny retains model/reason/duration; a Luna handoff also carries its reason after the human resolves and a compatible result is produced. A pending/cancelled/unavailable human request, or host value-projection result, may lack the marker in the durable ledger. This existing carrier limitation is not solved by inventing new session events.

Known limits: English Luna reason templates; coarse conservative tool/secret gate; no automatic allowance of shell/writes; provisional margins; official endpoint/model only; live API account permission and Desktop behavior pending. npm reports inherited development-tool vulnerabilities (vitest/tinypool critical, @vitest/mocker moderate); runtime-only audit was zero on the completed check. No unrelated forced dependency upgrades were applied.
