# Spec: Mobile Vertical Zoom Layout

## Goal
Make the facility usable on a phone held vertically: let Stealth zoom into the map and the status board without losing context, while keeping the desktop view unchanged.

## Current Problems
- `<meta name="viewport">` locks the page at 100% and disables user scaling, so pinch/double-tap zoom do nothing.
- `body` is forced to `height: 100vh` with `overflow: hidden` and `touch-action: none`, preventing both zoom and scroll.
- The canvas is centered in the viewport, so on a tall phone we waste the top/bottom space that could have been used for a scrollable view of the facility.
- There is no quick way to jump between the “map” portion (rooms/pods) and the bottom status board once everything is zoomed in.

## Solution Overview
1. Wrap the canvas in a scrollable shell that stacks vertically on mobile while staying centered on desktop.
2. Allow browser-level zoom (meta viewport, touch-action) AND add lightweight on-screen controls so we can zoom/pan without the browser chrome covering the UI.
3. Provide quick “Map” / “Status” jump buttons that scroll the shell to the top or bottom so both zones are one tap away when zoomed.

## Implementation

### 1. Layout Shell & Vertical Mode
- Wrap `<canvas id="game">` with:
  ```html
  <div class="facility-shell">
    <div class="mobile-toolbar">
      <button data-jump="map">MAP</button>
      <div class="zoom-controls">
        <button data-zoom="out">−</button>
        <span id="zoom-readout">100%</span>
        <button data-zoom="in">+</button>
      </div>
      <button data-jump="status">STATUS</button>
    </div>
    <div id="canvas-viewport">
      <canvas id="game"></canvas>
    </div>
  </div>
  ```
- CSS:
  - Desktop (≥ 720px): keep current centered layout.
  - Mobile (< 720px): set `body` to `flex-direction: column`, `align-items: center`, `padding: 16px`, `overflow-y: auto`.
  - `.facility-shell` gets `width: min(1100px, 100%)`, `max-height: 90vh`, `overflow: auto`, `border-radius: 18px`, subtle border.
  - `#canvas-viewport` is `position: relative; overflow: hidden; touch-action: pan-x pan-y;` so we can apply transforms without jitter.
  - `.mobile-toolbar` sticks to the top of the shell on mobile, hidden on desktop.

### 2. Enable Zoom
- Update `<meta name="viewport">` to `content="width=device-width, initial-scale=1, maximum-scale=4, user-scalable=yes"`.
- Remove `touch-action: none` from `body` and instead use `touch-action: pan-y` (desktop can stay `none`).
- Replace the current scale logic with a `baseScale` (fit-to-width) multiplied by a `userZoom` that ranges from 0.5× to 1.6×.
  ```javascript
  let baseScale = 1;
  let userZoom = 1;
  function updateCanvasScale() {
    const scaleX = window.innerWidth / targetWidth;
    const scaleY = window.innerHeight / targetHeight;
    baseScale = Math.min(scaleX, scaleY, 1);
    applyZoom();
  }
  function applyZoom() {
    const scale = baseScale * userZoom;
    canvas.style.width = `${targetWidth * scale}px`;
    canvas.style.height = `${targetHeight * scale}px`;
    zoomReadout.textContent = `${Math.round(userZoom * 100)}%`;
  }
  ```
- Hook zoom buttons to clamp `userZoom` between `0.55` and `1.6`.
- Add double-tap handler (mobile only) that toggles between `1.0` and `1.4` for quick inspect.
- Optional: if two pointers are down, detect pinch distance and adjust `userZoom` smoothly (store initial distance → ratio).

### 3. Jump Buttons / Focus Helpers
- `data-jump="map"` scrolls `#canvas-viewport` to `top: 0`.
- `data-jump="status"` scrolls to `canvas.scrollHeight - viewport.clientHeight`.
- When `userZoom > 1`, enable panning inside `#canvas-viewport` by setting `overflow: auto`. When `userZoom === 1`, snap back to `scrollTop = 0` so the whole facility fits again.

### Files to Touch
- `index.html` — HTML wrapper, CSS, viewport meta, JS for zoom + jump controls.
- (No backend/server changes.)

### Testing
- Desktop (>= 1024px): layout identical to current; zoom controls hidden.
- iPhone 17 simulator (393×852):
  - Pinch or zoom buttons enlarge the facility, status board legible.
  - MAP/STATUS buttons scroll to respective portions even while zoomed.
  - Double-tap toggles between 100% and 140%.
- Ensure touch interactions for status chips still work when zoomed (hit-testing uses raw canvas size, so continue converting using bounding rect scaling factors).

### Notes
- Keep `handleStatusBarClick` math correct: after zoom changes, `rect.width/height` already reflect scaled size, so no extra adjustments are needed.
- Toolbar buttons should use existing palette colors (C.green/C.barBg) for consistency.
- Everything lives in `index.html` for now to avoid splitting CSS/JS.

### Follow-up Enhancement (2026-02-14)
- Manual pinch gesture support so standalone/fullscreen PWA mode can still zoom in/out (track two-finger distance and drive `userZoom`).
- Dedicated **RESET** button in the toolbar snaps back to 100% and recenters the viewport so users can't get stuck zoomed in.
- Detect `display-mode: standalone` and disable default touch-action so our custom gesture layer always works when the browser's native zoom is unavailable.
- Custom single-finger panning (with tap/drag separation) so zoomed or standalone sessions can drag the map/status board even when the browser blocks native scrolling.
- Touch taps only fire status-bar interactions after the gesture ends and hasn’t moved beyond a small slop, preventing accidental chip taps while dragging.
