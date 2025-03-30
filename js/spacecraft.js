/**
 * Spacecraft class - handles the spacecraft model, physics, and controls
 */
class Spacecraft {
    constructor() {
        // Create the mesh
        this.mesh = this.createSpacecraftMesh();
        
        // Initialize physics properties
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.thrust = 500; // N (real-world value)
        this.mass = 20000; // kg
        this.direction = new THREE.Vector3(0, 0, 1); // Forward direction
        
        // Rotation control properties
        this.rotationControl = {
            rotationSpeed: 0.03 // Base rotation speed (radians)
        };
        
        // Control state
        this.isThrusting = false;
        
        // Orbital physics state
        this.useKeplerianModel = true; // Start with Keplerian model
        this.orbitalParameters = null; // Will store orbital parameters
        this.centralBody = null; // Will store reference to central body
        
        // Create and add thruster visual
        this.thrusterMesh = this.createThrusterMesh();
        this.mesh.add(this.thrusterMesh);
        this.thrusterMesh.visible = false;
        
        console.log("Spacecraft created");
    }
    
    /**
     * Create the spacecraft mesh
     */
    createSpacecraftMesh() {
        // Create a group to hold all spacecraft parts
        const spacecraftGroup = new THREE.Group();
        
        // Create materials for the wireframe effect that hides back-facing lines
        // This uses a two-material approach: solid base + wireframe overlay
        const createMaterials = () => {
            // Solid base material (slightly darker)
            const solidMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
            
            // Wireframe overlay (bright lines)
            const wireframeMaterial = new THREE.LineBasicMaterial({ 
                color: 0xffffff,
                linewidth: 1
            });
            
            return { solidMaterial, wireframeMaterial };
        };
        
        // Function to create a mesh with edges visible only in front
        const createEdgedMesh = (geometry) => {
            const { solidMaterial, wireframeMaterial } = createMaterials();
            
            // Create the base mesh
            const mesh = new THREE.Mesh(geometry, solidMaterial);
            
            // Create edge geometry and overlay it
            const edges = new THREE.EdgesGeometry(geometry);
            const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
            
            // Group them together
            const group = new THREE.Group();
            group.add(mesh);
            group.add(wireframe);
            
            return group;
        };
        
        // 1. Command Module (CM) - Cone
        const cmGeometry = new THREE.ConeGeometry(1, 1.5, 8);
        const cm = createEdgedMesh(cmGeometry);
        cm.position.z = 1.75; // Position at front (z-forward)
        cm.rotation.x = Math.PI / 2; // Point forward along Z
        spacecraftGroup.add(cm);
        
        // 2. Service Module (SM) - Cylinder
        const smGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
        const sm = createEdgedMesh(smGeometry);
        sm.position.z = 0; // Position in middle
        sm.rotation.x = Math.PI / 2; // Align with Z as forward
        spacecraftGroup.add(sm);
        
        // 3. Engine - Cone
        const engineGeometry = new THREE.ConeGeometry(0.8, 1.5, 8);
        const engine = createEdgedMesh(engineGeometry);
        engine.rotation.x = Math.PI / 2;
        engine.position.z = -1.5;
        spacecraftGroup.add(engine);
        
        // 5. Add RCS thrusters as small cubes
        const rcsGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        
        // Add 4 RCS thrusters around the service module end
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) + Math.PI/2;
            const rcs = createEdgedMesh(rcsGeometry);
            rcs.position.x = Math.cos(angle) * 1;
            rcs.position.y = Math.sin(angle) * 1;
            rcs.position.z = 0;
            spacecraftGroup.add(rcs);
        }

        // Create direction vector (points along Z axis for forward)
        this.direction = new THREE.Vector3(0, 0, 1);
        
        // Add axis helper to the spacecraft for debugging
        const axesHelper = new THREE.AxesHelper(4); // Size 3 units
        // X is red, Y is green, Z is blue
        axesHelper.position.set(0, 0, 0);
        
        // Add text labels for each axis
        const createLabel = (text, color, position) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            context.fillStyle = color;
            context.font = '24px "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace';
            context.fillText(text, 4, 24);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(1, 0.5, 1);
            return sprite;
        };
        
        // Create labels for each axis
        const xLabel = createLabel('X', '#ff0000', new THREE.Vector3(3.5, 0, 0));
        const yLabel = createLabel('Y', '#00ff00', new THREE.Vector3(0, 3.5, 0));
        const zLabel = createLabel('Z', '#0000ff', new THREE.Vector3(0, 0, 3.5));
        
        // Add the labels and axes helper to the spacecraft
        spacecraftGroup.add(axesHelper);
        spacecraftGroup.add(xLabel);
        spacecraftGroup.add(yLabel);
        spacecraftGroup.add(zLabel);
        
        // No need to rotate the entire group now - we've aligned parts individually
        // with Z as forward and Y as up
        
        return spacecraftGroup;
    }
    
    /**
     * Create thruster visual effects
     */
    createThrusterMesh() {
        // Create a cone that simulates the thruster exhaust
        const thrusterGeometry = new THREE.CylinderGeometry(0.7, 0, 3, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true
        });
        
        const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        thruster.position.z = -3.75; // Place at the back of the ship
        thruster.rotation.x = Math.PI / 2; // Rotate 90 degrees on X axis
        return thruster;
    }
    
    /**
     * Apply rotation around a specific axis
     * @param {string} axis - Which axis to rotate around (pitch, yaw, roll)
     * @param {number} direction - Direction of rotation (-1 or 1)
     */
    rotate(axis, direction) {
        // Use spacecraft's defined rotation speed
        const rotationSpeed = this.rotationControl.rotationSpeed * direction;
        
        // We'll create a new rotation quaternion
        let rotationQuat = new THREE.Quaternion();
        
        // Apply the rotation based on the input axis
        // This uses the THREE.js Object3D local transformation system
        // where rotations are applied relative to the object's local coordinate system
        switch(axis) {
            case 'pitch':
                // For pitch, rotate around the LOCAL X axis (right vector)
                this.mesh.rotateX(rotationSpeed);
                break;
                
            case 'yaw':
                // For yaw, rotate around the LOCAL Y axis (up vector)
                this.mesh.rotateY(rotationSpeed);
                break;
                
            case 'roll':
                // For roll, rotate around the LOCAL Z axis (forward vector)
                this.mesh.rotateZ(rotationSpeed);
                break;
        }
    }
    
    /**
     * Update the spacecraft state
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {boolean} updatePosition - Whether to update position/velocity (can be false for Keplerian propagation)
     */
    update(deltaTime, updatePosition = true) {
        // Update thruster visual
        this.thrusterMesh.visible = this.isThrusting;
        
        // Apply thrust if active
        if (this.isThrusting) {
            this.applyThrust(true);
        }
        
        // Only update position/velocity if requested (may be handled externally by Keplerian propagation)
        if (updatePosition) {
            // Update position based on velocity (s = vt)
            const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
            this.position.add(deltaPosition);
        }
        
        // Update mesh position to match physics position
        this.mesh.position.copy(this.position);
    }
    
    /**
     * Update thruster visuals based on current thrust state
     */
    updateThrusterVisuals() {
        if (this.isThrusting) {
            // Show thruster when thrusting
            this.thrusterMesh.visible = true;
            this.thrusterMesh.scale.z = 0.8 + Math.random() * 0.4; // Animated thrust
        } else {
            // Hide thruster when not thrusting
            this.thrusterMesh.visible = false;
        }
    }
    
    /**
     * Update position using Newtonian physics
     * @param {number} deltaTime Time since last update in seconds
     */
    updateNewtonian(deltaTime) {
        // If thrusting, apply force in the forward direction
        if (this.isThrusting) {
            // Get the forward direction vector
            const thrustVector = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            
            // Calculate acceleration in visualization space
            const scaleManager = window.scaleManager;
            let acceleration;
            
            if (scaleManager) {
                // Real-world thrust and mass create real-world acceleration
                const realAcceleration = thrustVector.clone().multiplyScalar(this.thrust / this.mass);
                
                // Convert to visualization space
                acceleration = scaleManager.vectorToVisualizationSpace(realAcceleration);
            } else {
                // Fallback if scale manager isn't available
                acceleration = thrustVector.multiplyScalar(this.thrust / this.mass);
            }
            
            this.velocity.add(acceleration.multiplyScalar(deltaTime));
        }
        
        // Apply gravitational forces if there's a central body
        if (this.centralBody) {
            this.applyGravity(deltaTime);
        }
        
        // Update position based on velocity
        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.position.add(deltaPosition);
        this.mesh.position.copy(this.position);
    }
    
    /**
     * Apply gravitational forces
     * @param {number} deltaTime Time since last update in seconds
     */
    applyGravity(deltaTime) {
        if (!this.centralBody) return;
        
        // Calculate gravitational force
        const centralBodyPosition = this.centralBody.mesh.position.clone();
        const centralBodyMass = this.centralBody.mass;
        
        // Convert spacecraft position to real-world units if scale manager is available
        const scaleManager = window.scaleManager;
        let force;
        
        if (scaleManager) {
            // Get real-world position
            const realPosition = scaleManager.vectorToRealSpace(this.position.clone());
            const realCentralBodyPosition = scaleManager.vectorToRealSpace(centralBodyPosition.clone());
            
            // Calculate force in real-world units
            force = physics.calculateGravitationalForce(
                this.mass,
                centralBodyMass,
                realPosition,
                realCentralBodyPosition
            );
            
            // Convert force back to visualization space
            force = scaleManager.vectorToVisualizationSpace(force);
        } else {
            // Fallback calculation in visualization space
            force = physics.calculateGravitationalForce(
                this.mass,
                centralBodyMass,
                this.position,
                centralBodyPosition
            );
        }
        
        // Calculate acceleration (F = ma, so a = F/m)
        const acceleration = force.divideScalar(this.mass);
        
        // Apply acceleration to velocity
        this.velocity.add(acceleration.multiplyScalar(deltaTime));
        
        // Check for collision with planet
        this.checkPlanetCollision();
    }
    
    /**
     * Calculate orbital parameters for Keplerian propagation
     */
    calculateOrbitalParameters() {
        if (!this.centralBody) return;
        
        const centralBodyPosition = this.centralBody.mesh.position.clone();
        const centralBodyMass = this.centralBody.mass;
        
        // Convert to real-world units if scale manager is available
        const scaleManager = window.scaleManager;
        let relativePosition, relativeVelocity;
        
        if (scaleManager) {
            // Get real-world position and velocity
            const realPosition = scaleManager.vectorToRealSpace(this.position.clone());
            const realCentralBodyPosition = scaleManager.vectorToRealSpace(centralBodyPosition.clone());
            const realVelocity = scaleManager.vectorToRealSpace(this.velocity.clone());
            
            // Calculate relative position and velocity in real-world units
            relativePosition = realPosition.sub(realCentralBodyPosition);
            relativeVelocity = realVelocity;
        } else {
            // Fallback calculation in visualization space
            relativePosition = this.position.clone().sub(centralBodyPosition);
            relativeVelocity = this.velocity.clone();
        }
        
        // Calculate orbital parameters
        this.orbitalParameters = physics.calculateOrbitalParameters(
            relativePosition,
            relativeVelocity,
            centralBodyMass
        );
        
        // Store the central body position at the time of calculation
        this.centralBodyPositionAtCalc = centralBodyPosition.clone();
    }
    
    /**
     * Update position using Keplerian propagation
     * @param {number} deltaTime Time since last update in seconds
     */
    updateKeplerian(deltaTime) {
        if (!this.centralBody || !this.orbitalParameters) return;
        
        const centralBodyPosition = this.centralBody.mesh.position.clone();
        const centralBodyMass = this.centralBody.mass;
        
        // Propagate orbital position and velocity using Kepler's laws
        const scaleManager = window.scaleManager;
        const newState = physics.propagateKeplerian(this.orbitalParameters, centralBodyMass, deltaTime);
        
        // If propagation failed (non-elliptical orbit), fall back to Newtonian
        if (!newState) {
            this.useKeplerianModel = false;
            this.updateNewtonian(deltaTime);
            return;
        }
        
        // Convert new state to visualization space if needed
        let newPosition, newVelocity;
        
        if (scaleManager) {
            // Convert from real-world to visualization space
            newPosition = scaleManager.vectorToVisualizationSpace(newState.position);
            newVelocity = scaleManager.vectorToVisualizationSpace(newState.velocity);
        } else {
            newPosition = newState.position;
            newVelocity = newState.velocity;
        }
        
        // Add central body position to get absolute position
        newPosition.add(centralBodyPosition);
        
        // Update spacecraft state
        this.position.copy(newPosition);
        this.velocity.copy(newVelocity);
        this.mesh.position.copy(this.position);
        
        // Update orbital parameters for next iteration
        this.orbitalParameters.trueAnomaly = newState.trueAnomaly;
        
        // Check for collision with planet
        this.checkPlanetCollision();
    }
    
    /**
     * Check for collision with the central body
     */
    checkPlanetCollision() {
        if (!this.centralBody) return;
        
        const centralBodyPosition = this.centralBody.mesh.position.clone();
        const centralBodyRadius = this.centralBody.radius;
        
        // Convert to real-world units if scale manager is available
        const scaleManager = window.scaleManager;
        
        if (scaleManager) {
            // Convert positions to real-world space
            const realPosition = scaleManager.vectorToRealSpace(this.position.clone());
            const realCentralBodyPosition = scaleManager.vectorToRealSpace(centralBodyPosition.clone());
            const realVelocity = scaleManager.vectorToRealSpace(this.velocity.clone());
            const realRadius = scaleManager.distanceToRealSpace(centralBodyRadius);
            
            // Check for collision in real-world space
            const collisionResult = physics.checkPlanetCollision(
                realPosition,
                realCentralBodyPosition,
                realRadius,
                realVelocity
            );
            
            // Convert result back to visualization space
            if (collisionResult) {
                collisionResult.position = scaleManager.vectorToVisualizationSpace(collisionResult.position);
                collisionResult.velocity = scaleManager.vectorToVisualizationSpace(collisionResult.velocity);
            }
            
            // If collision occurred, update position and velocity and switch to Newtonian physics
            if (collisionResult) {
                this.position.copy(collisionResult.position);
                this.velocity.copy(collisionResult.velocity);
                this.mesh.position.copy(this.position);
                this.useKeplerianModel = false;
                
                // Recalculate orbital parameters
                this.calculateOrbitalParameters();
            }
        } else {
            // Fallback calculation in visualization space
            const collisionResult = physics.checkPlanetCollision(
                this.position,
                centralBodyPosition,
                centralBodyRadius,
                this.velocity
            );
            
            // If collision occurred, update position and velocity and switch to Newtonian physics
            if (collisionResult) {
                this.position.copy(collisionResult.position);
                this.velocity.copy(collisionResult.velocity);
                this.mesh.position.copy(this.position);
                this.useKeplerianModel = false;
                
                // Recalculate orbital parameters
                this.calculateOrbitalParameters();
            }
        }
    }
    
    /**
     * Apply thrust in the current forward direction
     * @param {boolean} isActive Whether thrust is active
     */
    applyThrust(isActive) {
        this.isThrusting = isActive;
        
        if (isActive) {
            // Get the forward direction vector (local Z axis)
            const forwardVector = new THREE.Vector3(0, 0, 1);
            forwardVector.applyQuaternion(this.mesh.quaternion);
            
            // Calculate thrust acceleration (F = ma, so a = F/m)
            const thrustAcceleration = forwardVector.multiplyScalar(this.thrust / this.mass);
            
            // Apply to velocity
            this.velocity.add(thrustAcceleration.multiplyScalar(1/60)); // Assuming ~60 FPS
            
            // Show thruster effect
            this.thrusterMesh.visible = true;
            this.thrusterMesh.scale.z = 0.8 + Math.random() * 0.4; // Animated thrust
        } else {
            // Hide thruster when not thrusting
            this.thrusterMesh.visible = false;
        }
    }
    
    /**
     * Set the thrust state
     * @param {boolean} thrusting - Whether thrust is being applied
     */
    setThrust(thrusting) {
        this.applyThrust(thrusting);
    }
    
    /**
     * Get the real-world thrust value in Newtons
     * @returns {number} Thrust in Newtons
     */
    getRealThrust() {
        return this.thrust;
    }
    
    /**
     * Set the thrust value in real-world units (Newtons)
     * @param {number} newThrust - Thrust in Newtons
     */
    setRealThrust(newThrust) {
        this.thrust = newThrust;
    }
    
    /**
     * Set spacecraft position and sync with mesh
     * @param {THREE.Vector3} newPosition - New position in visualization space
     */
    setPosition(newPosition) {
        this.position.copy(newPosition);
        this.mesh.position.copy(newPosition);
        
        // Recalculate orbital parameters since position has changed
        if (!this.isThrusting) {
            this.calculateOrbitalParameters();
        }
    }
    
    /**
     * Set spacecraft velocity
     * @param {THREE.Vector3} newVelocity - New velocity in visualization space
     */
    setVelocity(newVelocity) {
        this.velocity.copy(newVelocity);
        
        // Recalculate orbital parameters since velocity has changed
        if (!this.isThrusting) {
            this.calculateOrbitalParameters();
        }
    }
}
