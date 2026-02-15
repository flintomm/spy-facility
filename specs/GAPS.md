# Gaps Between Specs and Implementation

## 1. Meeting Status & Locations (meeting-status-locations.md)
**Status:** Partially implemented

### Gaps:
- **Server NOT sending meeting data**: The `/api/employee-status` endpoint only returns `{ status: 'ok', agents }` but spec requires:
  - `meetingActive: true/false`
  - `meetingLocation: 'galley' | 'briefing' | 'command'`
  - `meetingSize: 'small' | 'medium' | 'large'`
  
- **Server lacks meeting state tracking**: No `meetingActive` variable or endpoint to start/stop meetings

- **Agent status override missing**: When meeting is active, all agents should show "MEETING" status (amber color), but server returns "working"/"idle"

### What's implemented:
- Frontend has `meetingActive` variable, `MEETING_LOCATIONS` constant, and agent positioning logic
- Frontend has meeting status display (amber color)
- Frontend has agent positioning for meetings

---

## 2. Team Agents (add-team-agents.md)
**Status:** Partially implemented

### Gaps:
- **data/agents.json only has 3 agents**: Flint, Cipher, Atlas
  - Missing: Forge, Patch, Sentry (were removed in team trim)
  
- **No pods for additional agents**: Only 4 pods defined (0-3), no pods 4-6

### What's implemented:
- `index.html` AGENTS array references Atlas
- Status detection for all agent names exists in server.js
- Atlas appears in UI correctly

---

## 3. Lucky Heartbeat Newspaper (lucky-heartbeat-newspaper.md)
**Status:** Implemented ✓

### Verified:
- `NEWSPAPER_SPOT` constant defined
- `heartbeatRecent` variable tracked
- Companion states: 'fetching', 'sniffing', 'returning'
- Lucky runs to newspaper spot on heartbeat

---

## 4. Mobile Vertical Zoom (mobile-vertical-zoom.md)
**Status:** Implemented ✓

### Verified:
- Zoom buttons (+/-)
- Jump buttons (MAP/STATUS)
- Double-tap toggle
- Viewport meta updated
- Touch gesture handling
- RESET button

---

## 5. Real-Time Status v2 (realtime-status-v2.md)
**Status:** Implemented ✓

### Verified:
- `getOpenClawSessions()` function using CLI
- Session-to-agent mapping
- Grace period with `recentlyActive` Map
- File watcher fallback

---

## 6. Todo Complete Behavior (todo-complete-behavior.md)
**Status:** Implemented ✓

### Verified:
- 'complete' action in server.js
- Frontend sends 'complete' instead of 'toggle'
- Confirm dialog 'No' button fix applied

---

## 7. Agent Card EXP (agent-card-exp.md)
**Status:** Implemented ✓

### Verified:
- `drawExpBar()` function
- `drawLevelBadge()` function
- EXP bars in agent cards
- Level badges
- Max level handling (gold color)

---

## Summary Table

| Spec | Status | Gap Summary |
|------|--------|-------------|
| Meeting Status | ⚠️ PARTIAL | Server doesn't send meeting data; no meeting start/stop endpoint |
| Add Team Agents | ⚠️ PARTIAL | Only 3 agents in data file (Forge, Patch, Sentry removed) |
| Lucky Newspaper | ✅ DONE | Fully implemented |
| Mobile Zoom | ✅ DONE | Fully implemented |
| Real-Time Status | ✅ DONE | Fully implemented |
| Todo Complete | ✅ DONE | Fully implemented |
| Agent Card EXP | ✅ DONE | Fully implemented |

---

## Recommended Priority

1. **HIGH**: Meeting status - add server-side meeting state management
2. **LOW**: Team agents - if you want Forge/Patch/Sentry back, need to restore them to agents.json and add pods
