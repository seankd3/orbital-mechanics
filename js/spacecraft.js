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
        this.thrust = 2000; // N
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
     * Update position based on physics
     * @param {number} deltaTime Time since last update in seconds
     */
    update(deltaTime) {
        // If thrusting, apply force in the forward direction
        if (this.isThrusting) {
            const thrustVector = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            const acceleration = thrustVector.multiplyScalar(this.thrust / this.mass);
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
            
            // Apply rotation to each axis
            if (deltaRotation.x !== 0) {
                this.mesh.rotateX(deltaRotation.x);
            }
            if (deltaRotation.y !== 0) {
                this.mesh.rotateY(deltaRotation.y);
            }
            if (deltaRotation.z !== 0) {
                this.mesh.rotateZ(deltaRotation.z);
            }
            
            // No damping in vacuum - angular velocity maintains unless countered by RCS
            // this line is commented out: this.angularVelocity.multiplyScalar(this.rotationControl.rotationDamping);
            
            // If angular velocity is very small, zero it out to prevent tiny rotations (numerical stability)
            if (this.angularVelocity.length() < 0.0001) {
                this.angularVelocity.set(0, 0, 0);
            }
        }
    }
    
    /**
     * Set thruster state
     * @param {boolean} state 
     */
    setThrust(state) {
        this.isThrusting = state;
    }
    
    /**
     * Rotate the spacecraft in a specific axis
     * @param {string} axis - The axis of rotation: 'pitch', 'yaw', or 'roll'
     * @param {number} direction - Direction of rotation: 1 or -1
     */
    rotate(axis, direction) {
        const acceleration = this.rotationControl.rotationAcceleration * direction;
        
        switch (axis) {
            case 'pitch':
                // Apply angular acceleration, clamping to max rotation rate
                this.angularVelocity.x += acceleration;
                this.angularVelocity.x = Math.max(
                    -this.rotationControl.maxRotationRate,
                    Math.min(this.rotationControl.maxRotationRate, this.angularVelocity.x)
                );
                break;
            case 'yaw':
                this.angularVelocity.y += acceleration;
                this.angularVelocity.y = Math.max(
                    -this.rotationControl.maxRotationRate,
                    Math.min(this.rotationControl.maxRotationRate, this.angularVelocity.y)
                );
                break;
            case 'roll':
                this.angularVelocity.z += acceleration;
                this.angularVelocity.z = Math.max(
                    -this.rotationControl.maxRotationRate,
                    Math.min(this.rotationControl.maxRotationRate, this.angularVelocity.z)
                );
                break;
        }
    }
    
    /**
     * Apply rotation to a specific axis
     * @param {THREE.Vector3} axis - Normalized axis vector
     * @param {number} angle - Angle of rotation in radians
     */
    rotateOnAxis(axis, angle) {
        this.mesh.rotateOnAxis(axis, angle);
    }
}
