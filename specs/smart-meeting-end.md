# Spec: Smart Meeting End Detection

## Goal
Meetings naturally conclude when discussion ends — no manual "end meeting" API call needed. Flint leads and sets the agenda.

## Implementation

### Server (server.js)

**Meeting auto-end trigger:**
- When `meetingActive === true` AND all agents have status === 'idle' for 60+ seconds
- Then auto-end the meeting: `meetingActive = false`
- Log: `[MEETING] Auto-ended - all agents idle`

**Track idle duration:**
- Store `meetingStartedAt` timestamp when meeting begins
- Store `lastAgentActiveAt` timestamp updated when any agent has status !== 'idle'
- If `Date.now() - lastAgentActiveAt > 60000` (60s), auto-end

**Flint's host control:**
- Flint can force-end meeting anytime via API (existing)
- Flint spawns/initiates meetings
- Flint sets agenda — what we're discussing

### Frontend (index.html)

**Meeting indicator:**
- Show "MEETING (Flint hosting)" in status bar
- Show meeting duration timer: "12m 34s"
- Show agenda/notes if provided

**Auto-end notification:**
- Brief "Meeting concluded — all idle" message in activity feed
- Agents automatically return to desks

## Logic Flow

```
Meeting starts (Flint calls API or heartbeat triggers)
        ↓
Agents discuss → some working, some idle
        ↓
If ALL idle for 60s → Auto-end
        ↓
Agents return to desks, status back to normal
```

## Files
- `server.js` — auto-end logic, idle tracking
- `index.html` — meeting timer, host indicator

## Chunks
**Chunk 1:** Server auto-end detection
**Chunk 2:** Frontend meeting timer and host display
