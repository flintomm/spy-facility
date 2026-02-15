# Spec: Galley Meeting Visuals

## Overview
When a meeting is called, agents visually gather in the galley area of the facility.

## Current State
- Galley is top-right room with stove, fridge, table
- Agents stay at their desks/pods regardless of activity
- No meeting state exists

## Requirements

### Meeting State
- New state: `meeting` (in addition to working/idle)
- API endpoint or status field indicates meeting in progress
- Meeting location: galley coordinates

### Visual Behavior
- When meeting active: agents move to galley area
- Agents stand/sit around the galley table area
- Keep agent colors/names visible
- Lucky follows Flint to galley

### Galley Positions
```
Galley area approx: x=710-960, y=50-220
Meeting spots (around table):
- Spot 1: (780, 120) — head of table
- Spot 2: (820, 100) — left side
- Spot 3: (820, 140) — right side
- Spot 4: (860, 120) — far end
```

### Triggering Meetings
- Manual: API call `/api/meeting?active=true`
- Or: Server detects "galley meeting" in recent messages
- When meeting ends: agents return to pods

## Implementation Chunks

### Chunk 1: Meeting State
- Add `meetingActive` boolean to server state
- Add `/api/meeting` endpoint (GET status, POST toggle)
- Return meeting state in `/api/employee-status`

### Chunk 2: Galley Positions
- Define galley meeting coordinates
- Modify agent rendering to check meeting state
- If meeting: draw agents at galley positions instead of pods

### Chunk 3: Transitions
- Smooth walk animation to galley when meeting starts
- Return to pods when meeting ends
- Lucky follows Flint

## Acceptance Criteria
- [ ] Meeting can be triggered via API
- [ ] Agents visually move to galley
- [ ] Agents visible with names in galley
- [ ] Agents return to pods when meeting ends
- [ ] No JavaScript errors
