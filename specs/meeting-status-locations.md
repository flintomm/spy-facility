# Spec: Meeting Status and Scalable Locations

## Goal
When meeting is active:
1. Agents in meeting show status "MEETING" not "IDLE"
2. Meeting location scales based on attendance (small/medium/large)

## Part 1: Meeting Status Display

### Server (server.js)
In `/api/employee-status` response, for each agent:
- If `meetingActive === true` AND agent is in meeting position → status = "meeting"
- Otherwise → "working" or "idle" as before

Detection logic:
- An agent is "in meeting" if their current position is approximately at a meeting location
- OR simpler: if meeting is active, ALL agents show "meeting" status (they're all summoned)
- Actually simpler: add `meetingStatus` field to response: `"in-meeting"`, `"working"`, or `"idle"`

Let's go with: When meeting active, all agents get status override to "meeting"

### Frontend (index.html)
- Status chip/card shows "MEETING" (orange/amber color #FFAA00) when meeting active
- Status dot in agent card shows meeting color
- Companion badge shows "📍 meeting" or similar

## Part 2: Scalable Meeting Locations

### Attendance Tiers
- **Small (2-3 agents)**: Galley (current) — intimate, standing at counter
- **Medium (4-6 agents)**: Briefing room — couch, whiteboard, more space
- **Large (7+ agents)**: Command office — big desk, formal setting

### Implementation

#### Server
Add to `/api/employee-status`:
```javascript
{
  agents: [...],
  meetingActive: true,
  meetingLocation: 'galley', // 'galley' | 'briefing' | 'command'
  meetingSize: 'small'       // 'small' | 'medium' | 'large'
}
```

Meeting size logic:
- Count active agents (or just use total agents count for now)
- < 4 agents → small → galley
- 4-6 agents → medium → briefing room  
- 7+ agents → large → command office

#### Frontend

Add meeting position constants:
```javascript
const MEETING_LOCATIONS = {
  galley: {
    small: {
      'Flint': { x: 580, y: 110 },
      'Cipher': { x: 620, y: 110 },
      'Scout': { x: 600, y: 130 },
      // 4th+ agent fills in around stools
    }
  },
  briefing: {
    // Around the coffee table and couch area
    positions: [
      { x: LOUNGE_X + 60, y: ROOM_Y + 180 },   // near couch
      { x: LOUNGE_X + 100, y: ROOM_Y + 150 },  // coffee table
      { x: LOUNGE_X + 140, y: ROOM_Y + 180 },
      { x: LOUNGE_X + 80, y: ROOM_Y + 220 },   // bean bags
      { x: LOUNGE_X + 120, y: ROOM_Y + 200 },
      { x: LOUNGE_X + 160, y: ROOM_Y + 240 },
    ]
  },
  command: {
    // Around the big desk in command office
    positions: [
      { x: ROOMS[1].x + 60, y: ROOMS[1].y + 40 },   // at desk
      { x: ROOMS[1].x + 100, y: ROOMS[1].y + 50 },
      { x: ROOMS[1].x + 80, y: ROOMS[1].y + 80 },
      { x: ROOMS[1].x + 140, y: ROOMS[1].y + 70 }, // near couch
      { x: ROOMS[1].x + 40, y: ROOMS[1].y + 100 },
      { x: ROOMS[1].x + 180, y: ROOMS[1].y + 60 },
      { x: ROOMS[1].x + 200, y: ROOMS[1].y + 90 },
    ]
  }
};
```

Agent assignment to positions:
- Sort agents by name (stable order)
- Assign first N positions based on meeting size
- If more agents than positions, double up or spread in circle

In `AgentEntity.getTargetPos()`:
```javascript
if (meetingActive && meetingLocation) {
  const positions = MEETING_LOCATIONS[meetingLocation];
  // Find this agent's assigned position
  const pos = positions[this.name] || positions.positions?.[agentIndex];
  if (pos) return { x: pos.x - 12, y: pos.y - 20 };
}
```

## Chunks

**Chunk 1:** Server-side meeting status
- Override agent status to "meeting" when meetingActive
- Add meetingLocation and meetingSize to API response
- Determine location based on agent count

**Chunk 2:** Frontend meeting status display
- Show "MEETING" in status chips/cards
- Orange/amber color for meeting status
- Companion status shows meeting

**Chunk 3:** Scalable meeting locations
- Add MEETING_LOCATIONS constant
- Update AgentEntity.getTargetPos() to use location-based positions
- Assign agents to positions based on meeting size

## Testing
- Start meeting with API
- Refresh page
- All agents should show "MEETING" status
- Agents should gather at appropriate location:
  - 2-3 agents → galley
  - 4-6 agents → briefing room
  - 7 agents → command office
- End meeting → agents return to desks, status back to idle/working

## Files Modified
- `server.js` — meeting status override, location logic
- `index.html` — meeting status display, location positions, agent assignment
