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
    // Create scale manager
    scaleManager = new ScaleManager(SCALE_FACTOR);
    window.scaleManager = scaleManager;

    // Create the scene
    gameScene = new Scene();

    // Create Earth
    earth = new Planet({
        name: 'Earth',
        radius: scaleManager.toVisualizationSpace(EARTH_RADIUS),
        mass: 5.972e24
    });

    gameScene.addPlanet(earth);

    // Create spacecraft and position in orbit
    spacecraft = new Spacecraft();
    initializeSpacecraftOrbit(spacecraft, earth);

    gameScene.addSpacecraft(spacecraft);

    if (window.ApolloMission) {
        gameScene.mission = new ApolloMission(gameScene, spacecraft, earth, scaleManager);
    } else {
        initializeSpacecraftOrbit(spacecraft, earth);
    }

    gameScene.start();
}

/**
 * Initialize spacecraft in a realistic orbit
 * @param {Spacecraft} spacecraft The spacecraft to position
 * @param {Planet} planet The planet to orbit
 */
function initializeSpacecraftOrbit(spacecraft, planet) {
    // ISS-like orbit parameters
    const orbitParams = {
        altitude: 400000, // 400 km altitude (meters)
        eccentricity: 0.0015,
        inclination: 51.6 * Math.PI / 180,
        argumentOfPeriapsis: 30 * Math.PI / 180,
        startAnomaly: 0
    };

    // Calculate orbital elements
    const perigee = EARTH_RADIUS + orbitParams.altitude;
    const apogee = perigee * (1 + orbitParams.eccentricity) / (1 - orbitParams.eccentricity);
    const semiMajorAxis = (perigee + apogee) / 2;

    // Standard gravitational parameter
    const mu = physics.G * planet.mass;
    const velocityAtPeriapsis = Math.sqrt(mu * ((2 / perigee) - (1 / semiMajorAxis)));

    // Create orbit coordinate system
    const zAxis = new THREE.Vector3(
        Math.sin(orbitParams.inclination),
        0,
        Math.cos(orbitParams.inclination)
    ).normalize();

    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();

    // Calculate position at specified anomaly
    const orbitFramePos = new THREE.Vector3(
        perigee * Math.cos(orbitParams.startAnomaly),
        0,
        perigee * Math.sin(orbitParams.startAnomaly)
    );

    // Rotate position by argument of periapsis
    const rotationMatrix = new THREE.Matrix4().makeRotationAxis(zAxis, orbitParams.argumentOfPeriapsis);
    orbitFramePos.applyMatrix4(rotationMatrix);

    // Transform to world coordinates
    const worldPosition = new THREE.Vector3();
    worldPosition.addScaledVector(xAxis, orbitFramePos.x);
    worldPosition.addScaledVector(yAxis, orbitFramePos.y);
    worldPosition.addScaledVector(zAxis, orbitFramePos.z);

    // Ensure velocity is exactly perpendicular to position for a stable circular orbit
    const positionNorm = worldPosition.clone().normalize();
    const perpendicular = new THREE.Vector3().crossVectors(positionNorm, new THREE.Vector3(0, 1, 0)).normalize();
    if (perpendicular.lengthSq() < 0.1) {
        perpendicular.crossVectors(positionNorm, new THREE.Vector3(1, 0, 0)).normalize();
    }

    const circularVelocity = Math.sqrt(mu / worldPosition.length());
    const worldVelocity = perpendicular.multiplyScalar(circularVelocity);

    // Scale positions and velocities for visualization
    const scaledPosition = scaleManager.vectorToVisualizationSpace(worldPosition);
    const scaledVelocity = scaleManager.vectorToVisualizationSpace(worldVelocity);

    // Set spacecraft position and velocity
    spacecraft.setPosition(scaledPosition);
    spacecraft.setVelocity(scaledVelocity);

    // Orient spacecraft to face the direction of travel (prograde)
    const orientQuat = new THREE.Quaternion();
    const progradeMat = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        scaledVelocity.clone().normalize(),
        new THREE.Vector3(0, 1, 0)
    );
    orientQuat.setFromRotationMatrix(progradeMat);
    spacecraft.mesh.quaternion.copy(orientQuat);
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Log runtime errors
window.addEventListener('error', function(e) {
    console.error("Runtime error:", e.message, "at", e.filename, ":", e.lineno);
});
