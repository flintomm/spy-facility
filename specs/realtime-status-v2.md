# Spec: Real-Time Status v2 — OpenClaw Session Integration

## Problem
Current status detection uses file watcher with 15-second window. During model thinking/generation, no file writes occur, so agents show "idle" when they're actually working. This is inaccurate and dishonest to the user.

## Solution
Poll OpenClaw's session list CLI as the **primary** source of truth for agent activity. The CLI knows exactly which sessions are active, their age, and model — no guessing from file timestamps.

## Implementation

### 1. New Function: `getOpenClawSessions()`

In `server.js`, add a function that runs:
```bash
openclaw sessions list --active-minutes 2 --json 2>/dev/null
```

Parse the JSON output. Each session has:
- `key` — e.g., `agent:main:main` or `agent:main:subagent:UUID`
- `ageMs` — milliseconds since last update
- `model` — current model
- `totalTokens` — token count
- `label` — subagent label (if applicable)

### 2. Session-to-Agent Mapping

Map session keys to facility agents:

```javascript
function mapSessionToAgent(session) {
  const key = session.key;
  const label = (session.label || '').toLowerCase();
  
  // Direct agent sessions
  if (key === 'agent:main:main') return 'Flint';
  if (key === 'agent:cipher:main') return 'Cipher';
  
  // Subagent sessions — check label
  if (label.includes('cipher')) return 'Cipher';
  if (label.includes('atlas')) return 'Atlas';
  if (label.includes('forge')) return 'Forge';
  if (label.includes('sentry')) return 'Sentry';
  if (label.includes('scout')) return 'Scout';
  if (label.includes('patch')) return 'Patch';
  
  // Also check agent-sessions.json mapping
  // (already exists in codebase)
  
  return null;
}
```

### 3. Activity Window

A session is "active" if:
- `ageMs < 120000` (updated within last 2 minutes)
- This captures: streaming, thinking, between tool calls

A session is "working" if:
- `ageMs < 60000` (updated within last 60 seconds)

A session is "idle" if:
- `ageMs >= 120000` or no session exists

### 4. Integration with Existing Status

**Priority order for status detection:**
1. **OpenClaw CLI sessions** (most accurate — knows about active generation)
2. **File watcher** (real-time file changes — good for fast detection)
3. **agent-sessions.json** (manual registration — fallback)

In `getActiveAgentStatus()`:
```javascript
// 1. Get OpenClaw session data
const clawSessions = await getOpenClawSessions();

// 2. Map to agents
for (const session of clawSessions) {
  const agent = mapSessionToAgent(session);
  if (agent && session.ageMs < 120000) {
    status[agent] = true;
  }
}

// 3. File watcher can ALSO mark agents as working
// (existing logic stays — it catches activity between CLI polls)
```

### 5. Polling Interval

The CLI call adds ~200-500ms overhead. Poll every 3-5 seconds (not every request):
```javascript
let clawSessionCache = null;
let clawSessionCacheTime = 0;
const CLAW_POLL_MS = 3000; // Poll OpenClaw every 3 seconds

async function getOpenClawSessions() {
  const now = Date.now();
  if (clawSessionCache && (now - clawSessionCacheTime) < CLAW_POLL_MS) {
    return clawSessionCache;
  }
  
  try {
    const result = execSync(
      'openclaw sessions list --active-minutes 2 --json 2>/dev/null',
      { timeout: 5000, encoding: 'utf8' }
    );
    clawSessionCache = JSON.parse(result).sessions || [];
    clawSessionCacheTime = now;
  } catch (err) {
    // CLI failed — use cached data or empty
    if (!clawSessionCache) clawSessionCache = [];
  }
  
  return clawSessionCache;
}
```

### 6. Also Check Cipher's Sessions Directory

The CLI currently only reads from `agents/main/sessions/sessions.json`. If Cipher has his own agent directory, the CLI might not see his sessions. The server should ALSO read:
```
~/.openclaw/agents/cipher/sessions/sessions.json
```

This is already done (from the SESSIONS_DIRS change). But the CLI might need `--store` flag to read multiple stores.

**Fallback:** If the CLI doesn't see cipher sessions, the file watcher already watches both directories and will catch activity.

### 7. Error Handling

The `openclaw sessions list` command was previously failing with:
```
[CLI] Failed to get sessions: Command failed: openclaw sessions list --active-minutes 2 --json 2>/dev/null
```

This was likely due to the `--active-minutes` flag format. The correct flag is `--active`:
```bash
openclaw sessions list --active 2 --json
# OR
openclaw sessions --active 2 --json
```

Test which format works and use that.

## Files to Modify

1. **`server.js`** — Add `getOpenClawSessions()`, update `getActiveAgentStatus()` to use it as primary source

## Files NOT to Modify

- `index.html` — No frontend changes needed
- `lib/spawnAgent.js` — Not related

## Testing

1. Start Flint working (should show "working")
2. Spawn Cipher subagent (should show "Cipher working")
3. Wait for Cipher to finish (should go "idle" within ~2 min)
4. Verify Flint stays "working" during long thinking pauses
5. Check server logs for `[STATUS]` entries showing CLI data

## Do NOT

- Remove the file watcher — it's still useful for fast detection
- Change REALTIME_WINDOW_MS — the CLI handles the timing now
- Add console.log spam — one log line per status poll is enough
- Touch the frontend
