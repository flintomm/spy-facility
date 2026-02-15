# Status Detection System Audit

**Audited by:** Pulse (Status Monitor)  
**Date:** 2026-02-14  
**System Version:** Real-time Status v3 (Hybrid D+A)

---

## Executive Summary

The facility uses a **hybrid detection system** combining:
1. **Direct CLI polling** (primary, 1s cache) - uses OpenClaw's session list
2. **File watcher** (secondary, 500ms poll) - monitors JSONL files
3. **Context growth tracking** (newly added) - detects actual work vs idle sessions

## Core Components

### 1. Context Growth Tracking (`contextHistory`)

**Purpose:** Distinguish between "session exists" and "session is actively working"

**Implementation:**
```javascript
const contextHistory = new Map(); // sessionKey -> { tokens, lastGrowth }
const CONTEXT_GROWTH_WINDOW_MS = 7000;
```

**How it works:**
- Tracks `totalTokens` for each session from CLI output
- Compares current tokens to previous value
- If `tokens > prev.tokens` → `lastGrowth = now`
- Session considered "working" if growth within 7 seconds

**Potential Issue #1:**
- If a session is created with high token count (e.g., long context), first check shows no growth
- Session won't be marked active until NEXT token increase
- **Impact:** New sessions may appear idle for first 1-7 seconds

### 2. `isSessionActive()` Function

```javascript
function isSessionActive(sessionKey) {
  const now = Date.now();
  const history = contextHistory.get(sessionKey);
  if (!history) return false;  // <-- Issue #2
  return (now - history.lastGrowth) < CONTEXT_GROWTH_WINDOW_MS;
}
```

**Issues Found:**

**Issue #2:** Sessions not in `contextHistory` return `false`
- New sessions only get added to contextHistory when `getOpenClawSessions()` runs
- If CLI poll fails or returns empty, session never gets tracked
- **Fix:** Should return `true` for unknown sessions with recent activity

### 3. CLI Polling (`getOpenClawSessions`)

```javascript
const CLI_POLL_MS = 1000;
```

**Caching behavior:**
- Results cached for 1 second to prevent CLI spam
- Uses `openclaw sessions list --active-minutes 5 --json`

**Potential Issue #3:**
- 5-second timeout on execSync
- If OpenClaw is slow, session data becomes stale
- **Impact:** Status updates delayed up to 5+ seconds

### 4. `RECENTLY_ACTIVE_MS` Grace Period

```javascript
const RECENTLY_ACTIVE_MS = 7000;
const recentlyActive = new Map();
```

**Purpose:** Show "working" for 7 seconds after last detected activity

**How it works:**
1. When activity detected → `recentlyActive.set(agent, Date.now())`
2. If agent not currently active but within 7s grace → still show working
3. After 7s → delete from map, show idle

**Potential Issue #4:**
- Grace period doesn't check if session still exists
- If session terminates during grace period, agent still shows "working"
- **Impact:** False positive (working when actually gone)

### 5. File Watcher Fallback

```javascript
const REALTIME_WINDOW_MS = 15000;
```

**Behavior:**
- Watches `~/.openclaw/agents/main/sessions/*.jsonl`
- Uses last entry timestamp from JSONL
- 15-second window (more lenient than CLI's 7s)

**Potential Issue #5:**
- `sessionIdToAgent` mapping via `mapKeyToAgent` only covers basic patterns
- Pulse, Vera added recently - may not be in legacy agent-sessions.json
- **Impact:** Some sessions may not map to agents

## Timing Analysis

| Component | Interval | Cache | Purpose |
|-----------|----------|-------|---------|
| CLI Poll | 1000ms | 1000ms | Primary detection |
| File Watcher | 500ms | N/A | Real-time updates |
| Context Growth | With CLI | Until expiry | Actual work detection |
| Grace Period | 7000ms | 7000ms | Smooth transitions |

**Total latency from activity → status update:**
- Best case: ~500ms (file watcher)
- Typical: 1000-2000ms (CLI cache + poll)
- Worst case: 5000ms+ (CLI timeout)

## Critical Issues Found

### Issue #1: "Stuck Working" Bug
**Symptom:** Agent shows WORKING when idle  
**Root Cause:** Context history not pruned; sessions with old `lastGrowth` may be considered active if CLI stops updating

### Issue #2: Context History Leak
**Symptom:** Memory growth over time  
**Root Cause:** `contextHistory` Map never deletes old sessions  
**Fix needed:**
```javascript
// Add cleanup in getOpenClawSessions()
for (const [key, data] of contextHistory) {
  if (now - data.lastGrowth > CONTEXT_GROWTH_WINDOW_MS * 2) {
    contextHistory.delete(key);
  }
}
```

### Issue #3: Race Condition on Session Start
**Symptom:** New sessions appear idle for 1-7s  
**Root Cause:** Context history initialized with first token count, needs second poll to detect growth  
**Fix:** Mark new sessions as active for first window period

## Recommendations

1. **Add context history cleanup** - prune sessions older than 14s
2. **Add session existence check** - verify session still in CLI list before applying grace period
3. **Reduce CLI cache** - 500ms instead of 1000ms for snappier updates
4. **Add heartbeat to contextHistory** - mark sessions active on first sight
5. **Log status transitions** - track when agents flip working/idle for debugging

## Validation Status

- [x] `isSessionActive()` found and documented
- [x] `contextHistory` tracking analyzed
- [x] `CONTEXT_GROWTH_WINDOW_MS` behavior understood
- [ ] Test harness created (next task)
- [ ] Cron job set up (next task)
