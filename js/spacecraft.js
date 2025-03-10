/**
 * Spacecraft class - handles the spacecraft model, physics, and controls
 */
class Spacecraft {
    constructor() {
        // Basic properties
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        
        // Rotation using Euler angles
        this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
        
        // Direction vector
        this.direction = new THREE.Vector3(0, 0, 1);
        
        // Physics properties
        this.mass = 1000; // kg
        this.thrust = 2000; // N
        this.thrustActive = false;
        
        // Create the 3D model
        this.mesh = this.createSpacecraftMesh();
        
        // Create thruster visual
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
                color: 0x444444,
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
        const cmGeometry = new THREE.ConeGeometry(1, 2, 8);
        const cm = createEdgedMesh(cmGeometry);
        cm.position.z = 2; // Position at front (z-forward)
        cm.rotation.x = Math.PI / 2; // Point forward along Z
        spacecraftGroup.add(cm);
        
        // 2. Service Module (SM) - Cylinder
        const smGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
        const sm = createEdgedMesh(smGeometry);
        sm.position.z = 0; // Position in middle
        sm.rotation.x = Math.PI / 2; // Align with Z as forward
        spacecraftGroup.add(sm);
        
        // 3. Engine - Cone
        const engineGeometry = new THREE.ConeGeometry(0.8, 1, 8);
        const engine = createEdgedMesh(engineGeometry);
        engine.rotation.x = Math.PI / 2;
        engine.position.z = -1.5;
        spacecraftGroup.add(engine);
        
        // 5. Add RCS thrusters as small cubes
        const rcsGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        
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
        const axesHelper = new THREE.AxesHelper(3); // Size 3 units
        // X is red, Y is green, Z is blue
        axesHelper.position.set(0, 0, 0);
        
        // Add text labels for each axis
        const createLabel = (text, color, position) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            context.fillStyle = color;
            context.font = '24px Arial';
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
        const thrusterGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true
        });
        
        const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        thruster.position.z = -2; // Place at the back of the ship
        thruster.rotation.x = Math.PI / 2; // Rotate 90 degrees on X axis
        
        return thruster;
    }
    
    /**
     * Apply thrust in the forward direction
     */
    applyThrust(active) {
        this.thrustActive = active;
        this.thrusterMesh.visible = active;
    }
    
    /**
     * Rotate the spacecraft on a given axis
     * @param {string} axis - 'pitch', 'yaw' or 'roll'
     * @param {number} amount - amount to rotate in radians
     */
    rotate(axis, amount) {
        // Apply rotation to the 3D object
        if (axis === 'pitch') {
            // Pitch: rotate around X axis
            this.mesh.rotateX(amount);
        } else if (axis === 'yaw') {
            // Yaw: rotate around Y axis
            this.mesh.rotateY(amount);
        } else if (axis === 'roll') {
            // Roll: rotate around Z axis
            this.mesh.rotateZ(amount);
        }
        
        // Update direction vector
        this.direction.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    }
    
    /**
     * Rotate the spacecraft around the given axis
     * @param {THREE.Vector3} axis - Axis to rotate around
     * @param {number} angle - Angle to rotate in radians
     */
    rotateOnAxis(axis, angle) {
        // Create a quaternion for this rotation
        const q = new THREE.Quaternion();
        q.setFromAxisAngle(axis.normalize(), angle);
        
        // Apply the rotation to the spacecraft mesh
        this.mesh.quaternion.premultiply(q);
        
        // Update the direction vector to match the new orientation
        this.direction.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    }
    
    /**
     * Update the spacecraft physics
     * @param {number} deltaTime - time step in seconds
     */
    update(deltaTime) {
        // Reset acceleration
        this.acceleration.set(0, 0, 0);
        
        // Apply thrust if active
        if (this.thrustActive) {
            // Calculate thrust direction based on spacecraft orientation
            const thrustVector = this.direction.clone().multiplyScalar(this.thrust / this.mass);
            this.acceleration.add(thrustVector);
            
            // Make the thruster visual pulse
            this.thrusterMesh.material.opacity = 0.7 + Math.random() * 0.3;
        }
        
        // Update velocity using a = F/m
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        
        // Update position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Animate thruster if active
        if (this.thrustActive) {
            this.thrusterMesh.scale.z = 0.8 + Math.random() * 0.4;
        }
    }
    
    /**
     * Get the current velocity magnitude in m/s
     */
    getSpeed() {
        return this.velocity.length();
    }
    
    /**
     * Get the orientation as Euler angles in degrees
     */
    getOrientation() {
        const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion);
        return {
            x: THREE.MathUtils.radToDeg(euler.x).toFixed(1),
            y: THREE.MathUtils.radToDeg(euler.y).toFixed(1),
            z: THREE.MathUtils.radToDeg(euler.z).toFixed(1)
        };
    }
}
