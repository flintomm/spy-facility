# Quarters Personalization Design Spec
**Designer:** Vera  
**Date:** 2026-02-15  
**Status:** Ready for Implementation

## Overview
Design a tiered quarters personalization system where agents earn decorative room items as they level up. Each level unlocks 1 new item, creating visual progression that reflects agent growth.

## Design Principles
1. **Uniform base, unique details** — All quarters share the same 120×80px footprint and wall/floor treatment
2. **Grid-aligned placement** — Every item snaps to 8px grid for visual consistency  
3. **Color harmony** — Items use agent's signature color as accent, neutral base tones
4. **Narrative coherence** — Items tell the agent's role story (Cipher = tech, Atlas = architecture, etc.)

---

## Quarter Room Specifications

### Base Structure (All Quarters)
```
Room footprint: 120×80px
Wall color: #1E2A3A (top 24px)
Floor color: #2A3A4A (bottom 56px)
Floor accent: horizontal lines every 16px at 20% opacity #3A4A5A
Door: 24×32px at x=96, y=48, color #3A3A3A with 2px frame #4A4A4A
Nameplate: 4px below room, centered, agent color #XXXXXX
```

### Layout Grid
- 8px base grid
- Item placement zones:
  - **Zone A (Wall):** y=8 to y=20, x=8 to x=112 (hangable items)
  - **Zone B (Floor-left):** y=52 to y=72, x=8 to x=48 (furniture)
  - **Zone C (Floor-right):** y=52 to y=72, x=56 to x=88 (furniture)
  - **Zone D (Corner):** y=40 to y=72, x=8 to x=24 (tall items)

---

## Per-Level Item Catalog

### Level 1 — Foundation (All Agents)
**Item:** Standard bed + small agent-colored accent
```
Bed base: #3A4A5A (neutral)
Bed frame: 44×28px at Zone B center (x=28, y=58)
Pillow: 12×8px at x=32, y=54, color #FFFFFF
Accent blanket: 20×16px at x=36, y=62, color [AGENT_COLOR] at 60% opacity
```

### Level 2 — Personal Touch
Each agent gets a role-specific wall decoration:

| Agent | Item | Position | Colors |
|-------|------|----------|--------|
| Cipher | Framed circuit diagram | Zone A center (x=60, y=12) | Frame: #5A6A7A, Lines: #00D4FF |
| Atlas | Blueprint scroll (rolled) | Zone A right (x=88, y=14) | Paper: #D4C4A4, Ribbon: #3366CC |
| Vera | Color swatch board | Zone A center (x=60, y=12) | Board: #4A3A2A, Swatches: #D4A574, #F5DEB3, #8B4513 |
| Pulse | Status LED panel | Zone A left (x=24, y=12) | Panel: #2A2A2A, LEDs: #39FF14, #FF3333, #FFFF00 |
| Scout | Research corkboard | Zone A center (x=60, y=12) | Board: #8B7355, Notes: #FFFFE0, #E0FFE0 |
| Scrub | Security badge rack | Zone A left (x=20, y=14) | Rack: #4A4A4A, Badges: #8B0000 |

### Level 3 — Comfort Upgrade
**Item:** Side table with agent-specific object
```
Table: 20×20px at Zone C (x=72, y=60), color #4A3A2A
Tabletop items per agent:
- Cipher: Coffee mug (6×6px, #00D4FF) + coaster (#2A2A2A)
- Atlas: Drafting compass (8×8px, #C0C0C0) 
- Vera: Mini succulent (8×10px, #228B22 pot, #90EE90 plant)
- Pulse: Mini status orb (6×6px, pulsing #39FF14)
- Scout: Stack of books (10×8px, #8B4513, #654321)
- Scrub: Sanitizer bottle (6×10px, #FFFFFF body, #8B0000 label)
```

### Level 4 — Ambient Lighting
**Item:** Wall sconce or floor lamp
```
Sconce (wall-mounted): 8×12px at x=8, y=16
- Base: #4A4A4A
- Shade: [AGENT_COLOR] at 40% opacity
- Glow effect: radial gradient 16px radius, center at x=12, y=20

Floor lamp (alternative): 8×32px at Zone D (x=12, y=40)
- Stand: #3A3A3A, 2px width
- Shade: 12×8px at top, [AGENT_COLOR] at 50% opacity
- Light pool: oval 24×12px on floor at #FFFFFF 15% opacity
```

### Level 5 — Personal Artifact
**Item:** Signature object on floor or wall

| Agent | Item | Position | Dimensions | Colors |
|-------|------|----------|------------|--------|
| Cipher | Vintage keyboard | Zone B floor | 24×12px | Case: #2A2A2A, Keys: #00D4FF glow |
| Atlas | Miniature crane model | Zone C table | 12×16px | Boom: #C0C0C0, Cab: #3366CC |
| Vera | Mood board (leaning) | Zone D leaning | 16×24px | Board: #4A3A2A, Polaroids: 4×4px each |
| Pulse | Retro terminal | Zone B floor | 28×20px | Bezel: #3A3A3A, Screen: #39FF14 glow |
| Scout | Globe | Zone C table | 10×10px | Stand: #8B4513, Sphere: #4169E1 |
| Scrub | Evidence storage box | Zone D floor | 16×12px | Box: #5A4A3A, Label: #8B0000 |

### Level 6+ — Mastery Accents
**Item:** Trophy or achievement display
```
Wall-mounted plaque: 24×16px at Zone A center (x=60, y=10)
- Base: #4A4A4A with 2px gold border #FFD700
- Center: Agent's level number in [AGENT_COLOR], 8px font
- Accent: Small gold stars (4×4px) at corners
```

---

## Implementation Notes for Cipher

### Rendering Order (z-index equivalent)
1. Room background (walls/floor)
2. Floor items (bed, table, artifacts)
3. Wall items (frames, boards, sconces)
4. Tabletop items
5. Lighting overlays (glow effects)
6. Agent nameplate (below room)

### Data Structure Addition
```javascript
// Add to agents.json quartersItems structure
quartersItems: [
  { id: "bed", level: 1, type: "floor", x: 28, y: 58 },
  { id: "wall_decoration", level: 2, type: "wall", x: 60, y: 12 },
  { id: "side_table", level: 3, type: "floor", x: 72, y: 60 },
  { id: "lighting", level: 4, type: "wall", x: 8, y: 16 },
  { id: "artifact", level: 5, type: "floor", x: 28, y: 58 }
]
```

### Visual Consistency Rules
- All items render at 1x scale (no scaling)
- Colors use exact hex values provided
- Positions are relative to room top-left (0,0)
- Agent color substitution: Replace [AGENT_COLOR] with agent's color value

---

## Success Metrics
- [ ] All 6 agents have unique level 1 beds implemented
- [ ] Level 2 wall decorations are distinct per role
- [ ] Level 3+ items follow the catalog specifications
- [ ] Visual test: Quarters look cohesive when viewed together
- [ ] Performance: No FPS drop when rendering full quarters row

---

*Design completed by Vera — Quarters Personalization System v1.0*
