# Spec: Mobile-First Agent Status Dashboard

## Goal
Redesign the bottom agent status bar to accommodate 7+ agents on mobile (iPhone 17), using vertical space efficiently while maintaining readability.

## Current Problems
- Horizontal card layout: 170px × 7 = 1190px (overflows mobile width)
- Cards are tall (62px) with lots of padding
- No scrolling, agents get cut off
- Status text duplicated (working/idle on card + separate section)

## Proposed Solution: Compact Grid + Expandable Detail

### Layout Change
**Mobile (portrait, width < 600 CSS px):**
- 2-column grid of compact agent chips
- Each chip: 80px wide × 36px tall
- 7 agents = ~4 rows, fits in ~160px height
- Chips show: color dot, name, level badge, mini status dot
- EXP bar hidden in compact view (shown on tap)

**Desktop (width >= 600 CSS px):**
- Keep current card layout but make cards narrower (120px)
- 2 rows of cards if needed

### Compact Chip Design
```
┌─────────────────┐  36px tall
│ ● Flint  Lv.5 ● │  ● = color dot (6px), ● = status dot (green/amber)
└─────────────────┘
     80px wide
```

### Interaction
- **Tap chip** → expands to full card view with EXP bar, role, detailed status
- **Long press** → shows agent menu (spawn, view memory, etc. — future feature)
- Default view: all chips visible, compact

### Implementation

#### CSS Media Query Detection
Since canvas is fixed 1100×720 but scales via CSS, detect "mobile mode" by checking `window.innerWidth` in JS:
```javascript
const isMobile = window.innerWidth < 600; // ~iPhone width in CSS pixels
```

#### `drawStatusBar()` Refactor
Replace single function with:
1. `drawCompactStatusBar()` — 2-column grid, chips only
2. `drawExpandedCard(agent)` — full card for tapped agent
3. `drawDesktopStatusBar()` — current layout, optimized

#### State
```javascript
let selectedAgent = null; // Which agent's card is expanded
let statusViewMode = 'compact'; // 'compact' | 'expanded' | 'desktop'
```

### Vertical Space Usage
- **Compact mode**: ~180px height fits 7-8 agents in 2 columns
- Leave room for system info (uptime, facility status) below or collapse it
- Meeting active banner can overlay or push content up

### iPhone 17 Specific
- Screen: 393 × 852 points @ 3x scale
- Canvas scales to fit width (~393px CSS)
- Compact chips at 80px width = 4.9 chips across, but we're doing 2 columns
- Touch targets: 44px minimum (Apple HIG) — our 36px chips are close, add padding

## Chunks

**Chunk 1:** Compact chip rendering function
- Draw 80×36px chips in 2-column grid
- Color dot, name (truncated if needed), level badge, status dot
- Click/tap detection for selection

**Chunk 2:** Expanded card view
- Full card appears above chips or replaces selected chip
- Shows EXP bar, role, detailed status, last activity
- Close button or tap elsewhere to dismiss

**Chunk 3:** Responsive mode switching
- Detect mobile vs desktop
- Switch between compact grid and desktop cards
- Handle resize events

**Chunk 4:** Touch/click handling
- Hit testing for chip clicks
- Toggle expanded view
- Prevent accidental triggers during scrolling

## Files Modified
- `index.html`: `drawStatusBar()` refactor, add chip drawing, add click handling

## Testing
- iPhone 17: 7 agents visible, no overflow
- Desktop: cards still readable
- Tap to expand works on both
- Meeting banner doesn't overlap critical info

## Design Notes
- Keep existing palette (C.green for working, C.amber for idle)
- Level badge uses agent color on dark background (existing pattern)
- Status dot: filled circle, 6px diameter, right side of chip
- Consider subtle hover/press state for chips
