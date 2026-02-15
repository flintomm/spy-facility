# Vera - Interior Designer Agent Setup Summary

## Agent Profile
**Name:** Vera  
**Role:** Interior Designer  
**Color:** #D4A574 (warm wood tone)  
**Level:** 1 (Entry-level)  
**EXP:** 0 / 500  
**Desk:** Briefing Room (custom position near whiteboard)  
**Desk Items:** Succulent, Sketchbook  
**Companion:** Small potted succulent (named "Leaf")  
**Model:** minimax/MiniMax-M2.1 (cheap, creative)

## Files Created/Modified

### 1. data/agents.json
Added Vera entry with:
- Role: Interior Designer
- Color: #D4A574
- EXP: 0, Level: 1
- deskItems: ["succulent", "sketchbook"]
- companion: "succulent"

### 2. data/agent-sessions.json
Added mapping:
```json
"Vera": {
  "label": "vera-interior",
  "role": "Interior Designer",
  "model": "minimax/MiniMax-M2.1"
}
```

### 3. specs/interior-designer-spec.md
Complete specification including:
- Design philosophy (respect walls, logical hallways, interactable objects)
- 2D world building principles
- 6-week incremental improvement roadmap:
  - Week 1: Hallway Foundation
  - Week 2: Wall Collision Improvements
  - Week 3: Furniture States
  - Week 4: Lighting Touches
  - Week 5: Decorative Details
  - Week 6: Interactivity Layer

### 4. index.html
Updated with:
- Vera in AGENTS array (podIndex: null for custom desk)
- CUSTOM_DESK_POSITIONS for Briefing Room placement
- VERA_PAL color palette (warm wood tones)
- VERA_STAND, VERA_WALK1, VERA_WALK2, VERA_SIT sprites
- getSprites() updated to return Vera's sprites
- drawSucculent() and drawSketchbook() functions
- Vera's desk rendered in Briefing Room with nameplate
- Chair appears when Vera not working

### 5. server.js
Updated status detection:
- Added Vera: false to status object
- Added label detection for 'vera' sessions
- Added key pattern detection for 'vera'

## Cron Jobs Created

All jobs run every 6 hours with sessionTarget=isolated and payload=agentTurn:

| Job ID | Name | Task | Label Pattern |
|--------|------|------|---------------|
| 899a93b0-d8bd-4b13-b526-33a32f14d3f1 | vera-hallways | Hallway Design | vera-interior-hallways |
| ba696b3c-fa91-4f0a-8adb-45ff3fc2ebe8 | vera-collisions | Wall Collision | vera-interior-collisions |
| edd4c857-cadd-4553-bfb5-b2f7930acd73 | vera-furniture | Furniture Placement | vera-interior-furniture |
| 3a399a5b-533d-434a-b277-8c7183f0bb4b | vera-lighting | Lighting Touches | vera-interior-lighting |
| ede5eaa1-3dc0-4137-b22a-65765a98ece0 | vera-decorative | Decorative Details | vera-interior-decorative |

### Cron Schedule
All 5 jobs run simultaneously every 6 hours. Each job spawns Vera with a specific interior task. The labels follow the pattern `vera-interior-{task-type}` for status detection.

**Next runs:** Approximately 6 hours from creation time (around 2026-02-15 08:45 EST)

## Visual Placement

Vera's desk is located in the Briefing Room at coordinates (relative to room):
- Desk: x+200, y+90 (70x16px)
- Nameplate: x+210, y+84
- Succulent: x+204, y+80
- Sketchbook: x+248, y+82
- Chair: x+225, y+105 (when idle)

## Agent Movement

Vera uses CUSTOM_DESK_POSITIONS for her base location. When spawned by cron jobs, she will:
1. Start at her Briefing Room desk
2. Walk to work location when status='working'
3. Wander to corridor spots when idle
4. Return to desk when working again

## Status Detection

Vera's active sessions will be detected by:
1. Label containing 'vera' (e.g., vera-interior-hallways)
2. Key containing 'vera'
3. Session activity from agent-sessions.json mapping

---
*Setup completed: 2026-02-14 21:45 EST*
