# Portrait Mode Issues & Recommendations

## Current State (Problems)

### 1. Canvas Too Wide
- **Current:** 1100×750 pixels (~1.47:1 aspect ratio)
- **iPhone 17:** 393×852 pixels (~0.46:1 aspect ratio)
- **Problem:** Canvas is 2.8× wider than iPhone screen
- **Result:** Even at minimum zoom (0.55×), canvas is 605px wide — still 1.5× screen width

### 2. Horizontal Layout
- Rooms + pods stretch 750px horizontally
- Lounge is 320px wide on the right (770-1090)
- Forces horizontal scrolling on portrait

### 3. Status Bar Too Tall
- 165px tall status bar at bottom
- On 852px tall iPhone, that's 19% of screen
- Reduces visible map area

### 4. Zoom/Pan Required
- User must zoom out and pan to see everything
- Not "native" portrait experience
- Two-handed operation needed

---

## Recommended Solutions (Priority Order)

### Option A: Narrow Canvas + Rearranged Layout (RECOMMENDED)
**Changes:**
1. Reduce canvas to ~800×1000 (0.8:1 aspect ratio)
2. Move lounge BELOW pods instead of beside them
3. Stack rooms vertically or use 2×2 grid
4. Pods in single row of 4 (already done)
5. Quarters below ops floor (already done)

**Result:** Canvas fits within iPhone width at 0.5× zoom

**Effort:** Medium — requires rearranging `renderBackground()` layout constants

---

### Option B: Responsive Canvas Sizes
**Changes:**
1. Detect portrait mode in JavaScript
2. Use different layout constants when `window.innerWidth < window.innerHeight`
3. Portrait layout: narrower, taller canvas
4. Landscape layout: current wide canvas

**Result:** Optimal layout for both orientations

**Effort:** Medium-High — requires two sets of layout constants and conditional rendering

---

### Option C: Mobile-First Simplified View
**Changes:**
1. On mobile (< 720px), hide the pixel-art facility
2. Show only agent cards in a vertical list
3. Add "View Facility" button that opens modal with zoomed facility
4. Focus on status/info, not visual simulation

**Result:** Clean, fast mobile experience

**Effort:** Low — mostly CSS/JS changes, minimal rendering changes

---

### Option D: SVG/Vector Instead of Canvas
**Changes:**
1. Replace canvas with SVG elements
2. Use CSS flex/grid for responsive layout
3. SVG scales naturally to any screen size
4. Keep pixel-art aesthetic with CSS image-rendering

**Result:** True responsive design

**Effort:** Very High — complete rewrite of rendering system

---

## Quick Wins (Cipher Can Do)

1. **Increase MIN_ZOOM to 0.35** — allows fitting full width on iPhone
   ```javascript
   const MIN_ZOOM = 0.35; // was 0.55
   ```

2. **Hide status bar on mobile until scrolled** — more map visibility
   ```css
   @media (max-width: 720px) {
     #status-bar { display: none; }
     .show-status #status-bar { display: block; }
   }
   ```

3. **Auto-zoom to fit on mobile load**
   ```javascript
   if (window.innerWidth < 720) {
     userZoom = Math.min(0.4, MIN_ZOOM);
     applyZoom();
   }
   ```

4. **Rotate canvas 90° in portrait** — sideways facility fills screen better
   ```css
   @media (max-width: 720px) and (orientation: portrait) {
     canvas { transform: rotate(-90deg); }
   }
   ```

---

## My Recommendation

**Phase 1 (Quick):** Implement quick wins #1 and #3 — lower min zoom, auto-fit on mobile

**Phase 2 (Medium):** Option A — narrow canvas with rearranged layout

**Phase 3 (Future):** Option B — fully responsive with different layouts per orientation

The current implementation is "zoomable" but not "native portrait". For a truly great iPhone 17 experience, we need to embrace the vertical format.
