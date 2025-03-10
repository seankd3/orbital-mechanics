# Orbital Mechanics Simulator - Changelog

## [1.1.0] - 2025-03-10

### Added
- Added orbital parameters display in the UI (perigee, apogee, eccentricity, orbital period, semi-major axis)
- Added detailed orbital mechanics calculations based on real physics
- Added large starfield background sphere for improved space environment visuals
- Implemented logarithmic depth buffer for better distance rendering
- Updated spacecraft model to resemble Apollo Command Service Module (CSM)
  - Command Module: Cone shape at front
  - Service Module: Cylindrical body
  - Engine: Cone at rear
  - RCS Thrusters: Small cubes positioned around service module
- Implemented realistic rotational physics with angular momentum conservation
- Added thruster visual effects that activate when thrusting

### Changed
- Improved planet visualization using IcosahedronGeometry for a more geodesic appearance
- Swapped planet colors (black base with blue wireframe)
- Reduced star point size for more realistic appearance
- Increased camera far clipping plane to 1,000,000 units to prevent horizon cutoff
- Streamlined UI by removing redundant velocity indicators
- Modified spacecraft orientation: Z-axis forward, Y-axis up
- Improved wireframe rendering to hide back-facing lines using two-material approach
- Updated world grid to be horizontal in XZ plane
- Set SF Mono font for all axis labels
- Changed control scheme to be more intuitive
- Implemented conservation of angular momentum (rotation continues until countered)
- Engine exhaust now visually represented with dynamic scaling effects

### Fixed
- Fixed abrupt horizon cutoff issue by improving camera settings and adding proper starfield background
- Fixed planet rendering to appear more Earth-like with improved geometry

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

## [1.0.0] - 2025-03-09

### Added
- Initial implementation of orbital mechanics simulator
- Added Earth-like planet with gravitational physics
- Implemented proper orbital mechanics for spacecraft
- Created orbital information display in UI
- Added spacecraft controls and visuals
