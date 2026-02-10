/**
 * Planet class - handles planet creation and gravitational physics
 */
class Planet {
    constructor(params = {}) {
        // Default to Earth parameters if not specified
        this.radius = params.radius || 6371000; // meters (Earth: 6371 km)
        this.mass = params.mass || 5.972e24; // kg (Earth: 5.972 x 10^24 kg)
        this.name = params.name || 'Earth';
        this.rotationPeriod = params.rotationPeriod || 86400; // seconds (Earth: 24 hours)
        this.obliquity = params.obliquity || 23.44 * Math.PI / 180; // radians (Earth: 23.44 degrees)

        // Create the mesh
        this.createPlanetMesh();
    }

    /**
     * Create the planet mesh with blue opaque material and black wireframe
     */
    createPlanetMesh() {
        this.mesh = new THREE.Group();

        const geometry = new THREE.IcosahedronGeometry(this.radius, 32);

        const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });

        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0x1f7cda,
            linewidth: 1
        });

        this.planetMesh = new THREE.Mesh(geometry, solidMaterial);

        const edges = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edges, wireframeMaterial);

        this.mesh.add(this.planetMesh);
        this.mesh.add(wireframe);
    }

    /**
     * Calculate gravitational force on an object
     * @param {THREE.Vector3} objectPosition - Position of the object in real-world units
     * @param {number} objectMass - Mass of the object
     * @returns {THREE.Vector3} - Force vector in Newtons (real-world units)
     */
    calculateGravitationalForce(objectPosition, objectMass) {
        const distanceVector = objectPosition.clone().sub(this.mesh.position);
        const distance = distanceVector.length();

        const forceMagnitude = physics.G * (this.mass * objectMass) / (distance * distance);
        const forceVector = distanceVector.normalize().multiplyScalar(-forceMagnitude);

        return forceVector;
    }

    /**
     * Calculate escape velocity at given distance (real-world units)
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Escape velocity in m/s
     */
    calculateEscapeVelocity(distance) {
        return Math.sqrt((2 * physics.G * this.mass) / distance);
    }

    /**
     * Calculate orbital velocity for a circular orbit at given distance (real-world units)
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Orbital velocity in m/s
     */
    calculateOrbitalVelocity(distance) {
        return Math.sqrt((physics.G * this.mass) / distance);
    }

    /**
     * Update the planet (rotation, etc.)
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        const rotationAngle = (2 * Math.PI / this.rotationPeriod) * deltaTime;
        this.mesh.rotation.y += rotationAngle;
    }
}
