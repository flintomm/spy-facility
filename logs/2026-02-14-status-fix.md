# 2026-02-14 — Telegram Idle Status Fix

## Problem
When replying via Telegram, the facility status board kept Flint marked as "idle" even while actively typing. Root causes:
- `/api/employee-status` returned raw booleans (`true/false`) instead of "working" strings, so the canvas logic never saw `status === 'working'`.
- The backend relied on `openclaw sessions list` to detect activity, but the LaunchAgent environment couldn't resolve `node` when running the CLI, so the command silently failed and no agent was ever marked active.

## Fixes
1. **Status payload** — Converted the API response to emit explicit strings (`"working"` / `"idle"`).
2. **CLI execution** — Call `/opt/homebrew/bin/openclaw` with an explicit PATH (`/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`) so `node` resolves even inside launchd.
3. **Active window** — Treat sessions as "working" if the CLI says they were updated within the last 5 minutes (`CLI_ACTIVE_MS = 300000`), covering longer replies.
4. **Service restart** — Reloaded `com.flint.spyservice` after each change.

## Verification
- Hitting `http://localhost:8080/api/employee-status` while Flint is typing now returns `"status":"working"` for Flint.
- Status board immediately shows Flint's pod in the green "working" state while Telegram replies stream.
