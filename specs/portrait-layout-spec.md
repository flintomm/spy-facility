# Spec: Portrait-First Facility Layout

## Goal
Rearrange the facility for true portrait-friendly vertical flow — narrow canvas with lounge below pods.

## Current Layout Problems
- Canvas: 1100×750 (wide, short)
- Lounge: 320px wide on right side (770-1090)
- Rooms stretch horizontally (10+266+522 = 798px)
- Forces horizontal scrolling on phones

## New Portrait Layout

### Canvas Dimensions
```javascript
const TARGET_WIDTH = 800;   // was 1100
const TARGET_HEIGHT = 1000; // was 750
```

### Room Arrangement (2×2 Grid)
```
┌─────────────┬─────────────┐
│   R&D LAB   │   COMMAND   │
│  (246×160)  │  (246×160)  │
├─────────────┼─────────────┤
│   GALLEY    │   BRIEFING  │
│  (238×160)  │  (replaces  │
│             │   old lounge│
└─────────────┴─────────────┘
```

### Pod Row
- Single row of 4 pods below rooms
- Position: y = 380 (was 206)

### Lounge (Moved Below)
- Full width below pods
- Position: y = 540, height = 200

### Quarters Level (Below Separator)
- Same 3 rooms, positioned lower
- y = 800

### Status Bar
- Still at bottom
- y = 980

## Implementation

### 1. Update Layout Constants
```javascript
const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 1000;

const ROOM_Y = 40;
const ROOM_H = 160;
const POD_Y = 380;  // below 2 rows of rooms
const POD_W = 172, POD_H = 142, POD_GAP = 20;

const LOUNGE_Y = 540;      // below pods
const LOUNGE_W = 780;      // full width minus margins
const LOUNGE_H = 200;

const FLOOR_SEP_Y = 760;   // between ops and quarters
const FLOOR2_Y = 790;
const BAR_Y = 960;
const BAR_H = 140;
```

### 2. Update Room Positions
```javascript
const ROOMS = [
  { name:'R&D LAB', x:40, y:ROOM_Y, w:360, h:ROOM_H },
  { name:'COMMAND', x:420, y:ROOM_Y, w:340, h:ROOM_H },
  { name:'GALLEY', x:40, y:ROOM_Y+ROOM_H+20, w:360, h:ROOM_H },
  { name:'BRIEFING', x:420, y:ROOM_Y+ROOM_H+20, w:340, h:ROOM_H }
];
```

### 3. Update Lounge Position
```javascript
// In renderLounge()
const x = 10, y = LOUNGE_Y, w = LOUNGE_W, h = LOUNGE_H;
```

### 4. Update Pod Positions
```javascript
// PODS stay same x positions but new y
const PODS = [];
for (let c = 0; c < 4; c++) {
  PODS.push({
    x: 40 + c * (POD_W + POD_GAP),
    y: POD_Y,
    w: POD_W, h: POD_H
  });
}
```

### 5. Update Quarters
```javascript
const QUARTER_Y = FLOOR2_Y;
// Rooms stay same but y position changes
```

### 6. Update Corridor Rendering
```javascript
function renderOpsCorridors(c) {
  // Between rooms and pods
  drawFloor(c, 10, ROOM_Y+ROOM_H*2+40, 780, 20);
  // Vertical corridor on right
  drawFloor(c, 742, ROOM_Y, 28, POD_Y+200-ROOM_Y);
}
```

### 7. Update Agent Meeting Positions
```javascript
const MEETING_LOCATIONS = {
  galley: { /* same relative positions, new base y */ },
  briefing: { /* was lounge, now in room grid */ },
  command: { /* same */ }
};
```

### 8. Update Status Bar Layout
```javascript
// 3 agent cards side by side (was 7)
// Cards can be wider: ~250px each
const CARD_W = 250;
const CARD_H = 120;
```

## Visual Result

```
┌─────────────────────────┐ ← Header (30px)
│ ◆ 87 HIGHLAND LANE      │
├──────────┬──────────────┤ ← Rooms (2×2)
│ R&D LAB  │   COMMAND    │
│          │              │
├──────────┼──────────────┤
│ GALLEY   │   BRIEFING   │
│          │   (ex-lounge)│
├──────────┴──────────────┤ ← Corridor
│ ○ ○ ○ ○  Pods           │
├─────────────────────────┤ ← Lounge (full width)
│  [Briefing & Rec area]  │
│    Couch  PingPong      │
├─────────────────────────┤ ← Floor separator
│ ▼ QUARTERS LEVEL ▼      │
├─────┬─────┬─────────────┤ ← Quarters (3 rooms)
│F    │C    │A            │
├─────┴─────┴─────────────┤ ← Status bar
│ [Flint] [Cipher] [Atlas]│
│ EXP bars, levels, etc.  │
└─────────────────────────┘
```

## Files to Modify
- `index.html` — Layout constants, room positions, render functions
- `server.js` — Update any hardcoded canvas references (unlikely)

## Testing
- Desktop: Facility is taller, narrower, still centered
- iPhone 17 portrait: 
  - Canvas 800px wide fits at 0.5× zoom (400px wide on screen)
  - Vertical scrolling shows both floors naturally
  - No horizontal scrolling needed

## Acceptance Criteria
- [ ] Canvas is 800×1000
- [ ] Lounge is below pods, full width
- [ ] Rooms are in 2×2 grid
- [ ] No horizontal overflow on iPhone at 0.5× zoom
- [ ] All agents, pods, rooms visible
- [ ] Status bar shows 3 agent cards
- [ ] Meeting positions updated
- [ ] Lucky's newspaper spot updated
