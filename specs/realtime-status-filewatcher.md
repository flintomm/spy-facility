# Spec: Real-Time Agent Status (File Watcher)

## Problem
- Current: 5-minute detection window based on sessions.json `updatedAt`
- Reality: JSONL files update in real-time (second-level timestamps)
- Gap: We're checking the wrong file

## Solution
Watch JSONL files for real-time activity. Each write to a session's JSONL = agent is working.

## Implementation Chunks

### Chunk 1: Enhanced JSONL Activity Check
**Quick win — becomes secondary fallback**

Modify `getSessionMessageActivity()`:
- Check last 100 lines (was 50)
- Use 30-second window (was 60s)
- Returns activity status for sessions not in Map (secondary fallback)

**Note:** This survives as fallback, not replaced by watcher.

### Chunk 2: File Watcher Setup
**The real-time solution**

Add `chokidar` dependency:
```javascript
const chokidar = require('chokidar');
const SESSIONS_DIR = path.join(process.env.HOME, '.openclaw/agents/main/sessions');

// Tail-read only last ~4KB to avoid reading entire file
function getLastJsonlEntry(filePath) {
  const stats = fs.statSync(filePath);
  const readSize = Math.min(4096, stats.size);
  const buffer = Buffer.alloc(readSize);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, readSize, stats.size - readSize);
  fs.closeSync(fd);
  
  const text = buffer.toString('utf8');
  const lines = text.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  
  try {
    return JSON.parse(lastLine);
  } catch (e) {
    return null; // Skip partial/invalid lines
  }
}

const sessionActivity = new Map();

// Clean up old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of sessionActivity) {
    if (now - data.lastActivity > 300000) { // 5 min
      sessionActivity.delete(sessionId);
    }
  }
}, 60000);

const watcher = chokidar.watch(path.join(SESSIONS_DIR, '*.jsonl'), {
  persistent: true,
  usePolling: false,
  ignoreInitial: true
});

watcher.on('change', (filePath) => {
  const sessionId = path.basename(filePath, '.jsonl');
  const entry = getLastJsonlEntry(filePath);
  
  if (!entry || !entry.timestamp) return;
  
  sessionActivity.set(sessionId, {
    lastActivity: new Date(entry.timestamp).getTime(),
    model: entry.modelId || entry.model || null
  });
  
  // Invalidate cache: set cachedStatus = null; cacheTimestamp = 0;
  cachedStatus = null;
  cacheTimestamp = 0;
});

watcher.on('unlink', (filePath) => {
  const sessionId = path.basename(filePath, '.jsonl');
  sessionActivity.delete(sessionId);
});
```

**Test:** Spawn subagent → status updates within 1 second

### Chunk 3: Integration
**Wire watcher into status system**

1. Use `sessionActivity` Map in `getActiveAgentStatus()`
2. If session in Map with recent timestamp (< 60s) → agent is working
3. Fall back to sessions.json for older sessions
4. Clean up old Map entries periodically

### Chunk 4: Fallback & Polish
- Remove sessions.json polling dependency (or use as fallback)
- Handle watcher errors gracefully
- Add memory cleanup for Map entries > 5 min old

## Data Flow & Fallback Hierarchy

```
JSONL file written
       ↓
chokidar detects change (no delay)
       ↓
Tail-read last ~4KB (not entire file)
       ↓
Parse last entry timestamp (try/catch)
       ↓
Update sessionActivity Map
       ↓
Cache invalidated (cachedStatus = null)
       ↓
/getAgentStatus returns REAL-TIME
```

**Fallback hierarchy (in getActiveAgentStatus):**
1. **Primary:** sessionActivity Map — recent entries from watcher (< 60s)
2. **Secondary:** getSessionMessageActivity() — direct JSONL read for older activity
3. **Tertiary:** sessions.json updatedAt — final fallback

## Acceptance Criteria
- [ ] Subagent spawn → status shows "working" within 1 second
- [ ] Subagent completes → status shows "idle" within 60 seconds
- [ ] No CPU spikes from file watching
- [ ] Works across restarts (watcher re-initializes)
- [ ] Fallback works if watcher fails

## Dependencies
- `chokidar` — file watcher (npm install)

## Notes
- Scouts recommendation: Phase 2 file watcher
- This is what Scout researched, we verified, now we build
- Following workflow: Spec → Atlas → Cipher → Sentry → Flint
