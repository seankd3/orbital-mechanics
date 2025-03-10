/**
 * Planet class - handles planet creation and gravitational physics
 */
class Planet {
    constructor(params = {}) {
        // Default to Earth parameters if not specified
        this.radius = params.radius || 6371000; // meters (Earth: 6371 km)
        this.mass = params.mass || 5.972e24; // kg (Earth: 5.972 × 10^24 kg)
        this.name = params.name || 'Earth';
        this.rotationPeriod = params.rotationPeriod || 86400; // seconds (Earth: 24 hours)
        this.obliquity = params.obliquity || 23.44 * Math.PI / 180; // radians (Earth: 23.44 degrees)
        
        // Gravitational constant (N⋅m²/kg²)
        this.G = 6.67430e-11;
        
        // Create the mesh
        this.createPlanetMesh();
        
        console.log(`${this.name} created with radius ${this.radius}m and mass ${this.mass}kg`);
    }
    
    /**
     * Create the planet mesh with blue opaque material and black wireframe
     */
    createPlanetMesh() {
        // Planet group to hold planet and any visual elements
        this.mesh = new THREE.Group();
        
        // Create geodesic planet sphere (icosahedron) for more realistic planet look
        const geometry = new THREE.IcosahedronGeometry(this.radius, 32); // 4 subdivisions
        
        // Create materials for the wireframe effect that hides back-facing lines
        // This uses a two-material approach: solid base + wireframe overlay
        
        // Solid base material (blue)
        const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        
        // Wireframe overlay (black lines)
        const wireframeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x1f7cda,
            linewidth: 1
        });
        
        // Create the base mesh
        this.planetMesh = new THREE.Mesh(geometry, solidMaterial);
        
        // Create edge geometry and overlay it
        const edges = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
        
        // Add the base and wireframe to the planet group
        this.mesh.add(this.planetMesh);
        this.mesh.add(wireframe);
    }
    
    /**
     * Calculate gravitational force on an object
     * @param {THREE.Vector3} objectPosition - Position of the object
     * @param {number} objectMass - Mass of the object
     * @returns {THREE.Vector3} - Force vector in Newtons
     */
    calculateGravitationalForce(objectPosition, objectMass) {
        // Calculate distance vector from planet center to object
        const distanceVector = objectPosition.clone().sub(this.mesh.position);
        const distance = distanceVector.length();
        
        // Calculate force magnitude using Newton's law of gravitation
        // F = G * (m1 * m2) / r^2
        const forceMagnitude = this.G * (this.mass * objectMass) / (distance * distance);
        
        // Calculate normalized direction vector and scale by force magnitude
        const forceVector = distanceVector.normalize().multiplyScalar(-forceMagnitude);
        
        return forceVector;
    }
    
    /**
     * Calculate escape velocity at given distance
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Escape velocity in m/s
     */
    calculateEscapeVelocity(distance) {
        // v_escape = sqrt(2 * G * M / r)
        return Math.sqrt((2 * this.G * this.mass) / distance);
    }
    
    /**
     * Calculate orbital velocity for a circular orbit at given distance
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Orbital velocity in m/s
     */
    calculateOrbitalVelocity(distance) {
        // v_orbit = sqrt(G * M / r)
        return Math.sqrt((this.G * this.mass) / distance);
    }
    
    /**
     * Update the planet (rotation, etc.)
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Rotate planet based on its rotation period
        const rotationAngle = (2 * Math.PI / this.rotationPeriod) * deltaTime;
        this.mesh.rotation.y += rotationAngle;
    }
}
