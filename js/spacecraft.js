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
        this.thrust = 91189;              // N (Apollo SPS AJ10-137)
        this.mass = 28800;                // kg (full CSM loaded mass)
        this.dryMass = 10198;             // kg (CSM without SPS propellant)
        this.spsPropellant = 18602;       // kg (usable SPS propellant)
        this.spsMaxPropellant = 18602;    // kg (for percentage calc)
        this.rcsPropellant = 374;         // kg (SM RCS, 4 quads)
        this.rcsMaxPropellant = 374;      // kg (for percentage calc)
        this.spsIsp = 314;                // sec (specific impulse, vacuum)
        this.rcsIsp = 290;                // sec (estimated MMH/N2O4)
        this.spsFlowRate = 91189 / (314 * 9.81);  // ~29.6 kg/s
        this.rcsFlowRate = 890 / (290 * 9.81);    // ~0.31 kg/s (2 jets at 445N)
        this.direction = new THREE.Vector3(0, 0, 1); // Forward direction

        // Rotation control properties
        this.rotationControl = {
            rotationSpeed: 0.55,
            angularDamping: 0.985,
            sasDamping: 0.88,
            maxAngularRate: 0.45
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

        // RCS translation state
        this.rcsTranslation = new THREE.Vector3(0, 0, 0);  // current RCS thrust direction
        this.isRCSThrusting = false;

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

        const createRing = (radius, z) => {
            const points = [];
            const segments = 32;
            for (let i = 0; i <= segments; i++) {
                const a = (i / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
            return new THREE.Line(geometry, material);
        };

        // 1. Command Module (CM) - faceted cone
        const cmGeometry = new THREE.ConeGeometry(0.92, 1.35, 12);
        const cm = createEdgedMesh(cmGeometry);
        cm.position.z = 1.72;
        cm.rotation.x = Math.PI / 2;
        spacecraftGroup.add(cm);

        // 2. Service Module (SM) - faceted cylinder with simple panel rings
        const smGeometry = new THREE.CylinderGeometry(0.95, 0.95, 2.25, 12);
        const sm = createEdgedMesh(smGeometry);
        sm.position.z = -0.1;
        sm.rotation.x = Math.PI / 2;
        spacecraftGroup.add(sm);
        spacecraftGroup.add(createRing(0.96, 0.98));
        spacecraftGroup.add(createRing(0.96, -1.18));

        // 3. SPS engine bell
        const engineGeometry = new THREE.ConeGeometry(0.62, 1.1, 12);
        const engine = createEdgedMesh(engineGeometry);
        engine.rotation.x = Math.PI / 2;
        engine.position.z = -1.75;
        spacecraftGroup.add(engine);

        // 4. RCS quads
        const rcsGeometry = new THREE.BoxGeometry(0.22, 0.32, 0.28);
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) + Math.PI / 2;
            const rcs = createEdgedMesh(rcsGeometry);
            rcs.position.x = Math.cos(angle) * 1.02;
            rcs.position.y = Math.sin(angle) * 1.02;
            rcs.position.z = -0.2;
            rcs.rotation.z = angle;
            spacecraftGroup.add(rcs);
        }

        // 5. Docking probe / nose reference
        const probeGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
        const probe = createEdgedMesh(probeGeometry);
        probe.rotation.x = Math.PI / 2;
        probe.position.z = 2.55;
        spacecraftGroup.add(probe);

        // Forward direction (Z axis)
        this.direction = new THREE.Vector3(0, 0, 1);

        return spacecraftGroup;
    }

    /**
     * Create thruster visual effects
     */
    createThrusterMesh() {
        const thrusterGeometry = new THREE.CylinderGeometry(0.55, 0, 2.4, 12);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true
        });

        const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        thruster.position.z = -3.25;
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

        this.limitAngularVelocity();
    }

    limitAngularVelocity() {
        const maxRate = this.rotationControl.maxAngularRate;
        this.angularVelocity.x = THREE.MathUtils.clamp(this.angularVelocity.x, -maxRate, maxRate);
        this.angularVelocity.y = THREE.MathUtils.clamp(this.angularVelocity.y, -maxRate, maxRate);
        this.angularVelocity.z = THREE.MathUtils.clamp(this.angularVelocity.z, -maxRate, maxRate);
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
        this.limitAngularVelocity();

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

    /**
     * Get current total mass (dry + remaining propellant)
     */
    getCurrentMass() {
        return this.dryMass + this.spsPropellant + this.rcsPropellant;
    }

    /**
     * Get remaining SPS delta-v using Tsiolkovsky equation
     */
    getDeltaV() {
        const currentMass = this.getCurrentMass();
        if (currentMass <= this.dryMass) return 0;
        return this.spsIsp * 9.81 * Math.log(currentMass / this.dryMass);
    }

    consumeDeltaV(deltaV) {
        const requested = Math.abs(deltaV);
        if (requested <= 0 || this.spsPropellant <= 0) return 0;

        const currentMass = this.getCurrentMass();
        const effectiveExhaustVelocity = this.spsIsp * 9.81;
        const requiredPropellant = currentMass * (1 - Math.exp(-requested / effectiveExhaustVelocity));
        const usedPropellant = Math.min(requiredPropellant, this.spsPropellant);
        this.spsPropellant -= usedPropellant;

        const finalMass = currentMass - usedPropellant;
        return effectiveExhaustVelocity * Math.log(currentMass / finalMass);
    }

    getAngularRateDeg() {
        const rate = Math.sqrt(
            this.angularVelocity.x * this.angularVelocity.x +
            this.angularVelocity.y * this.angularVelocity.y +
            this.angularVelocity.z * this.angularVelocity.z
        );
        return THREE.MathUtils.radToDeg(rate);
    }

    /**
     * Burn SPS propellant for a given duration. Returns actual burn time.
     * @param {number} deltaTime - requested burn duration in seconds
     * @returns {number} actual burn time (may be less if fuel runs out)
     */
    burnSPS(deltaTime) {
        const fuelNeeded = this.spsFlowRate * deltaTime;
        if (this.spsPropellant <= 0) {
            this.isThrusting = false;
            return 0;
        }
        if (fuelNeeded > this.spsPropellant) {
            const actualTime = this.spsPropellant / this.spsFlowRate;
            this.spsPropellant = 0;
            this.isThrusting = false;
            return actualTime;
        }
        this.spsPropellant -= fuelNeeded;
        return deltaTime;
    }

    /**
     * Burn RCS propellant for a given duration. Returns actual burn time.
     * @param {number} deltaTime - requested burn duration in seconds
     * @returns {number} actual burn time (may be less if fuel runs out)
     */
    burnRCS(deltaTime) {
        const fuelNeeded = this.rcsFlowRate * deltaTime;
        if (this.rcsPropellant <= 0) {
            this.isRCSThrusting = false;
            return 0;
        }
        if (fuelNeeded > this.rcsPropellant) {
            const actualTime = this.rcsPropellant / this.rcsFlowRate;
            this.rcsPropellant = 0;
            this.isRCSThrusting = false;
            return actualTime;
        }
        this.rcsPropellant -= fuelNeeded;
        return deltaTime;
    }

    /**
     * Get SPS fuel percentage remaining
     */
    getSPSFuelPercent() {
        return (this.spsPropellant / this.spsMaxPropellant) * 100;
    }

    /**
     * Get RCS fuel percentage remaining
     */
    getRCSFuelPercent() {
        return (this.rcsPropellant / this.rcsMaxPropellant) * 100;
    }
}
