# Orbital Mechanics Simulator - Changelog

## 2025-03-10

### Added
- Updated spacecraft model to resemble Apollo Command Service Module (CSM)
  - Command Module: Cone shape at front
  - Service Module: Cylindrical body
  - Engine: Cone at rear
  - RCS Thrusters: Small cubes positioned around service module
- Implemented realistic rotational physics with angular momentum conservation
- Added thruster visual effects that activate when thrusting

### Changed
- Modified spacecraft orientation: Z-axis forward, Y-axis up
- Improved wireframe rendering to hide back-facing lines using two-material approach
- Updated world grid to be horizontal in XZ plane
- Set SF Mono font for all axis labels
- Changed control scheme to be more intuitive
- Implemented conservation of angular momentum (rotation continues until countered)
- Engine exhaust now visually represented with dynamic scaling effects

### Technical Changes
- Complete redesign of rotation physics system
  - Angular velocity is now persistent (simulating space environment)
  - Rotation now builds up gradually when controls are pressed
  - Very slight damping factor for numerical stability
- Updated animation loop for better performance
- Control keys now work by applying angular acceleration rather than direct rotation

### Controls
- W: Pitch up (nose up)
- S: Pitch down (nose down)
- A: Yaw right (nose right) 
- D: Yaw left (nose left)
- Q: Roll left
- E: Roll right
- SPACEBAR: Fire main engine
