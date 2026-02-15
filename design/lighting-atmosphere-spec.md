# Spy Facility: Room Lighting & Atmosphere Design Spec
**Designer:** Vera  
**Date:** 2026-02-15  
**Status:** Ready for Implementation  
**Priority:** High — Foundation for all future visual work

---

## Design Philosophy

The 87 Highland Lane facility uses **three-zone lighting** to create intuitive navigation and mood:

1. **Operations Zones** (Pods, Command, R&D) — Cool clinical (#00D4FF, #3366CC)
2. **Living Zones** (Quarters, Lounge, Galley) — Warm residential (#D4A574, #F5DEB3)  
3. **Transit Zones** (Hallways, Corridors) — Neutral transition (#8B9CAD, #A0B0C0)

All lighting respects the 8px grid and uses **soft radial gradients** rather than hard edges.

---

## Global Lighting Constants

```javascript
const LIGHTING = {
  // Glow intensities (alpha values for radial gradients)
  AMBIENT_GLOW: 0.15,      // Base room atmosphere
  TASK_LIGHT: 0.35,        // Workstation illumination  
  ACCENT_GLOW: 0.25,       // Decorative highlights
  ALERT_PULSE: 0.50,       // Emergency/urgent states
  
  // Glow radiuses (px)
  RADIUS_SMALL: 24,        // Desktop items, sconces
  RADIUS_MEDIUM: 48,       // Floor lamps, monitors
  RADIUS_LARGE: 80,        // Room ambiance, windows
  RADIUS_XL: 120,          // Central fixtures, meeting areas
  
  // Shadow depths
  SHADOW_SOFT: 'rgba(0,0,0,0.2)',
  SHADOW_MEDIUM: 'rgba(0,0,0,0.4)',
  SHADOW_DEEP: 'rgba(0,0,0,0.6)',
  
  // Animation timing
  PULSE_SLOW: 3000,        // Ambient breathing (3s cycle)
  PULSE_FAST: 1000,        // Alert states (1s cycle)
  FLICKER: 80,             // Monitor/static effects
};
```

---

## Zone 1: Operations — Cool Clinical

### Pod Lighting (Each Agent Workstation)
```
Monitor Glow:
  Position: centered on monitor (x+15, y+12 relative to pod)
  Radius: 40px
  Color: #00D4FF at 0% → transparent at 100%
  Alpha: 0.30 (brighter when agent.status === 'working')
  Alpha working: 0.50

Desk Task Light:
  Position: x+10, y+35 (front edge of desk)
  Radius: 32px  
  Color: #FFFFFF at 0% → #E8F4F8 at 50% → transparent
  Alpha: 0.20

Nameplate Backlight:
  Position: behind nameplate
  Radius: 16px
  Color: agent.color at 0% → transparent
  Alpha: 0.40
```

### R&D Lab Lighting
```
Workbench Task Light:
  Position: x+60, y+40 (center of workbench)
  Radius: 56px
  Color: #FFFFFF at 0% → #D0E8F0 at 60% → transparent
  Alpha: 0.30

Equipment Glow (Oscilloscope):
  Position: x+155, y+36
  Radius: 24px
  Color: #00FF80 (screen green) at 0% → transparent
  Alpha: 0.35
  Animation: flicker every 80-150ms (random)

Ambient Lab Haze:
  Position: room center (x+180, y+80)
  Radius: 120px
  Color: #1A3A5A at 0% → transparent
  Alpha: 0.15
```

### Command Center Lighting
```
Desk Authority Light:
  Position: x+80, y+31 (director's desk)
  Radius: 64px
  Color: #FFD700 at 0% → #FFAA00 at 40% → transparent
  Alpha: 0.25 (gold authority glow)

Monitor Bank Glow:
  Position: x+75, y+22
  Radius: 48px
  Color: #00D4FF at 0% → transparent
  Alpha: 0.30

Couch Ambient:
  Position: x+195, y+72
  Radius: 40px
  Color: #F5DEB3 at 0% → transparent
  Alpha: 0.15 (warm waiting area)
```

---

## Zone 2: Living — Warm Residential

### Quarters Lighting (Per Room)
```
Bedside Sconce (Wall-mounted):
  Position: x+86, y+24 (above bed, right side)
  Radius: 36px
  Color: #D4A574 at 0% → #F5DEB3 at 50% → transparent
  Alpha: 0.35
  
Floor Pool (under bed):
  Position: x+50, y+64
  Radius: 48px
  Color: #2A2018 at 0% → transparent
  Alpha: 0.40 (soft shadow under furniture)

Personal Item Glow:
  Position: varies by quartersItems
  Radius: 16px
  Color: item-specific (gold #FFD700 for medals, etc.)
  Alpha: 0.30
```

### Galley Lighting
```
Overhead Warm Fixture:
  Position: room center (x+110, y+60)
  Radius: 100px
  Color: #F5DEB3 at 0% → #E8D4A8 at 60% → transparent
  Alpha: 0.25

Coffee Machine Ready Light:
  Position: x+188, y+40
  Radius: 12px
  Color: #FF6B35 (amber warm) at 0% → transparent
  Alpha: 0.50
  Animation: slow pulse 3s cycle when status === 'idle'

Counter Task Strip:
  Position: x+85, y+68 (along counter edge)
  Radius: 60px (elliptical)
  Color: #FFFFFF at 0% → transparent
  Alpha: 0.20
```

### Lounge Lighting
```
Central Chandelier Glow:
  Position: x+400, y+100 (center of lounge)
  Radius: 140px
  Color: #F5DEB3 at 0% → #D4A574 at 50% → transparent
  Alpha: 0.30
  
Ping Pong Table Focus:
  Position: x+355, y+78
  Radius: 56px
  Color: #FFFFFF at 0% → #E8F0E8 at 40% → transparent
  Alpha: 0.25

Cozy Corner (bean bags):
  Position: x+200, y+135
  Radius: 48px
  Color: #D4A574 at 0% → transparent
  Alpha: 0.20

Water Cooler Night Light:
  Position: x+147, y+54
  Radius: 20px
  Color: #A0D8EF at 0% → transparent
  Alpha: 0.25 (subtle blue-white)
```

---

## Zone 3: Transit — Neutral Transition

### Primary Corridor (Spine)
```
Floor Path Lighting:
  Position: running along corridor center
  Radius: 40px per segment
  Color: #8B9CAD at 0% → transparent
  Alpha: 0.15
  Pattern: every 48px along corridor length

Wall Wash (upper):
  Position: spine.x + 24, y varying
  Radius: 32px
  Color: #A0B0C0 at 0% → transparent
  Alpha: 0.10
```

### Cross Corridors
```
Intersection Highlight:
  Position: at corridor junctions
  Radius: 64px
  Color: #FFFFFF at 0% → transparent
  Alpha: 0.12 (wayfinding aid)
```

### Pod Loop
```
Rail Glow:
  Position: following inner rail line
  Radius: 16px
  Color: #FFB347 at 0% → transparent
  Alpha: 0.20
  
Portal Transitions:
  Position: where loop meets spine
  Radius: 48px
  Color: #00D4FF at 0% → transparent
  Alpha: 0.15 (cool tech entry)
```

### Lounge Bulb (Turnout)
```
Radial Floor Pattern:
  Position: bulb center
  Radius: bulb.radius - 10
  Color: #F5DEB3 at 0% → #D4A574 at 70% → transparent
  Alpha: 0.20
  
Accent Rings:
  Draw 3 concentric rings at 30%, 60%, 90% of radius
  Color: #FFFFFF at 15% alpha
  Width: 2px each
```

---

## Special Lighting States

### Meeting Active
```
Location Pulse:
  Position: center of meeting location
  Radius: 100px
  Color: #FFAA00 (amber alert) at 0% → transparent
  Alpha: 0.20 → 0.35 (pulsing)
  Animation: 2s cycle, ease-in-out
```

### Night Mode (Future)
```
Global Dim:
  Overlay: rgba(5, 8, 13, 0.4) over entire canvas
  
Emergency Path:
  Position: along primary corridors
  Radius: 24px
  Color: #FF3333 at 0% → transparent
  Alpha: 0.25
  Animation: slow pulse 4s cycle
```

---

## Implementation: Helper Functions

```javascript
// Draw radial gradient light
function drawLightGlow(c, x, y, radius, color, alpha) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  const rgba = hexToRgba(color, alpha);
  gradient.addColorStop(0, rgba);
  gradient.addColorStop(0.5, hexToRgba(color, alpha * 0.6));
  gradient.addColorStop(1, 'transparent');
  c.fillStyle = gradient;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

// Convert hex to rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Animated pulse (call each frame with timestamp)
function getPulseAlpha(baseAlpha, timeMs, durationMs) {
  const t = (timeMs % durationMs) / durationMs;
  const pulse = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
  return baseAlpha * (0.7 + pulse * 0.3);
}
```

---

## Rendering Order

1. **Base room/floor** (darkest layer)
2. **Ambient room glow** (large radius, low alpha)
3. **Furniture/shadows** (cast shadows on floor)
4. **Task lights** (medium radius, higher alpha)
5. **Accent glows** (small radius, item-specific)
6. **Agents/sprites** (lit by environment)
7. **Overlay effects** (meeting pulse, etc.)

---

## Visual Reference

### Color Temperature Guide
| Zone Type | Primary | Secondary | Accent |
|-----------|---------|-----------|--------|
| Operations | #00D4FF (cyan) | #3366CC (blue) | #FFFFFF (white) |
| Living | #D4A574 (wood) | #F5DEB3 (cream) | #FFD700 (gold) |
| Transit | #8B9CAD (gray) | #A0B0C0 (silver) | #FFB347 (amber) |

### Brightness Levels
| Use Case | Alpha | Example |
|----------|-------|---------|
| Ambient atmosphere | 0.10-0.15 | Room haze |
| Decorative accent | 0.20-0.25 | Sconces, plants |
| Task illumination | 0.30-0.35 | Desks, monitors |
| Active/alert | 0.40-0.50 | Working status, alerts |

---

## Success Metrics
- [ ] All rooms have distinct atmospheric character
- [ ] No visual "dead zones" — every area has some light source
- [ ] Agent sprites are clearly visible against all backgrounds
- [ ] 60fps maintained with lighting overlays
- [ ] Lighting enhances navigation (intuitive warm→cool zone transitions)

---

*Design completed by Vera — Lighting Atmosphere System v1.0*
