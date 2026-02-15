# Gyroscopic Depth — Spy Facility Enhancement

## Concept
Parallax 3D effect using device gyroscope. Tilting phone moves "camera" angle, casting dynamic shadows that create depth illusion — like looking into a physical diorama.

---

## Architecture Review (2026-02-13)

### Current State Analysis
The facility is a **single Canvas 2D** app (1100×720, pixel art). Static elements render to an offscreen `bgCanvas`, then sprites + UI draw each frame via `requestAnimationFrame`. No WebGL, no DOM layers for game elements.

### Q1: Is the 4-phase approach correct?

**Verdict: Restructure.** The original phases are logically sound but implementation-coupled wrong. Phases 2 (Depth Layers) and 3 (Dynamic Shadows) are entangled — you can't test shadows without layers, and layers without movement look like nothing. The gyro input (Phase 1) is also over-scoped as a standalone phase since you need visual feedback to calibrate smoothing.

**Revised phasing below.**

### Q2: What's the MVP?

**MVP = Gyro input + 2 CSS-transformed layers + no shadows.**

Minimum to *see the effect*:
1. Split rendering into 2 stacked `<canvas>` elements (background + foreground)
2. Hook `deviceorientation` with basic smoothing
3. Apply CSS `translate3d()` to each canvas with different parallax coefficients
4. That's it. Tilt phone → layers shift → depth illusion works.

**Time estimate: ~2-3 hours for someone familiar with the codebase.**

### Q3: Performance concerns for mobile canvas?

**Yes, significant — but solvable.**

| Concern | Risk | Mitigation |
|---------|------|------------|
| Canvas redraw per-frame with offsets | HIGH | Use CSS transforms instead (GPU-composited, zero JS paint cost) |
| Multiple canvas compositing | LOW | Modern mobile GPUs handle 3-4 stacked canvases fine |
| `deviceorientation` event frequency | MEDIUM | Events fire at 60Hz+; use LERP, don't redraw on every event |
| Shadow gradient computation | MEDIUM | Pre-compute shadow sprites, don't use real-time gradients |
| Memory (multiple offscreen canvases) | LOW | 1100×720 × 4 canvases ≈ 12MB VRAM, well within budget |
| iOS permission UX | BLOCKER if missed | Must handle `DeviceOrientationEvent.requestPermission()` on user gesture |

**Key insight:** The existing architecture already separates static bg from dynamic sprites. This maps perfectly to a multi-canvas-layer approach.

### Q4: CSS transforms vs canvas redraw?

**CSS transforms. Strongly recommended.**

| Approach | Pros | Cons |
|----------|------|------|
| **CSS `transform: translate3d()`** | GPU-composited, zero paint cost, buttery 60fps, trivial to implement | Can't do per-object parallax within a layer |
| **Canvas redraw with offset** | Per-object control, single canvas | Repaints entire scene every frame, kills mobile perf |
| **WebGL** | Ultimate control, shaders for shadows | Massive rewrite, overkill for pixel art |

**Recommendation:** Use CSS transforms for layer-level parallax (3-4 layers). If individual object parallax is needed later (e.g., foreground agent moves differently than desk), handle it as a sprite offset within the existing draw loop — but this is Phase 3 polish, not MVP.

The `translate3d()` approach triggers GPU composition automatically. The browser treats each canvas as a texture and shifts it on the GPU — no JavaScript paint work at all.

### Q5: Recommended chunk breakdown?

See Implementation Plan below.

---

## Revised Implementation Plan

### Chunk 1: Multi-Canvas Layer Split (Foundation)
**Effort: Medium | Risk: Low | Prerequisite: None**

Split the single canvas into stacked layers:

```
<div id="scene" style="position:relative; overflow:hidden">
  <canvas id="layer-bg">    <!-- Floor, walls, furniture (Layer 0) -->
  <canvas id="layer-mid">   <!-- Desk items, chairs, static objects (Layer 1) -->
  <canvas id="layer-fg">    <!-- Agents, companions, dynamic sprites (Layer 2) -->
  <canvas id="layer-ui">    <!-- Status bar, header, UI overlays (Layer 3) -->
</div>
```

