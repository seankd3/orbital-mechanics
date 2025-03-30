/**
 * Physics module for orbital mechanics calculations
 * Handles gravitational forces, orbital parameters, and collisions
 */

const physics = {
    // Gravitational constant (m^3 kg^-1 s^-2)
    G: 6.67430e-11,
    
    /**
     * Calculate gravitational force between two objects
     * @param {number} mass1 - Mass of first object (kg)
     * @param {number} mass2 - Mass of second object (kg)
     * @param {THREE.Vector3} position1 - Position of first object (m)
     * @param {THREE.Vector3} position2 - Position of second object (m)
     * @returns {THREE.Vector3} - Force vector (N)
     */
    calculateGravitationalForce(mass1, mass2, position1, position2) {
        // Calculate distance vector
        const distanceVector = position1.clone().sub(position2);
        const distance = distanceVector.length();
        
        // Calculate force magnitude: F = G * m1 * m2 / r^2
        const forceMagnitude = this.G * mass1 * mass2 / (distance * distance);
        
        // Calculate force direction (normalized distance vector)
        const forceDirection = distanceVector.normalize().negate();
        
        // Return force vector
        return forceDirection.multiplyScalar(forceMagnitude);
    },
    
    /**
     * Calculate orbital parameters from position and velocity vectors
     * @param {THREE.Vector3} position - Position vector relative to central body (m)
     * @param {THREE.Vector3} velocity - Velocity vector (m/s)
     * @param {number} centralMass - Mass of central body (kg)
     * @returns {Object} - Orbital parameters
     */
    calculateOrbitalParameters(position, velocity, centralMass) {
        // Standard gravitational parameter
        const mu = this.G * centralMass;
        
        // Calculate position and velocity magnitudes
        const r = position.length();
        const v = velocity.length();
        
        // Calculate specific orbital energy
        const specificEnergy = (v * v / 2) - (mu / r);
        
        // Calculate specific angular momentum vector
        const h = new THREE.Vector3().crossVectors(position, velocity);
        const hMagnitude = h.length();
        
        // Calculate eccentricity vector
        const vCrossH = new THREE.Vector3().crossVectors(velocity, h);
        const eVector = vCrossH.divideScalar(mu).sub(position.clone().normalize());
        const eccentricity = eVector.length();
        
        // Calculate semi-major axis
        let semiMajorAxis;
        if (Math.abs(eccentricity - 1.0) < 0.0001) {
            // Parabolic orbit
            semiMajorAxis = Infinity;
        } else {
            semiMajorAxis = -mu / (2 * specificEnergy);
        }
        
        // Calculate periapsis and apoapsis distances
        const periapsis = semiMajorAxis * (1 - eccentricity);
        let apoapsis;
        if (eccentricity >= 1) {
            // Hyperbolic orbit has no apoapsis
            apoapsis = Infinity;
        } else {
            apoapsis = semiMajorAxis * (1 + eccentricity);
        }
        
        // Calculate orbital period (only for elliptical orbits)
        let orbitalPeriod;
        if (eccentricity < 1) {
            orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
        } else {
            orbitalPeriod = Infinity;
        }
        
        // Return orbital parameters
        return {
            eccentricity,
            semiMajorAxis,
            periapsis,
            apoapsis,
            orbitalPeriod,
            specificEnergy,
            angularMomentum: hMagnitude
        };
    },
    
    /**
     * Handle collision with a planet
     * @param {THREE.Vector3} position - Spacecraft position
     * @param {THREE.Vector3} planetPosition - Planet position
     * @param {number} planetRadius - Planet radius
     * @param {THREE.Vector3} velocity - Spacecraft velocity
     * @returns {Object|null} - Collision result or null if no collision
     */
    handlePlanetCollision(position, planetPosition, planetRadius, velocity) {
        // Calculate distance vector from planet to spacecraft
        const distanceVector = position.clone().sub(planetPosition);
        const distance = distanceVector.length();
        
        // Check if spacecraft is inside planet
        if (distance < planetRadius) {
            console.warn("Collision with planet detected!");
            
            // Calculate normal vector (direction from planet center to collision point)
            const normal = distanceVector.normalize();
            
            // Calculate new position on planet surface
            const newPosition = planetPosition.clone().add(normal.clone().multiplyScalar(planetRadius * 1.01));
            
            // Calculate reflection vector for velocity
            const dot = velocity.dot(normal);
            const reflection = velocity.clone().sub(normal.multiplyScalar(2 * dot));
            
            // Reduce velocity magnitude (energy loss in collision)
            const dampingFactor = 0.5;
            const newVelocity = reflection.multiplyScalar(dampingFactor);
            
            // Return collision result
            return {
                position: newPosition,
                velocity: newVelocity
            };
        }
        
        // No collision
        return null;
    }
};

// Make physics globally available
window.physics = physics;
