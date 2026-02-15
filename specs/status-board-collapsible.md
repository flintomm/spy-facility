# Spec: Status Board — Collapsible Cards & Modern Layout

## Goal
Transform the Status Board into a sleek, modern UI with collapsible/expandable agent cards.

## Problems with Current Design
- Cluttered — 7 agents take up too much space
- No way to focus on specific agents
- Looks dated
- No minimize/maximize

## Solution: Collapsible Card Grid

### Layout
- **Collapsed by default** — compact chips showing name + status dot only
- **Tap to expand** — full card with EXP bar, role, details
- **Grid layout** — 2-3 columns on mobile, 4-5 on desktop
- **Smooth transitions** — expand/collapse animation

### Card States
**Collapsed (Default View):**
```
┌─────────┐
│ ● Flint │  ← color dot + name only
└─────────┘
  60×28px
```

**Expanded (Tap to reveal):**
```
┌─────────────────┐
│ ● Flint  Lv.5  │
│ Lead            │
│ ● WORKING       │
│ ████████░░ 73% │
│ 1100/1500 XP   │
└─────────────────┘
  120×85px
```

### Visual Design
- Rounded corners (8px radius)
- Subtle border/glow on hover
- Smooth scale animation on expand (0.1s ease)
- Color-coded status dots: 🟢 working, 🟡 meeting, 🔴 idle
- Glassmorphism effect — slight blur + transparency

### Interaction
- **Single tap** — expand/collapse individual card
- **Long press** — future: quick actions menu
- **Collapse All button** — in header
- **Expand All button** — see everyone at once
- **Swipe** — horizontal scroll if many agents

### Implementation

#### CSS (injected or inline)
```css
.status-board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  padding: 12px;
}
.agent-card {
  background: rgba(15, 21, 32, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.15s ease;
}
.agent-card.collapsed { height: 32px; overflow: hidden; }
.agent-card.expanded { height: auto; }
.agent-card:hover { border-color: rgba(255,255,255,0.3); }
```

#### Canvas Rendering (if staying canvas-based)
- Draw cards with rounded rectangles
- Store expanded/collapsed state per agent
- Animate height change on state toggle
- Add subtle shadow/glow

### Chunks

**Chunk 1:** Collapsed card rendering
- Draw compact chips (name + status dot)
- Grid layout calculation
- Store collapse state per agent

**Chunk 2:** Expanded card rendering  
- Full card with EXP bar, role, detailed status
- Tap/click detection for expand/collapse

**Chunk 3:** Layout polish
- Grid spacing optimization
- Modern styling (rounded, glass effect)
- Animation/transitions

### Files Modified
- `index.html` — Status Board rendering functions

### Testing
- 7 agents visible without scrolling
- Tap expands to full details
- Tap again collapses
- Works on mobile (tap) and desktop (click)
