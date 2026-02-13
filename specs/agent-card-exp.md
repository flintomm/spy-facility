# Spec: Agent Card EXP Display (REVISED)

## Overview
Add level badges and EXP bars to bottom agent cards in 87 Deer Crossing Lane facility.

## Current State (CORRECTED)
- Agent cards: 160×50px each
- Current layout (stacked vertically within 50px):
  - Row 1: ● Name
  - Row 2: Role
  - Row 3: ● WORKING + state detail ("at desk", "exploring", etc.)
- Data available: level, exp, nextLevel, expProgress from `/api/employee-status`
- Total bar height: 152px (`BAR_H = 152`)
- System info starts at `BAR_Y + 100`, giving ~20px breathing room

## Requirements (REVISED)

### Visual Design (Vertical Stacking)
```
┌──────────────────────────┐
│ ● Flint          Lv.5    │  ← name row + level badge (right-aligned)
│   Lead                   │  ← role row (unchanged)
│   ● WORKING              │  ← status row (unchanged)
│   [██████░░░░] 600/1500  │  ← NEW: EXP bar + fraction
└──────────────────────────┘
```

**Spatial Correction:** Card grows from 50px → 62px. System info at y+100 still fits.

### Level Badge
- Position: right-aligned on name row
- Format: "Lv.{number}"
- Size: 9px font
- Color: agent's color
- Background: dark tint of agent color

### EXP Bar
- Position: new row below status (replaces state detail)
- Size: 80px wide, 5px tall
- Fill: agent's color
- Background: dark gray (#1A1A20)
- Border: 1px subtle border (#2A2A2A)
- Rounded corners: 1px

### EXP Fraction
- Position: right of EXP bar
- Format: "{exp}/{nextLevel}"
- Size: 7px font
- Color: muted gray (#5A6A7A)

## Edge Cases (NEW)

### Level 0 / New Agent
- Show "Lv.0" normally
- EXP bar empty, "0/{nextLevel}"
- No special handling needed

### Max Level (capped)
- If `nextLevel` is null or Infinity
- Show full bar (100%)
- Text: "MAX" or just "{exp}"
- Color: gold (#FFAA00) instead of agent color

### EXP Overflow
- Clamp `expProgress` to `Math.min(progress, 1.0)`
- Don't let bar exceed 100% width

### Missing Data
- If `expProgress` undefined/null
- Compute: `exp / nextLevel`
- If still undefined, hide EXP bar, show only level badge

## Implementation Chunks

### Chunk 1: EXP Bar Drawing Function
```javascript
function drawExpBar(ctx, x, y, width, height, progress, color) {
  progress = Math.max(0, Math.min(1, progress)); // clamp
  // Draw background rect
  // Draw fill rect based on progress
  // Optional: 1px border
}
```

### Chunk 2: Level Badge Drawing Function
```javascript
function drawLevelBadge(ctx, x, y, level, color) {
  // Draw background pill/rect
  // Render "Lv.{level}" text
  // Return width for positioning
}
```

### Chunk 3: Updated Agent Card Layout
- Modify `drawStatusBar()` 
- Add level badge right-aligned on name row
- Replace state detail line with EXP bar row
- Increase card height from 50 → 62px
- Test all 4 agents fit in landscape

### Chunk 4: Edge Case Handling
- Handle max level (null nextLevel)
- Handle overflow (clamp progress)
- Handle missing data (compute or hide)
- Test with various EXP values (0%, 25%, 50%, 75%, 100%, >100%)

## Acceptance Criteria
- [ ] Level badge visible, right-aligned on name row
- [ ] EXP bar shows correct fill percentage (clamped 0-100%)
- [ ] EXP fraction accurate
- [ ] Card height 62px (was 50px)
- [ ] All 4 agents visible in landscape without overflow
- [ ] Max level shows gold bar + "MAX"
- [ ] Missing data handled gracefully
- [ ] No JavaScript errors
- [ ] State detail removed (replaced by EXP)

## Notes
- State detail ("at desk", "exploring") removed to make room for EXP
- Keep font family JetBrains Mono
- Test with all existing agents: Flint, Cipher, Scout
