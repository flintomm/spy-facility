# Spec: Lucky's Newspaper Run (Heartbeat Visualization)

## Goal
When a heartbeat poll fires, Lucky (Flint's Boston Terrier companion) runs to fetch the "newspaper" — a visual indicator of background maintenance activity. This gives the facility life even when agents are idle.

## Behavior

### Trigger
- The server tracks `lastHeartbeat` timestamp
- When the frontend polls `/api/employee-status` and sees `lastHeartbeat` within the last 30 seconds, Lucky enters "newspaper" mode

### Lucky's Newspaper Run
1. Lucky leaves Flint's side and walks to the **newspaper spot** (bottom-left corridor area, near facility entrance)
2. Lucky pauses there for ~3 seconds (sniffing/picking up paper)
3. Lucky walks back to Flint's side
4. Total round trip: ~8-12 seconds depending on distance

### Newspaper Spot Location
- Position: `{ x: 30, y: POD_ROW2_Y + POD_H + 30 }` (bottom-left corridor, near the plant)
- This is near the "entrance" of the facility

## Server Changes (server.js)

### Track heartbeat timestamp
Add a variable:
```javascript
let lastHeartbeatTime = 0;
```

### Detect heartbeat requests
The heartbeat model is MiniMax M2.1. We can detect heartbeat activity by checking if the main session's last JSONL entry is from a heartbeat poll. 

**Simpler approach:** Add a dedicated POST endpoint `/api/heartbeat-ping` that Flint's heartbeat check calls. But since we can't modify OpenClaw's heartbeat behavior...

**Simplest approach:** Track when `/api/employee-status` is polled AND the main session shows activity but no subagent sessions are active. Actually even simpler:

**Use the file watcher data.** When the main session has activity within the REALTIME_WINDOW_MS (15s) but the status would be "working", check if it's a SHORT burst (< 30s of activity after a period of idle). That's a heartbeat.

**ACTUALLY SIMPLEST:** Just add `lastHeartbeat` to the employee-status response. Set it from the watcher — when main session goes active→idle quickly (activity burst < 30s), flag it as heartbeat. 

**REVISED SIMPLEST:** The server already knows when status transitions happen. Add:
1. Track `lastFlintActive` timestamp (when Flint was last seen "working")
2. Track `lastFlintIdle` timestamp (when Flint transitioned to "idle") 
3. If `lastFlintActive` was recent AND `lastFlintIdle` is NOW (activity burst was short), that's a heartbeat-like event
4. Include `heartbeatRecent: true/false` in the API response

Wait — we're overcomplicating this. Let me simplify.

## REVISED: Simple Implementation

### Server (server.js)
1. Add a `lastStatusTransition` tracker:
```javascript
let flintPreviousStatus = false;
let heartbeatDetectedAt = 0;
```

2. In `getActiveAgentStatus()` (or after it returns), detect short bursts:
   - If Flint goes from idle → working → idle within 60 seconds, that's a heartbeat
   - Set `heartbeatDetectedAt = Date.now()`

3. In the `/api/employee-status` response, add:
```javascript
{ agents: [...], meetingActive: false, heartbeatRecent: (Date.now() - heartbeatDetectedAt) < 30000 }
```

### Frontend (index.html) — CompanionEntity changes

1. Add new state `'fetching'` to Lucky's state machine

2. Add newspaper spot constant:
```javascript
const NEWSPAPER_SPOT = { x: 30, y: POD_ROW2_Y + POD_H + 30 };
```

3. In `CompanionEntity.update()`, add heartbeat check:
```javascript
if (heartbeatRecent && this.state !== 'fetching' && this.state !== 'returning') {
  this.state = 'fetching';
  this.target = NEWSPAPER_SPOT;
}
```

4. New states in CompanionEntity:
   - `'fetching'` — walking to newspaper spot
   - `'sniffing'` — at newspaper spot, pause 3 seconds
   - `'returning'` — walking back to owner

5. When Lucky reaches newspaper spot:
   - Enter `'sniffing'` state for 3 seconds
   - Then enter `'returning'` state, target = owner position
   - When back at owner, resume normal `'following'`/`'sitting'`

6. Lucky uses walk sprite during fetch/return, idle sprite (tongue out) during sniff

### Poll data handling
In `pollStatus()`, read `data.heartbeatRecent` and store in global:
```javascript
let heartbeatRecent = false;
// In pollStatus:
heartbeatRecent = data.heartbeatRecent === true;
```

## Files Modified
1. `server.js` — heartbeat detection + API response field
2. `index.html` — Lucky fetching behavior

## Chunks
**Chunk 1:** Server-side heartbeat detection + API field
**Chunk 2:** Lucky newspaper behavior (frontend)

## Testing
- After a heartbeat fires, refresh the facility page. Lucky should run to bottom-left and back.
- When no heartbeat, Lucky follows Flint normally.
- Lucky should not spam newspaper runs — one trip per heartbeat event, cooldown of 60s.

## Edge Cases
- If Flint is working (user chatting), Lucky should NOT fetch newspaper — only on heartbeat-like short bursts
- If Lucky is already fetching, don't interrupt with another fetch
- Meeting active: newspaper run should not override meeting gathering