**Tasks:**
- [ ] Create scene container div with `position:relative; overflow:hidden`
- [ ] Split `renderBackground()` into `layer-bg` (floor/walls) and `layer-mid` (furniture/desk items)
- [ ] Move agent/companion rendering to `layer-fg`
- [ ] Move `drawStatusBar()` to `layer-ui`
- [ ] Verify visual parity with current single-canvas output (screenshot diff)
- [ ] Ensure `updateCanvasScale()` handles all layers

**Key detail:** Each canvas gets same dimensions (1100×720). The offscreen `bgCanvas` pattern stays — just split into two offscreen buffers. `layer-fg` and `layer-ui` still redraw each frame (they already do).

**Acceptance:** Facility looks identical to current version. No visual regression.

---

### Chunk 2: Gyro Input + CSS Parallax (MVP ✨)
**Effort: Medium | Risk: Medium (iOS permissions) | Prerequisite: Chunk 1**

Wire up device orientation and apply parallax via CSS transforms.

**Tasks:**
- [ ] Create `GyroController` class:
  ```js
  class GyroController {
    constructor() {
      this.tiltX = 0; // -1 to 1 (normalized)
      this.tiltY = 0; // -1 to 1
      this.smoothX = 0;
      this.smoothY = 0;
      this.enabled = false;
      this.lerpFactor = 0.08; // smoothing
    }
    async requestPermission() { /* iOS 13+ gesture-gated */ }
    onOrientation(e) { /* normalize beta/gamma to -1..1, clamp */ }
    update() { /* LERP smooth values toward raw values */ }
  }
  ```
- [ ] iOS permission flow: Show a "Enable Gyro" button on first visit, call `DeviceOrientationEvent.requestPermission()` on tap
- [ ] Fallback: mouse position maps to tiltX/tiltY for desktop testing
- [ ] Apply transforms in animation loop:
  ```js
  const PARALLAX = [0, 0.3, 0.6, 0]; // per-layer coefficients
  // Layer 0 (bg): no movement — anchor point
  // Layer 1 (mid): subtle shift
  // Layer 2 (fg): more shift — agents feel "closer"
  // Layer 3 (ui): no movement — HUD stays fixed
  layers.forEach((canvas, i) => {
    const px = gyro.smoothX * PARALLAX[i] * MAX_SHIFT;
    const py = gyro.smoothY * PARALLAX[i] * MAX_SHIFT;
    canvas.style.transform = `translate3d(${px}px, ${py}px, 0)`;
  });
  ```
- [ ] Set `MAX_SHIFT` to ~15px (subtle) — too much breaks pixel art illusion
- [ ] Add `will-change: transform` to parallax layers for GPU hint

**Acceptance:** Tilt phone (or move mouse on desktop) → layers shift at different rates → depth illusion visible. No shadows yet.

---

### Chunk 3: Dynamic Shadows
**Effort: High | Risk: Medium | Prerequisite: Chunk 2**

Add tilt-reactive shadows to agents and key furniture.

**Tasks:**
- [ ] Define light source position (fixed top-left: `lightX=200, lightY=50`)
- [ ] Shadow rendering approach: **Pre-computed shadow sprites**, not real-time gradients
  - For each agent sprite, generate a darkened, stretched silhouette
  - Offset based on tilt: `shadowOffset = tiltAngle * depthFactor * shadowLength`
  - Draw shadow sprite BEFORE the agent sprite (underneath)
- [ ] Shadow parameters per layer:
  ```js
  const SHADOW_CONFIG = {
    agents: { maxLength: 12, opacity: 0.3, blur: false },
    furniture: { maxLength: 6, opacity: 0.15, blur: false },
  };
  ```
