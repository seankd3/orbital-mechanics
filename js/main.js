/**
 * Main entry point for the spacecraft simulator
 */

// Global references
let gameScene;
let spacecraft;
let earth;
let scaleManager;

// Constants
const SCALE_FACTOR = 0.001; // Scale everything down by 1000x for visualization
const EARTH_RADIUS = 6371000; // meters (Earth radius, unscaled)
const ORBIT_ALTITUDE = 400000; // meters (400 km altitude, unscaled)
const ORBIT_DISTANCE = EARTH_RADIUS + ORBIT_ALTITUDE; // meters from center of Earth (unscaled)

// Initialize the application
function init() {
    console.log("Initializing spacecraft simulator...");
    
    // Create scale manager
    scaleManager = new ScaleManager(SCALE_FACTOR);
    console.log("Scale manager initialized with scale factor:", SCALE_FACTOR);
    
    // Make scale manager globally accessible
    window.scaleManager = scaleManager;
    
    // Create the scene
    gameScene = new Scene();
    console.log("Scene created");
    
    // Create Earth - physical parameters are in real world units, visuals are scaled
    earth = new Planet({
        name: 'Earth',
        radius: scaleManager.toVisualizationSpace(EARTH_RADIUS),
        mass: 5.972e24 // kg (mass stays the same for orbital calculations)
    });
    console.log(`Earth created with radius: ${earth.radius} (visualization space), mass: ${earth.mass}kg`);
    
    // Add Earth to scene
    gameScene.addPlanet(earth);
    console.log("Earth added to scene");
    
    // Create spacecraft
    spacecraft = new Spacecraft();
    console.log("Spacecraft created");
    
    // Position spacecraft in circular orbit
    initializeSpacecraftOrbit(spacecraft, earth);
    
    // Print debug info for spacecraft
    console.log("DEBUG: Spacecraft position after initialization:", 
        spacecraft.position.x, spacecraft.position.y, spacecraft.position.z);
    console.log("DEBUG: Spacecraft velocity after initialization:", 
        spacecraft.velocity.x, spacecraft.velocity.y, spacecraft.velocity.z);
    console.log("DEBUG: Spacecraft mesh position after initialization:", 
        spacecraft.mesh.position.x, spacecraft.mesh.position.y, spacecraft.mesh.position.z);
    
    // Important debugging: Check if Scene actually has spacecraft reference
    setTimeout(() => {
        console.log("CRITICAL DEBUG: Scene's spacecraft reference:", 
            gameScene.spacecraft ? "EXISTS" : "NULL");
        console.log("CRITICAL DEBUG: Scene's planet reference:", 
            gameScene.planet ? "EXISTS" : "NULL");
        
        if (gameScene.spacecraft) {
            console.log("CRITICAL DEBUG: Scene spacecraft position:", 
                gameScene.spacecraft.position.x, 
                gameScene.spacecraft.position.y, 
                gameScene.spacecraft.position.z);
        }
        
        // Force update display to see if orbital parameters are calculated
        console.log("Forcing updateDisplay() call...");
        gameScene.updateDisplay();
    }, 1000);
    
    // Add spacecraft to scene
    gameScene.addSpacecraft(spacecraft);
    console.log("Spacecraft added to scene");
    
    // Start the animation loop
    gameScene.start();
    console.log("Animation started");
}

/**
 * Initialize spacecraft in a realistic orbit
 * @param {Spacecraft} spacecraft The spacecraft to position
 * @param {Planet} planet The planet to orbit
 */
