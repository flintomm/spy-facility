# Lighting Implementation — Quick Reference
**For Cipher** | Extract key values from full spec at `lighting-atmosphere-spec.md`

---

## Core Colors by Zone

| Zone | Primary | Secondary | Accent |
|------|---------|-----------|--------|
| **Operations** | `#00D4FF` | `#3366CC` | `#FFFFFF` |
| **Living** | `#D4A574` | `#F5DEB3` | `#FFD700` |
| **Transit** | `#8B9CAD` | `#A0B0C0` | `#FFB347` |

---

## Glow Presets

| Type | Radius | Alpha | Use For |
|------|--------|-------|---------|
| Ambient | 80-120px | 0.10-0.15 | Room atmosphere |
| Task | 32-56px | 0.30-0.35 | Desks, monitors |
| Accent | 16-24px | 0.20-0.30 | Items, sconces |
| Alert | 100px | 0.20-0.50 | Meeting pulse |

---

## Room-Specific Coordinates

### Operations Zone (Cool)

**Agent Pod:**
```javascript
// Monitor glow
{ x: pod.x + (w/2) - 15 + 15, y: pod.y + 8 + 12, radius: 40, color: '#00D4FF', alpha: agent.status==='working'?0.50:0.30 }

// Desk task light  
{ x: pod.x + 32, y: pod.y + 51, radius: 32, color: '#FFFFFF', alpha: 0.20 }
```

**R&D Lab:**
```javascript
// Workbench
{ x: r.x + 80, y: r.y + 70, radius: 56, color: '#FFFFFF', alpha: 0.30 }

// Oscilloscope (with flicker)
{ x: r.x + 155, y: r.y + 36, radius: 24, color: '#00FF80', alpha: 0.35 }
```

**Command:**
```javascript
// Director's desk (gold authority)
{ x: r.x + 80, y: r.y + 31, radius: 64, color: '#FFD700', alpha: 0.25 }

// Monitor bank
{ x: r.x + 75, y: r.y + 22, radius: 48, color: '#00D4FF', alpha: 0.30 }
```

### Living Zone (Warm)

**Galley:**
```javascript
// Overhead fixture
{ x: r.x + 110, y: r.y + 60, radius: 100, color: '#F5DEB3', alpha: 0.25 }

// Coffee machine
{ x: r.x + 188, y: r.y + 40, radius: 12, color: '#FF6B35', alpha: 0.50 }
```

**Lounge:**
```javascript
// Central chandelier
{ x: 400, y: 100, radius: 140, color: '#F5DEB3', alpha: 0.30 }

// Ping pong table
{ x: 355, y: 78, radius: 56, color: '#FFFFFF', alpha: 0.25 }

// Bean bags cozy corner
{ x: 200, y: 135, radius: 48, color: '#D4A574', alpha: 0.20 }
```

**Quarters (each room):**
```javascript
// Bedside sconce
{ x: q.x + 86, y: q.y + 24, radius: 36, color: '#D4A574', alpha: 0.35 }

// Floor shadow under bed
{ x: q.x + 50, y: q.y + 64, radius: 48, color: '#2A2018', alpha: 0.40 }
```

### Transit Zone (Neutral)

**Corridor Spine:**
```javascript
// Floor path (every 48px along corridor)
{ x: spine.x + 24, y: varying, radius: 40, color: '#8B9CAD', alpha: 0.15 }

// Wall wash
{ x: spine.x + 24, y: varying, radius: 32, color: '#A0B0C0', alpha: 0.10 }
```

**Pod Loop:**
```javascript
// Rail glow
{ along inner rail, radius: 16, color: '#FFB347', alpha: 0.20 }

// Portal transitions
{ at spine junctions, radius: 48, color: '#00D4FF', alpha: 0.15 }
```

---

## Animation Values

```javascript
// Ambient breathing
PULSE_SLOW: 3000  // 3s cycle

// Alert states  
PULSE_FAST: 1000  // 1s cycle

// Monitor flicker
FLICKER: 80-150   // random ms between frames

// Meeting pulse
MEETING_PULSE: 2000  // 2s amber cycle
```

---

## Render Order

1. Base room/floor
2. **Ambient room glow** ← Insert here
3. Furniture/shadows
4. **Task lights** ← Insert here  
5. **Accent glows** ← Insert here
6. Agents/sprites
7. **Overlay effects** ← Insert here (meeting pulse)

---

## One-Line Implementation

```javascript
// Helper function (add to index.html)
function drawGlow(c, x, y, r, hex, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hex + Math.round(a*255).toString(16).padStart(2,'0'));
  g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
}
```

---

*Quick ref extracted from full spec | Vera Design*
