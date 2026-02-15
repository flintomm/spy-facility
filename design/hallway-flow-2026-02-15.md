# Hallway Flow Upgrade — Week 1

## Summary
The ops floor hallways feel like leftover gaps (20px channels) instead of intentional routes. This pass carves a clear north–south "spine" between R&D → Command → Pods → Lounge, layers in directional floor patterns so the eye understands where to walk, and anchors every junction with paired planters for wayfinding. No furniture moves; we reshape perception with offsets, trim, and living markers.

## Goals
- Establish a legible 3-tile (48px) wide primary corridor from the briefing doors down to the lounge threshold.
- Add floor patterns that reinforce directionality without fighting the warm wood palette.
- Use plants at every T-intersection to slow agents slightly and provide landmark cues.

## Non-Goals
- No lighting changes (those live in Vera's Week 4 rotation).
- No new furniture or wall openings.
- No changes to the lower-floor quarters or bar.

## Current Issues
1. **Pinch Points:** The current ROOM_GAP=20px violates the "3-tile minimum" rule, so R&D↔Command and Galley↔Briefing feel cramped.
2. **Homogenous Planks:** `drawFloor` paints the same bands everywhere, so hallways disappear into room floors.
3. **Empty Intersections:** The cross between pods and lounge is a big blank rectangle with zero anchors; agents drift instead of choosing lanes.

## Design
### 1. Corridor Flow Upgrades
- **Primary Spine (x=386→434):** Treat the center gap as a 48px ribbon. Recess each room's doorway trim by 12px (per side) so the walkway visually widens even though walls remain at x=400/420. Extend this recessed strip from `ROOM_Y-10` down to `LOUNGE_Y+LOUNGE_H+12`.
- **Crossbars:** Add two 32px cross-corridors that connect to rooms:
  - Upper cross at `y=ROOM_Y+ROOM_H/2` for R&D/Command.
  - Lower cross at `y=ROOM_Y+ROOM_H+ROOM_GAP+ROOM_H/2` for Galley/Briefing.
  Each cross uses the same pattern palette but rotated 90° so the eye reads the turn.
- **Pod Loop:** Define a loop lane that wraps the four pods (border inset 16px from pod edges). This loop feeds into the spine via chamfered corners (6px diagonals) to avoid harsh 90° turns.
- **Lounge Turnout:** Widen the junction just above the lounge (y≈520) into a bulb shape (60px diameter arc) so agents can gather before dropping into the open lounge floor.

### 2. Floor Pattern System
Introduce dedicated corridor overlays instead of modifying `drawFloor` globally.

| Element | Palette | Notes |
|---------|---------|-------|
| Spine ribbon | `#3A2F1C`, `#B8863B`, `#8C6A2B` chevrons | Alternating 12px chevrons pointing south. Add to `C` as `corridorBase`, `corridorAccent`, `corridorHighlight`. |
| Crossbars | `#2C3642` base with `#5F7DA2` dashed center line | Cooler tone differentiates east–west motion. |
| Pod loop | `#2B2420` base with thin `#FFB347` rails (4px from edge) | Feels like a track; rails double as queue guides. |
| Junction medallions | 36px circles using `#5C4A38` with a brass inset | Marks pause zones under planters. |

Implementation sketch:
```js
const CORRIDOR_SEGMENTS = {
  spine: { x: 386, y: ROOM_Y - 10, w: 48, h: (LOUNGE_Y + LOUNGE_H + 12) - (ROOM_Y - 10) },
  upperCross: { x: ROOMS[0].x, y: ROOM_Y + ROOM_H/2 - 16, w: ROOMS[1].x + ROOMS[1].w - ROOMS[0].x, h: 32 },
  lowerCross: { x: ROOMS[2].x, y: ROOMS[2].y + ROOM_H/2 - 16, w: ROOMS[3].x + ROOMS[3].w - ROOMS[2].x, h: 32 },
  podLoop: { inset: 16 }
};
```
Add `drawCorridorPattern(ctx, segment, type)` that overlays translucent geometry after `drawFloor` but before furniture.

### 3. Plant Landmarks
Use the existing `drawPlant` primitive with `size=1.3` and pair them with low planters.

| Junction | Coordinates (approx) | Treatment |
|----------|----------------------|-----------|
| R&D ⇄ Command (upper T) | `(386, ROOM_Y+60)` and `(420, ROOM_Y+60)` | Twin planters against each wall recess. Add brass floor medallion under each pair. |
| Galley ⇄ Briefing (mid T) | `(386, ROOM_Y+ROOM_H+ROOM_GAP+70)` mirrored | Same treatment; rotate plants 12° to lean toward the turn (offset leaf rectangles). |
| Pod Loop north/south entries | `(386, POD_Y-12)` and `(386, POD_Y+POD_H+12)` | Stackable planter boxes (two-tier) to signal speed-change areas. |
| Lounge bulb | Four small planters at 90° intervals around the circular turnout | Creates a "ring" that frames the descent into lounge. |

Add a lightweight data structure:
```js
const CORRIDOR_PLANTS = [
  { x: 382, y: ROOM_Y + 52, size: 1.3 },
  { x: 426, y: ROOM_Y + 52, size: 1.3 },
  // ...other junctions
];
```
Loop through and call `drawPlant(ctx, x, y, size)` after corridor patterns.

## Implementation Steps
1. **Geometry Prep**
   - Update `drawWalls` to render 12px recesses around doorways (only visually; collision map unchanged).
   - Add corridor segment constants + helper for pod loop path (rounded corners from `ctx.arc`).

2. **Pattern Rendering**
   - Extend palette `C` with corridor colors.
   - Implement `drawCorridorPattern(ctx, segment, patternType)` with deterministic chevron math (use modulo on local coordinates to avoid seams).
   - Render patterns immediately after base floors but before room furniture/pods.

3. **Plant Anchors**
   - Define `CORRIDOR_PLANTS` array; support optional `rotation` so leaves can lean toward traffic.
   - Render planters after corridor patterns so they sit on medallions but before agents spawn.

4. **Testing**
   - Screenshot before/after for each junction.
   - Verify no plant boxes overlap existing pod hitboxes (keep ≥8px breathing room).

## Open Questions
- Should corridor colors dim when meeting mode is active (to avoid conflicting highlights)?
- Do we need micro-animations (leaf sway) now or wait for Week 5 Decorative pass?

## Related
- `specs/interior-designer-spec.md`
- `specs/vera-setup-summary.md`
