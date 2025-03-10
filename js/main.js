/**
 * Main entry point for the spacecraft simulator
 */

// Global references
let gameScene;
let spacecraft;
let earth;

// Constants
const SCALE_FACTOR = 0.001; // Scale everything down by 1000x for visualization
const EARTH_RADIUS = 6371000 * SCALE_FACTOR; // meters (Earth radius, scaled)
const ORBIT_ALTITUDE = 400000 * SCALE_FACTOR; // meters (400 km altitude, scaled)
const ORBIT_DISTANCE = EARTH_RADIUS + ORBIT_ALTITUDE; // meters from center of Earth

// Expose SCALE_FACTOR globally
window.SCALE_FACTOR = SCALE_FACTOR;

// Initialize the application
function init() {
    console.log("Initializing spacecraft simulator...");
    
    // Create the scene
    gameScene = new Scene();
    console.log("Scene created");
    
    // Create Earth
    earth = new Planet({
        name: 'Earth',
        radius: EARTH_RADIUS,
        mass: 5.972e24 // kg (mass stays the same for orbital calculations)
    });
    console.log("Earth created");
    
    // Add Earth to scene
    gameScene.addPlanet(earth);
    console.log("Earth added to scene");
    
    // Create spacecraft
    spacecraft = new Spacecraft();
    console.log("Spacecraft created");
    
    // Position spacecraft in circular orbit
    positionSpacecraftInOrbit(spacecraft, earth, ORBIT_ALTITUDE);
    
    // Add spacecraft to scene
    gameScene.addSpacecraft(spacecraft);
    console.log("Spacecraft added to scene");
    
    // Start the animation loop
    gameScene.start();
    console.log("Animation started");
}

/**
 * Position spacecraft in a circular orbit around the planet
 * @param {Spacecraft} spacecraft The spacecraft to position
 * @param {Planet} planet The planet to orbit
 * @param {number} altitude Altitude above planet surface in meters
 */
function positionSpacecraftInOrbit(spacecraft, planet, altitude) {
    // Calculate distance from center of planet
    const distance = planet.radius + altitude;
    
    // Position spacecraft on the +X axis at the specified altitude
    spacecraft.position.set(distance, 0, 0);
    
    // Calculate orbital velocity for circular orbit - using the real (unscaled) distance for physics
    const realDistance = distance / SCALE_FACTOR;
    const orbitalSpeed = planet.calculateOrbitalVelocity(realDistance) * SCALE_FACTOR;
    
    // Apply velocity in the +Z direction (perpendicular to radius vector)
    // This creates a counter-clockwise orbit as viewed from above (+Y)
    spacecraft.velocity.set(0, 0, orbitalSpeed);
    
    console.log(`Positioned spacecraft in orbit at ${(altitude/SCALE_FACTOR)/1000}km altitude with orbital velocity ${(orbitalSpeed/SCALE_FACTOR).toFixed(2)}m/s`);
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Log any errors
window.addEventListener('error', function(e) {
    console.error("Runtime error:", e.message);
    console.error("At", e.filename, ":", e.lineno);
});
