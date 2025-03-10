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
        this.thrust = 200000; // N (real-world value)
        this.mass = 20000; // kg
        this.direction = new THREE.Vector3(0, 0, 1); // Forward direction
        
        // Add rotational physics properties
        this.angularVelocity = new THREE.Vector3(0, 0, 0); // rad/s (x=pitch, y=yaw, z=roll)
        this.rotationControl = {
            maxRotationRate: 2, // Maximum rotation rate in rad/s
            rotationAcceleration: 0.01, // How quickly rotation builds up
            rotationDamping: .999 // No damping in vacuum (1.0 = no slowdown)
        };
        
        // Control state
        this.isThrusting = false;
        
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
     * Apply thrust to the spacecraft
     * @param {boolean} thrusting - Whether thrust is being applied
     */
    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }
    
    /**
     * Set the thrust state
     * @param {boolean} thrusting - Whether thrust is being applied
     */
    setThrust(thrusting) {
        this.isThrusting = thrusting;
    }
    
    /**
     * Apply rotation around a specific axis
     * @param {string} axis - Which axis to rotate around (pitch, yaw, roll)
     * @param {number} direction - Direction of rotation (-1 or 1)
     */
    rotate(axis, direction) {
        const acceleration = this.rotationControl.rotationAcceleration * direction;
        
        switch(axis) {
            case 'pitch':
                this.angularVelocity.x += acceleration;
                break;
            case 'yaw':
                this.angularVelocity.y += acceleration;
                break;
            case 'roll':
                this.angularVelocity.z += acceleration;
                break;
        }
        
        // Clamp angular velocity to maximum rotation rate
        if (this.angularVelocity.x > this.rotationControl.maxRotationRate) {
            this.angularVelocity.x = this.rotationControl.maxRotationRate;
        }
        if (this.angularVelocity.x < -this.rotationControl.maxRotationRate) {
            this.angularVelocity.x = -this.rotationControl.maxRotationRate;
        }
        
        if (this.angularVelocity.y > this.rotationControl.maxRotationRate) {
            this.angularVelocity.y = this.rotationControl.maxRotationRate;
        }
        if (this.angularVelocity.y < -this.rotationControl.maxRotationRate) {
            this.angularVelocity.y = -this.rotationControl.maxRotationRate;
        }
        
        if (this.angularVelocity.z > this.rotationControl.maxRotationRate) {
            this.angularVelocity.z = this.rotationControl.maxRotationRate;
        }
        if (this.angularVelocity.z < -this.rotationControl.maxRotationRate) {
            this.angularVelocity.z = -this.rotationControl.maxRotationRate;
        }
    }
    
    /**
     * Update position based on physics
     * @param {number} deltaTime Time since last update in seconds
     */
    update(deltaTime) {
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
            
            // Update thruster visuals
            this.thrusterMesh.visible = true;
            this.thrusterMesh.scale.z = 0.8 + Math.random() * 0.4; // Animated thrust
        } else {
            // Hide thruster when not thrusting
            this.thrusterMesh.visible = false;
        }
        
        // Update position based on velocity
        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.position.add(deltaPosition);
        this.mesh.position.copy(this.position);
        
        // Apply angular velocity to update rotation
        if (!this.angularVelocity.equals(new THREE.Vector3(0, 0, 0))) {
            // Convert angular velocity to rotation in this frame
            const deltaRotation = this.angularVelocity.clone().multiplyScalar(deltaTime);
            
            // Apply rotation using quaternions for better numerical stability
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(new THREE.Euler(
                deltaRotation.x,
                deltaRotation.y,
                deltaRotation.z,
                'XYZ'
            ));
            
            this.mesh.quaternion.premultiply(quaternion);
            
            // Apply damping to angular velocity
            this.angularVelocity.multiplyScalar(this.rotationControl.rotationDamping);
        }
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
    }
    
    /**
     * Set spacecraft velocity
     * @param {THREE.Vector3} newVelocity - New velocity in visualization space
     */
    setVelocity(newVelocity) {
        this.velocity.copy(newVelocity);
    }
}
