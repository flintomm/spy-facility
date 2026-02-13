# Gyroscopic Depth — Spy Facility Enhancement

## Concept
Parallax 3D effect using device gyroscope. Tilting phone moves "camera" angle, casting dynamic shadows that create depth illusion — like looking into a physical diorama.

## Technical Requirements

### Phase 1: Gyro Input
- Device Orientation API (`deviceorientation` event)
- Gyroscope API for newer iOS
- Permission handling (iOS 13+ requires user gesture)
- Calibration/smoothing for jitter

### Phase 2: Depth Layers
- Z-index layering: background (floor), midground (furniture), foreground (agents)
- Each layer moves at different rate (parallax coefficient)
- Layer transforms based on gyro angles

### Phase 3: Dynamic Shadows
- Light source fixed position (top-left default)
- Shadow angle changes with phone tilt
- Shadow length/intensity based on layer depth
- Soft shadows via canvas gradients

### Phase 4: Polish
- Smooth interpolation (LERP) for movement
- Performance optimization (offscreen canvas)
- Fallback for no-gyro devices (mouse/touch pan)

## Implementation Notes

### Shadow Math
```
shadowX = objectX + (lightX - objectX) * depthFactor * tiltX
shadowY = objectY + (lightY - objectY) * depthFactor * tiltY
```

### Layer Structure
```
Layer 0: Floor, walls (no parallax)
Layer 1: Furniture, desks (0.3x movement)
Layer 2: Agents (0.6x movement)
Layer 3: UI/status bar (0.8x movement)
```

## Team Needed
- **Graphics Architect** (Opus/GPT) — shadow algorithms, depth math
- **WebGL/Canvas Dev** (Kimi) — implementation, performance
- **Mobile Specialist** — iOS gyro quirks, permissions, optimization

## Status
⬜ **BACKLOG** — Future enhancement, requires team expansion

## References
- Device Orientation API: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
- Gyroscope API: https://developer.mozilla.org/en-US/docs/Web/API/Gyroscope
- iOS 13+ permissions: https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2
