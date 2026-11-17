# Upstream 0.6.6 integration

Date: 2026-11-17 (Asia/Tokyo). Fork version: `0.6.6-mu.1`.

## Scope

Merged upstream `769905399fde19ee459ade104424e4f630b1104d` into the Luna feature
branch on a separate `codex/approval-review-upstream-0.6.6` branch. No upstream
pull request or direct main-branch commit is part of this change.

- Preserved Luna configuration, API adapter, credential seam, conservative
  gates, three-engine picker and session projection, and English Auto approval
  label with exact legacy-definition migration.
- Preserved the fork's permission preset lifecycle; the bundle does not replace
  the host's permission table.
- Adopted upstream's modern activation barrier, hard read-only child tools guard,
  cancellation/disposal handling, provenance-aware transcript reader and Zod peer.
- Replaced the fork's `message-compat.ts` with `transcript-compat.ts`; a conflicting
  result identity or non-tool source cannot attach review metadata to a tool call.
- Regenerated the npm lock and tracked host/client artifacts. Development targets
  DSH 0.2.2-rc.2 / Zod 4.6.6; the required Zod peer accepts `^4.4.3` from the host.

## Validation

Typecheck, full offline tests and build pass. The suite has 481 passing tests and
4 opt-in paid tests skipped. Added tests preserve Luna handoff rationale for both
human allow and human deny outcomes in the current flat tool-result format.
Existing Luna/LLM/Jev, audit, permission migration and circuit-breaker cases pass.
The modern-child test uses the real scoped tools/native dispatch API: child read
succeeds, a dynamically registered write is rejected before its body runs, and
the parent can still write. No real user tool action or remote model call is made.

`npm run test:package` passes six isolated, strict-peer installations with scripts
disabled: DSH 0.2.2-rc.3, rc.2, rc.1, 0.2.1-rc.2, and 0.1.5-rc.3 with either its
transitive Zod or explicit Zod 4.4.3. Every fixture imports the package, mounts real
host services, registers/folds the review projection, and shares the host's Zod.
The rc.3 fixture shares Zod 4.6.6. These probes are not full-suite execution on
every historical host and are not a Desktop UI approval-execution test.

Run without live credentials:

```sh
env -u TYPESAFE_API_KEY -u OPENAI_LUNA_DECISIONS_API_KEY -u LUNA_LIVE npm run check
env -u TYPESAFE_API_KEY -u OPENAI_LUNA_DECISIONS_API_KEY -u LUNA_LIVE npm run test:package
```

## Desktop rollout

Back up the active desktop profile privately. Quit Desktop and install a reviewed
commit from this fork through the app's plugin manager or its bundled CLI, then
restart the app; hot reload alone may retain an older imported module. Preserve
existing plugin configs and providers, `enabledByDefault: false`, Luna
`autoAllow: false` and the normal interactive access mode. Do not opt into
new external transmission or automatic approval while performing the update.

Verify the running version, English Auto approval entry alongside the Japanese
host access modes, Approvals engine/model selection, and original provider/model
entries. Actual Desktop observations belong in the machine inventory after
rollout; the offline suite and package probes above do not imply live execution.

If rollout fails, reinstall the previous pinned fork commit `4d26845` with the
app stopped, restoring only task-related profile changes from the private backup.
No credential migration is required. See [Luna configuration and limits](luna-decisions.md).
