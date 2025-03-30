# Orbital Mechanics Simulator - Changelog

## [1.5.0] - 2025-03-30

### Changed
- Simplified spacecraft rotation system using Three.js built-in Object3D.rotate methods
- Implemented local space rotations for more intuitive controls:
  - Pitch: rotateX() - rotation around local X axis
  - Yaw: rotateY() - rotation around local Y axis
  - Roll: rotateZ() - rotation around local Z axis
- Removed complex quaternion math implementation

### Fixed
- Resolved gimbal lock issues in spacecraft rotation
- Addressed erratic rotation behavior

## [1.4.0] - 2025-03-10

### Added
- Added visual orbital trajectory representation that shows the spacecraft's orbit path
- Implemented automatic orbital path updates when spacecraft's orbit changes
- Created glowing cyan path for optimal visibility in space environment

### Technical Changes
- Added orbital plane orientation calculation for accurate 3D trajectory display
- Implemented efficient update mechanism to maintain performance
- Utilized THREE.js BufferGeometry and Line for rendering the orbital path

## [1.3.0] - 2025-03-10

### Added
- Added collision detection to prevent spacecraft from flying through the planet
- Added frame-by-frame debugging information for spacecraft position and velocity

### Changed
- Improved orbital velocity calculation to ensure stable circular orbits
- Updated perigee and apogee displays to show altitude above surface instead of distance from center
- Increased spacecraft thrust from 20,000N to 200,000N for better maneuverability

### Fixed
- Fixed missing ScaleManager reference in HTML which caused initialization errors
- Fixed orbital mechanics calculations to ensure proper perpendicular velocity vectors
- Fixed issue where spacecraft would fall toward the planet despite correct orbital parameters

## [1.2.0] - 2025-03-10

### Added
- Implemented centralized controls system that separates input handling from scene management
- Created dedicated Controls class in new controls.js file

### Changed
- Refactored keyboard event handling to improve code organization
- Moved control logic out of Scene class for better separation of concerns
- Improved modularity of the code structure

### Technical Changes
- Enhanced maintainability through better code organization
- Improved extensibility for future control schemes

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