function initializeSpacecraftOrbit(spacecraft, planet) {
    console.log("===== INITIALIZING SPACECRAFT ORBIT =====");
    // Define initial orbit parameters (International Space Station-like orbit)
    const orbitParams = {
        altitude: 400000, // 400 km altitude (meters)
        eccentricity: 0.0015, // Slight eccentricity for realism
        inclination: 51.6 * Math.PI / 180, // ISS inclination in radians
        argumentOfPeriapsis: 30 * Math.PI / 180, // Arbitrary value for visual interest
        startAnomaly: 0 // Start at periapsis
    };
    
    // Calculate orbital elements
    const perigee = EARTH_RADIUS + orbitParams.altitude; // Distance at closest approach (meters)
    const apogee = perigee * (1 + orbitParams.eccentricity) / (1 - orbitParams.eccentricity); // Distance at farthest point (meters)
    const semiMajorAxis = (perigee + apogee) / 2; // Semi-major axis (meters)
    
    // Calculate orbital velocity at periapsis (maximum velocity)
    const mu = planet.G * planet.mass; // Standard gravitational parameter
    console.log(`DEBUG: Gravitational parameter (GM): ${mu}`);
    const velocityAtPeriapsis = Math.sqrt(mu * ((2 / perigee) - (1 / semiMajorAxis)));
    
    console.log(`Orbit calculation: perigee=${perigee}m, apogee=${apogee}m, semi-major axis=${semiMajorAxis}m`);
    console.log(`Orbit parameters: altitude=${orbitParams.altitude/1000}km, e=${orbitParams.eccentricity.toFixed(4)}, i=${(orbitParams.inclination * 180 / Math.PI).toFixed(1)}°`);
    console.log(`Calculated velocities: periapsis=${velocityAtPeriapsis.toFixed(2)}m/s`);
    
    // Create a coordinate system for the orbit
    // Z-axis is perpendicular to the orbit plane
    const zAxis = new THREE.Vector3(
        Math.sin(orbitParams.inclination), 
        0, 
        Math.cos(orbitParams.inclination)
    ).normalize();
    
    // Y-axis points toward the orbital plane's "up" 
    const yAxis = new THREE.Vector3(0, 1, 0);
    
    // X-axis completes the right-handed system
    const xAxis = new THREE.Vector3();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    
    // Recalculate Y to ensure perfect orthogonality
    yAxis.crossVectors(zAxis, xAxis).normalize();
    
    console.log("DEBUG: Orbit coordinate system:");
    console.log(`  X-axis: ${xAxis.x.toFixed(4)}, ${xAxis.y.toFixed(4)}, ${xAxis.z.toFixed(4)}`);
    console.log(`  Y-axis: ${yAxis.x.toFixed(4)}, ${yAxis.y.toFixed(4)}, ${yAxis.z.toFixed(4)}`);
    console.log(`  Z-axis: ${zAxis.x.toFixed(4)}, ${zAxis.y.toFixed(4)}, ${zAxis.z.toFixed(4)}`);
    
    // Calculate position at specified anomaly
    // Start with position in the orbital frame
    // For periapsis, this is (perigee, 0, 0) in the orbital frame
    const orbitFramePos = new THREE.Vector3(
        perigee * Math.cos(orbitParams.startAnomaly),
        0,
        perigee * Math.sin(orbitParams.startAnomaly)
    );
    
    // Rotate position by argument of periapsis (around z-axis of orbit frame)
    const rotationMatrix = new THREE.Matrix4().makeRotationAxis(zAxis, orbitParams.argumentOfPeriapsis);
    orbitFramePos.applyMatrix4(rotationMatrix);
    
    console.log(`DEBUG: Position in orbital frame: ${orbitFramePos.x.toFixed(0)}, ${orbitFramePos.y.toFixed(0)}, ${orbitFramePos.z.toFixed(0)}`);
    
    // Transform to world coordinates
    const worldPosition = new THREE.Vector3();
    worldPosition.addScaledVector(xAxis, orbitFramePos.x);
    worldPosition.addScaledVector(yAxis, orbitFramePos.y);
    worldPosition.addScaledVector(zAxis, orbitFramePos.z);
    
    console.log(`DEBUG: World position (real space): ${worldPosition.x.toFixed(0)}, ${worldPosition.y.toFixed(0)}, ${worldPosition.z.toFixed(0)}`);
    
    // Similarly for velocity - at periapsis, velocity is perpendicular to position vector
    const velocityDirection = new THREE.Vector3(
        -Math.sin(orbitParams.startAnomaly + orbitParams.argumentOfPeriapsis),
        0,
        Math.cos(orbitParams.startAnomaly + orbitParams.argumentOfPeriapsis)
    ).normalize();
    
    // Rotate velocity by inclination
    velocityDirection.applyMatrix4(rotationMatrix);
    const worldVelocity = new THREE.Vector3();
    worldVelocity.addScaledVector(xAxis, velocityDirection.x);
    worldVelocity.addScaledVector(yAxis, velocityDirection.y);
    worldVelocity.addScaledVector(zAxis, velocityDirection.z);
    worldVelocity.multiplyScalar(velocityAtPeriapsis);
    
    console.log(`DEBUG: Velocity direction: ${velocityDirection.x.toFixed(4)}, ${velocityDirection.y.toFixed(4)}, ${velocityDirection.z.toFixed(4)}`);
    console.log(`DEBUG: World velocity (real space): ${worldVelocity.x.toFixed(2)}, ${worldVelocity.y.toFixed(2)}, ${worldVelocity.z.toFixed(2)}`);
    
    // Ensure velocity is exactly perpendicular to position for circular orbit
    // This is critical for stable orbits
    const positionNorm = worldPosition.clone().normalize();
    const perpendicular = new THREE.Vector3().crossVectors(positionNorm, new THREE.Vector3(0, 1, 0)).normalize();
    if (perpendicular.lengthSq() < 0.1) {
        // If position is too close to up vector, use a different reference
        perpendicular.crossVectors(positionNorm, new THREE.Vector3(1, 0, 0)).normalize();
    }
    
    // Calculate the velocity magnitude needed for a circular orbit
    const circularVelocity = Math.sqrt(mu / worldPosition.length());
    
    // Replace the worldVelocity with a perfectly perpendicular vector
    worldVelocity.copy(perpendicular.multiplyScalar(circularVelocity));
    console.log(`DEBUG: Corrected circular velocity: ${circularVelocity.toFixed(2)} m/s`);
    console.log(`DEBUG: Corrected world velocity: ${worldVelocity.x.toFixed(2)}, ${worldVelocity.y.toFixed(2)}, ${worldVelocity.z.toFixed(2)}`);
    
    // Scale positions and velocities for visualization
    const scaledPosition = scaleManager.vectorToVisualizationSpace(worldPosition);
    const scaledVelocity = scaleManager.vectorToVisualizationSpace(worldVelocity);
    
    console.log(`DEBUG: Scaled position (visualization space): ${scaledPosition.x.toFixed(4)}, ${scaledPosition.y.toFixed(4)}, ${scaledPosition.z.toFixed(4)}`);
    console.log(`DEBUG: Scaled velocity (visualization space): ${scaledVelocity.x.toFixed(4)}, ${scaledVelocity.y.toFixed(4)}, ${scaledVelocity.z.toFixed(4)}`);
    
    // Set spacecraft position and velocity using the new methods
    spacecraft.setPosition(scaledPosition);
    spacecraft.setVelocity(scaledVelocity);
    
    console.log("DEBUG: Spacecraft position and velocity set using setter methods");
    
    // Orient spacecraft to face the direction of travel (prograde)
    const orientQuat = new THREE.Quaternion();
    const progradeMat = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0), // origin
        scaledVelocity.clone().normalize(), // target - direction of velocity
        new THREE.Vector3(0, 1, 0) // up vector
    );
    orientQuat.setFromRotationMatrix(progradeMat);
    spacecraft.mesh.quaternion.copy(orientQuat);
    
    console.log(`Spacecraft positioned at ${(worldPosition.length()/1000).toFixed(1)}km from planet center with velocity ${velocityAtPeriapsis.toFixed(1)}m/s`);
    console.log("===== SPACECRAFT ORBIT INITIALIZATION COMPLETE =====");
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Log any errors
window.addEventListener('error', function(e) {
    console.error("Runtime error:", e.message);
    console.error("At", e.filename, ":", e.lineno);
});
