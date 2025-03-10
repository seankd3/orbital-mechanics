/**
 * ScaleManager - Central utility for handling scale conversion between real-world and visualization space
 * This ensures consistent handling of scale throughout the simulation
 */
class ScaleManager {
    constructor(scaleFactor = 0.001) {
        this.scaleFactor = scaleFactor;
        
        // Cache frequently used values for efficiency
        this.invScaleFactor = 1 / scaleFactor;
        
        console.log(`ScaleManager initialized with scale factor: ${scaleFactor}`);
    }
    
    /**
     * Convert a distance from real-world to visualization scale
     * @param {number} realDistance - Distance in real-world units (meters)
     * @returns {number} - Distance in visualization scale
     */
    toVisualizationSpace(realDistance) {
        return realDistance * this.scaleFactor;
    }
    
    /**
     * Convert a distance from visualization to real-world scale
     * @param {number} visualDistance - Distance in visualization scale
     * @returns {number} - Distance in real-world units (meters)
     */
    toRealWorld(visualDistance) {
        return visualDistance * this.invScaleFactor;
    }
    
    /**
     * Convert a 3D vector from real-world to visualization scale
     * @param {THREE.Vector3} realVector - Vector in real-world units
     * @returns {THREE.Vector3} - New vector in visualization scale
     */
    vectorToVisualizationSpace(realVector) {
        return realVector.clone().multiplyScalar(this.scaleFactor);
    }
    
    /**
     * Convert a 3D vector from visualization to real-world scale
     * @param {THREE.Vector3} visualVector - Vector in visualization scale
     * @returns {THREE.Vector3} - New vector in real-world units
     */
    vectorToRealWorld(visualVector) {
        return visualVector.clone().multiplyScalar(this.invScaleFactor);
    }
    
    /**
     * Convert a velocity from real-world to visualization scale
     * @param {number} realVelocity - Velocity in real-world units (m/s)
     * @returns {number} - Velocity in visualization scale
     */
    velocityToVisualizationSpace(realVelocity) {
        return realVelocity * this.scaleFactor;
    }
    
    /**
     * Convert a velocity from visualization to real-world scale
     * @param {number} visualVelocity - Velocity in visualization scale
     * @returns {number} - Velocity in real-world units (m/s)
     */
    velocityToRealWorld(visualVelocity) {
        return visualVelocity * this.invScaleFactor;
    }
    
    /**
     * Convert an acceleration from real-world to visualization scale
     * @param {number} realAcceleration - Acceleration in real-world units (m/s²)
     * @returns {number} - Acceleration in visualization scale
     */
    accelerationToVisualizationSpace(realAcceleration) {
        return realAcceleration * this.scaleFactor;
    }
    
    /**
     * Convert an acceleration from visualization to real-world scale
     * @param {number} visualAcceleration - Acceleration in visualization scale
     * @returns {number} - Acceleration in real-world units (m/s²)
     */
    accelerationToRealWorld(visualAcceleration) {
        return visualAcceleration * this.invScaleFactor;
    }
    
    /**
     * Convert a force from real-world to visualization scale
     * Force scales as mass * acceleration, but since we keep mass constant, 
     * force scales linearly with acceleration
     * @param {number} realForce - Force in real-world units (N)
     * @returns {number} - Force in visualization scale
     */
    forceToVisualizationSpace(realForce) {
        return realForce * this.scaleFactor;
    }
    
    /**
     * Convert a force from visualization to real-world scale
     * @param {number} visualForce - Force in visualization scale
     * @returns {number} - Force in real-world units (N)
     */
    forceToRealWorld(visualForce) {
        return visualForce * this.invScaleFactor;
    }
    
    /**
     * Get formatted description with units for display
     * @param {number} value - Raw value in real-world units
     * @param {string} unit - Unit string (m, m/s, etc.)
     * @param {number} decimals - Number of decimal places
     * @returns {string} - Formatted description with proper units
     */
    formatWithUnits(value, unit, decimals = 2) {
        // Handle different units and scale appropriately
        let displayValue = value;
        let displayUnit = unit;
        
        // Distance formatting
        if (unit === 'm') {
            if (Math.abs(value) >= 1e6) {
                displayValue = value / 1e6;
                displayUnit = 'Mm';
            } else if (Math.abs(value) >= 1e3) {
                displayValue = value / 1e3;
                displayUnit = 'km';
            }
        }
        // Velocity formatting
        else if (unit === 'm/s') {
            if (Math.abs(value) >= 1e3) {
                displayValue = value / 1e3;
                displayUnit = 'km/s';
            }
        }
        
        return `${displayValue.toFixed(decimals)} ${displayUnit}`;
    }
}