- [ ] Shadow color: flat `rgba(0,0,0,0.3)` — no gradients (pixel art aesthetic)
- [ ] Optimization: Only compute shadows for visible/active entities (agents + companion)
- [ ] Skip shadows for background layer entirely (floor/walls don't cast meaningful shadows at this scale)

**Shadow math (revised from original):**
```js
// Simpler than original doc — we don't need true ray casting
const shadowX = -gyro.smoothX * shadow.maxLength * depthFactor;
const shadowY = -gyro.smoothY * shadow.maxLength * depthFactor;
// Draw shadow sprite at (entity.x + shadowX, entity.y + shadowY)
```

**Acceptance:** Tilting phone shifts agent shadows in opposite direction of tilt. Shadows feel natural, don't flicker.

---

### Chunk 4: Polish & Edge Cases
**Effort: Medium | Risk: Low | Prerequisite: Chunk 3**

- [ ] LERP tuning: test on real devices, adjust `lerpFactor` (0.05-0.15 range)
- [ ] Deadzone: ignore tilt < 2° to prevent micro-jitter when phone is on table
- [ ] Calibration: "tap to center" — resets neutral orientation to current position
- [ ] Battery consideration: reduce gyro polling when tab is backgrounded (`visibilitychange`)
- [ ] Fallback modes:
  - Desktop: mouse parallax (already in Chunk 2)
  - No gyro API: static, no parallax (graceful degradation)
  - Reduced motion: respect `prefers-reduced-motion` media query
- [ ] Slight vignette on edges (CSS `box-shadow: inset`) to mask layer edge bleed during tilt
- [ ] Performance monitoring: log frame drops, auto-disable parallax if sustained <30fps

---

## Blockers & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| iOS `requestPermission` requires HTTPS + user gesture | **HIGH** | Must serve over HTTPS for testing. Add permission button to UI. |
| Layer split may expose z-order bugs (sprites crossing layers) | MEDIUM | Careful about what goes on which layer. Agents should never go "behind" furniture in mid layer. |
| Pixel art + sub-pixel CSS transforms = blurry edges | MEDIUM | Round transform values to integers. Keep `image-rendering: pixelated` on canvases. |
| Over-shifting breaks the diorama illusion | LOW | Cap `MAX_SHIFT` at 15px. Less is more. |

## Architecture Decision: Why Not WebGL?

The codebase is pure Canvas 2D with a charming pixel-art style. WebGL would give us shaders and true depth buffers, but:
1. Complete rewrite of all drawing code
2. Pixel art rendering in WebGL requires careful texel alignment
3. The CSS transform approach gets 90% of the visual effect at 10% of the effort
4. If we ever want real 3D (rotating the facility), THEN consider WebGL migration

## Layer Assignment Reference

```
Layer 0 (bg):  Floor tiles, walls, wall trim, room labels, corridor floors
               Parallax: 0 (anchor)

Layer 1 (mid): Desks, monitors, chairs, shelves, couch, fridge, coffee machine,
               ping pong table, plants, bean bags, whiteboard, water cooler,
               name plates, desk items (radio, clipboard, duck, energy drink)
               Parallax: 0.3x

Layer 2 (fg):  Agent sprites, companion sprites, name tags above heads
               Parallax: 0.6x

Layer 3 (ui):  Header bar, status bar, agent cards, system info
               Parallax: 0 (fixed HUD)
```

## Team Assignment Suggestion
- **Chunk 1** → Forge (structural refactor, low creativity needed)
- **Chunk 2** → Cipher (API integration, math, the "wow" moment)
- **Chunk 3** → Cipher or Forge (sprite work + math)
- **Chunk 4** → Either (polish pass, device testing)

## Status
🟡 **PLANNED** — Architecture reviewed, ready for implementation

## References
- Device Orientation API: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
- Gyroscope API: https://developer.mozilla.org/en-US/docs/Web/API/Gyroscope
- iOS 13+ permissions: https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2
- CSS `will-change`: https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
- `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
