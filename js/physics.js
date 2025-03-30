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
        
        // Calculate the orbital plane normal (perpendicular to angular momentum)
        const orbitalPlaneNormal = h.clone().normalize();
        
        // Calculate the longitude of ascending node
        const nodeVector = new THREE.Vector3(0, 0, 1).cross(orbitalPlaneNormal);
        let longitudeOfAscendingNode = 0;
        if (nodeVector.length() > 0.000001) {
            longitudeOfAscendingNode = Math.atan2(nodeVector.y, nodeVector.x);
            if (longitudeOfAscendingNode < 0) {
                longitudeOfAscendingNode += 2 * Math.PI;
            }
        }
        
        // Calculate inclination
        const inclination = Math.acos(orbitalPlaneNormal.z);
        
        // Calculate argument of periapsis
        let argumentOfPeriapsis = 0;
        if (eccentricity > 0.000001) {
            if (nodeVector.length() > 0.000001) {
                const nodeVectorNorm = nodeVector.clone().normalize();
                const eVectorNorm = eVector.clone().normalize();
                argumentOfPeriapsis = Math.acos(nodeVectorNorm.dot(eVectorNorm));
                if (eVector.z < 0) {
                    argumentOfPeriapsis = 2 * Math.PI - argumentOfPeriapsis;
                }
            } else {
                // For equatorial orbits, periapsis is measured from x-axis
                argumentOfPeriapsis = Math.atan2(eVector.y, eVector.x);
                if (argumentOfPeriapsis < 0) {
                    argumentOfPeriapsis += 2 * Math.PI;
                }
            }
        }
        
        // Calculate true anomaly
        let trueAnomaly = 0;
        if (eccentricity > 0.000001) {
            const eVectorNorm = eVector.clone().normalize();
            const positionNorm = position.clone().normalize();
            trueAnomaly = Math.acos(eVectorNorm.dot(positionNorm));
            
            // Check if we're in the "negative" half of the orbit
            if (position.dot(velocity) < 0) {
                trueAnomaly = 2 * Math.PI - trueAnomaly;
            }
        } else {
            // For circular orbits, measure from x-axis
            if (nodeVector.length() > 0.000001) {
                const nodeVectorNorm = nodeVector.clone().normalize();
                trueAnomaly = Math.acos(nodeVectorNorm.dot(position.clone().normalize()));
                if (position.z < 0) {
                    trueAnomaly = 2 * Math.PI - trueAnomaly;
                }
            } else {
                // For circular equatorial orbits, measure from x-axis
                trueAnomaly = Math.atan2(position.y, position.x);
                if (trueAnomaly < 0) {
                    trueAnomaly += 2 * Math.PI;
                }
            }
        }
        
        // Return orbital parameters
        return {
            eccentricity,
            semiMajorAxis,
            periapsis,
            apoapsis,
            orbitalPeriod,
            specificEnergy,
            angularMomentum: hMagnitude,
            inclination,
            longitudeOfAscendingNode,
            argumentOfPeriapsis,
            trueAnomaly,
            h, // Angular momentum vector
            eVector, // Eccentricity vector
            orbitalPlaneNormal // Normal vector to orbital plane
        };
    },
    
    /**
     * Propagate orbital position using Kepler's laws
     * @param {Object} orbitalParameters - Orbital parameters from calculateOrbitalParameters
     * @param {number} centralMass - Mass of central body (kg)
     * @param {number} deltaTime - Time step for propagation (seconds)
     * @returns {Object} - New position and velocity vectors
     */
    propagateKeplerian(orbitalParameters, centralMass, deltaTime) {
        const mu = this.G * centralMass;
        const {
            eccentricity,
            semiMajorAxis,
            inclination,
            longitudeOfAscendingNode,
            argumentOfPeriapsis,
            trueAnomaly,
            h
        } = orbitalParameters;
        
        // Handle different types of orbits
        if (isNaN(semiMajorAxis) || semiMajorAxis <= 0 || eccentricity >= 1) {
            console.warn("Non-elliptical orbit detected in Keplerian propagator");
            // For hyperbolic/parabolic orbits, fall back to Newtonian for now
            return null;
        }
        
        // Mean motion (radians per second)
        const meanMotion = Math.sqrt(mu / Math.pow(semiMajorAxis, 3));
        
        // Calculate mean anomaly at current time
        let meanAnomaly = this.trueToMeanAnomaly(trueAnomaly, eccentricity);
        
        // Advance mean anomaly by time step
        meanAnomaly += meanMotion * deltaTime;
        
        // Solve Kepler's equation to get new eccentric anomaly
        const newEccentricAnomaly = this.solveKepler(meanAnomaly, eccentricity);
        
        // Convert eccentric anomaly to true anomaly
        const newTrueAnomaly = this.eccentricToTrueAnomaly(newEccentricAnomaly, eccentricity);
        
        // Calculate new distance from focus (semi-latus rectum / (1 + e*cos(ν)))
        const p = semiMajorAxis * (1 - eccentricity * eccentricity); // Semi-latus rectum
        const radius = p / (1 + eccentricity * Math.cos(newTrueAnomaly));
        
        // Convert orbital elements to cartesian state vectors
        // First, calculate position in orbital plane (perifocal coordinates)
        const xPeri = radius * Math.cos(newTrueAnomaly);
        const yPeri = radius * Math.sin(newTrueAnomaly);
        
        // Transform from orbital plane to reference frame
        // This involves three rotations: arg of periapsis, inclination, longitude of ascending node
        // Using the rotation matrices to transform the position
        
        // First calculate the new position
        const cosLOAN = Math.cos(longitudeOfAscendingNode);
        const sinLOAN = Math.sin(longitudeOfAscendingNode);
        const cosAOP = Math.cos(argumentOfPeriapsis);
        const sinAOP = Math.sin(argumentOfPeriapsis);
        const cosI = Math.cos(inclination);
        const sinI = Math.sin(inclination);
        
        // Perifocal to reference frame transformation
        const x = (cosLOAN * cosAOP - sinLOAN * sinAOP * cosI) * xPeri + 
                (-cosLOAN * sinAOP - sinLOAN * cosAOP * cosI) * yPeri;
        const y = (sinLOAN * cosAOP + cosLOAN * sinAOP * cosI) * xPeri + 
                (-sinLOAN * sinAOP + cosLOAN * cosAOP * cosI) * yPeri;
        const z = (sinAOP * sinI) * xPeri + (cosAOP * sinI) * yPeri;
        
        const position = new THREE.Vector3(x, y, z);
        
        // Calculate velocity
        // First, calculate velocity in perifocal coordinates
        const hScalar = h.length();
        const vxPeri = -hScalar / p * Math.sin(newTrueAnomaly);
        const vyPeri = hScalar / p * (eccentricity + Math.cos(newTrueAnomaly));
        
        // Transform velocity to reference frame using the same transformation
        const vx = (cosLOAN * cosAOP - sinLOAN * sinAOP * cosI) * vxPeri + 
                  (-cosLOAN * sinAOP - sinLOAN * cosAOP * cosI) * vyPeri;
        const vy = (sinLOAN * cosAOP + cosLOAN * sinAOP * cosI) * vxPeri + 
                  (-sinLOAN * sinAOP + cosLOAN * cosAOP * cosI) * vyPeri;
        const vz = (sinAOP * sinI) * vxPeri + (cosAOP * sinI) * vyPeri;
        
        const velocity = new THREE.Vector3(vx, vy, vz);
        
        return { position, velocity };
    },
    
    /**
     * Convert true anomaly to mean anomaly
     * @param {number} trueAnomaly - True anomaly (radians)
     * @param {number} eccentricity - Orbit eccentricity
     * @returns {number} - Mean anomaly (radians)
     */
    trueToMeanAnomaly(trueAnomaly, eccentricity) {
        // First, convert true anomaly to eccentric anomaly
        const cosTA = Math.cos(trueAnomaly);
        const sinTA = Math.sin(trueAnomaly);
        const cosE = (eccentricity + cosTA) / (1 + eccentricity * cosTA);
        const sinE = Math.sqrt(1 - eccentricity * eccentricity) * sinTA / (1 + eccentricity * cosTA);
        
        // Calculate eccentric anomaly
        let E = Math.atan2(sinE, cosE);
        
        // Ensure E is in the range [0, 2π)
        if (E < 0) {
            E += 2 * Math.PI;
        }
        
        // Convert eccentric anomaly to mean anomaly
        let M = E - eccentricity * Math.sin(E);
        
        // Ensure M is in the range [0, 2π)
        M = M % (2 * Math.PI);
        if (M < 0) {
            M += 2 * Math.PI;
        }
        
        return M;
    },
    
    /**
     * Convert eccentric anomaly to true anomaly
     * @param {number} eccentricAnomaly - Eccentric anomaly (radians)
     * @param {number} eccentricity - Orbit eccentricity
     * @returns {number} - True anomaly (radians)
     */
    eccentricToTrueAnomaly(eccentricAnomaly, eccentricity) {
        const cosE = Math.cos(eccentricAnomaly);
        const sinE = Math.sin(eccentricAnomaly);
        
        // Calculate true anomaly
        const cosTA = (cosE - eccentricity) / (1 - eccentricity * cosE);
        const sinTA = Math.sqrt(1 - eccentricity * eccentricity) * sinE / (1 - eccentricity * cosE);
        
        let trueAnomaly = Math.atan2(sinTA, cosTA);
        
        // Ensure TA is in the range [0, 2π)
        if (trueAnomaly < 0) {
            trueAnomaly += 2 * Math.PI;
        }
        
        return trueAnomaly;
    },
    
    /**
     * Solve Kepler's equation using Newton-Raphson method
     * @param {number} M - Mean anomaly (radians)
     * @param {number} e - Eccentricity
     * @returns {number} - Eccentric anomaly (radians)
     */
    solveKepler(M, e) {
        // Normalize mean anomaly to [0, 2π)
        M = M % (2 * Math.PI);
        if (M < 0) {
            M += 2 * Math.PI;
        }
        
        // Initial guess (for low eccentricity orbits, E ≈ M is a good approximation)
        let E = M;
        
        // For higher eccentricity, we need a better initial guess
        if (e > 0.8) {
            E = Math.PI;
        }
        
        // Newton-Raphson iteration
        const TOLERANCE = 1e-10;
        const MAX_ITERATIONS = 30;
        let i = 0;
        let delta = 1.0;
        
        while (Math.abs(delta) > TOLERANCE && i < MAX_ITERATIONS) {
            // f(E) = E - e*sin(E) - M
            const f = E - e * Math.sin(E) - M;
            // f'(E) = 1 - e*cos(E)
            const fPrime = 1.0 - e * Math.cos(E);
            
            // Newton's method: E_n+1 = E_n - f(E_n)/f'(E_n)
            delta = f / fPrime;
            E -= delta;
            
            i++;
        }
        
        if (i >= MAX_ITERATIONS) {
            console.warn("Kepler solver did not converge after maximum iterations");
        }
        
        // Ensure E is in the range [0, 2π)
        E = E % (2 * Math.PI);
        if (E < 0) {
            E += 2 * Math.PI;
        }
        
        return E;
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
