# Spec: Foolproof Real-Time Agent Status

## Problem
Current approach parses JSONL files with timeout guessing. Not reliable.

## Solution
Use `openclaw sessions list` CLI — the same source Flint uses to check subagents.

## Implementation

### Server calls OpenClaw CLI
```javascript
const { execSync } = require('child_process');

function getActiveSessionsFromCLI() {
  try {
    const output = execSync('openclaw sessions list --active-minutes 2 --json', {
      encoding: 'utf8',
      timeout: 5000
    });
    return JSON.parse(output);
  } catch (err) {
    console.error('Failed to get sessions:', err.message);
    return null;
  }
}
```

### Map sessions to agents
```javascript
function mapSessionsToAgents(sessions) {
  const agentStatus = {
    Flint: 'idle',
    Cipher: 'idle',
    Scout: 'idle',
    Atlas: 'idle',
    Sentry: 'idle'
  };
  
  for (const session of sessions) {
    const label = (session.label || '').toLowerCase();
    const key = session.key || '';
    
    // Main session = Flint
    if (key === 'agent:main:main') {
      agentStatus.Flint = 'working';
    }
    // Subagent labels map to agents
    else if (label.includes('cipher')) {
      agentStatus.Cipher = 'working';
    }
    else if (label.includes('atlas')) {
      agentStatus.Atlas = 'working';
    }
    else if (label.includes('sentry')) {
      agentStatus.Sentry = 'working';
    }
    else if (label.includes('scout')) {
      agentStatus.Scout = 'working';
    }
  }
  
  return agentStatus;
}
```

### Polling interval
- Check every 3 seconds
- Cache for 2 seconds
- CLI call has 5 second timeout

## Benefits
- **Single source of truth** — same data Flint sees
- **No JSONL parsing** — no file system race conditions
- **No timeout guessing** — OpenClaw knows what's active
- **Accurate** — shows exactly who's working

## Acceptance Criteria
- [ ] Server uses `openclaw sessions list` for status
- [ ] Agent status matches what Flint sees via sessions_list tool
- [ ] Status updates within 5 seconds of session change
- [ ] Graceful fallback if CLI fails
