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
            rotationSpeed: 1.8, // Angular acceleration (rad/s^2, calibrated for 60fps-equivalent feel)
            angularDamping: 0.9995, // Normal angular velocity damping factor (per-frame at 60fps)
            sasDamping: 0.95 // Strong damping when SAS is active (per-frame at 60fps)
        };

        // Angular velocity (radians/second) around local axes
        this.angularVelocity = {
            x: 0, // Pitch
            y: 0, // Yaw
            z: 0  // Roll
        };

        // SAS (Stability Augmentation System) state
        this.sasActive = false;

        // Control state
        this.isThrusting = false;

        // Create and add thruster visual
        this.thrusterMesh = this.createThrusterMesh();
        this.mesh.add(this.thrusterMesh);
        this.thrusterMesh.visible = false;
    }

    /**
     * Create the spacecraft mesh
     */
    createSpacecraftMesh() {
        // Create a group to hold all spacecraft parts
        const spacecraftGroup = new THREE.Group();

        // Create materials for the wireframe effect that hides back-facing lines
        const createMaterials = () => {
            const solidMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });

            const wireframeMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                linewidth: 1
            });

            return { solidMaterial, wireframeMaterial };
        };

        const createEdgedMesh = (geometry) => {
            const { solidMaterial, wireframeMaterial } = createMaterials();
            const mesh = new THREE.Mesh(geometry, solidMaterial);
            const edges = new THREE.EdgesGeometry(geometry);
            const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
            const group = new THREE.Group();
            group.add(mesh);
            group.add(wireframe);
            return group;
        };

        // 1. Command Module (CM) - Cone
        const cmGeometry = new THREE.ConeGeometry(1, 1.5, 8);
        const cm = createEdgedMesh(cmGeometry);
        cm.position.z = 1.75;
        cm.rotation.x = Math.PI / 2;
        spacecraftGroup.add(cm);

        // 2. Service Module (SM) - Cylinder
        const smGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
        const sm = createEdgedMesh(smGeometry);
        sm.position.z = 0;
        sm.rotation.x = Math.PI / 2;
        spacecraftGroup.add(sm);

        // 3. Engine - Cone
        const engineGeometry = new THREE.ConeGeometry(0.8, 1.5, 8);
        const engine = createEdgedMesh(engineGeometry);
        engine.rotation.x = Math.PI / 2;
        engine.position.z = -1.5;
        spacecraftGroup.add(engine);

        // 4. RCS thrusters as small cubes
        const rcsGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) + Math.PI / 2;
            const rcs = createEdgedMesh(rcsGeometry);
            rcs.position.x = Math.cos(angle) * 1;
            rcs.position.y = Math.sin(angle) * 1;
            rcs.position.z = 0;
            spacecraftGroup.add(rcs);
        }

        // Forward direction (Z axis)
        this.direction = new THREE.Vector3(0, 0, 1);

        // Axis helper for debugging
        const axesHelper = new THREE.AxesHelper(4);
        axesHelper.position.set(0, 0, 0);

        // Axis labels
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

        const xLabel = createLabel('X', '#ff0000', new THREE.Vector3(3.5, 0, 0));
        const yLabel = createLabel('Y', '#00ff00', new THREE.Vector3(0, 3.5, 0));
        const zLabel = createLabel('Z', '#0000ff', new THREE.Vector3(0, 0, 3.5));

        spacecraftGroup.add(axesHelper);
        spacecraftGroup.add(xLabel);
        spacecraftGroup.add(yLabel);
        spacecraftGroup.add(zLabel);

        return spacecraftGroup;
    }

    /**
     * Create thruster visual effects
     */
    createThrusterMesh() {
        const thrusterGeometry = new THREE.CylinderGeometry(0.7, 0, 3, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true
        });

        const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        thruster.position.z = -3.75;
        thruster.rotation.x = Math.PI / 2;
        return thruster;
    }

    /**
     * Apply rotation around a specific axis (frame-rate independent)
     * @param {string} axis - Which axis to rotate around (pitch, yaw, roll)
     * @param {number} direction - Direction of rotation (-1 or 1)
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    rotate(axis, direction, deltaTime) {
        // Angular acceleration scaled by deltaTime for frame-rate independence
        const angularAcceleration = this.rotationControl.rotationSpeed * direction * deltaTime;

        switch (axis) {
            case 'pitch':
                this.angularVelocity.x += angularAcceleration;
                break;
            case 'yaw':
                this.angularVelocity.y += angularAcceleration;
                break;
            case 'roll':
                this.angularVelocity.z += angularAcceleration;
                break;
        }
    }

    /**
     * Update the spacecraft state
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {boolean} updatePosition - Whether to update position/velocity (false for Keplerian propagation)
     */
    update(deltaTime, updatePosition = true) {
        // Update thruster visuals
        this.thrusterMesh.visible = this.isThrusting;
        if (this.isThrusting) {
            this.thrusterMesh.scale.z = 0.8 + Math.random() * 0.4;
        }

        // Apply angular velocity to rotation
        this.mesh.rotateX(this.angularVelocity.x * deltaTime);
        this.mesh.rotateY(this.angularVelocity.y * deltaTime);
        this.mesh.rotateZ(this.angularVelocity.z * deltaTime);

        // Frame-rate independent angular damping: normalize to 60fps reference
        const dampingFactor = this.sasActive ?
            this.rotationControl.sasDamping :
            this.rotationControl.angularDamping;
        const frameDamping = Math.pow(dampingFactor, deltaTime * 60);

        this.angularVelocity.x *= frameDamping;
        this.angularVelocity.y *= frameDamping;
        this.angularVelocity.z *= frameDamping;

        // Only update position/velocity if requested (may be handled externally by Keplerian propagation)
        if (updatePosition) {
            const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
            this.position.add(deltaPosition);
        }

        // Sync mesh position to physics position
        this.mesh.position.copy(this.position);
    }

    /**
     * Set thrust state (velocity changes are handled by Scene.updatePhysics)
     * @param {boolean} isActive Whether thrust is active
     */
    applyThrust(isActive) {
        this.isThrusting = isActive;
    }

    /**
     * Set the thrust state
     * @param {boolean} thrusting - Whether thrust is being applied
     */
    setThrust(thrusting) {
        this.isThrusting = thrusting;
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

    /**
     * Toggle the Stability Augmentation System (SAS)
     * @returns {boolean} The new SAS state
     */
    toggleSAS() {
        this.sasActive = !this.sasActive;
        return this.sasActive;
    }

    /**
     * Get the current SAS state
     * @returns {boolean} Whether SAS is active
     */
    getSASState() {
        return this.sasActive;
    }
}
