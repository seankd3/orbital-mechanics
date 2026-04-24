/**
 * Spacecraft class - handles the spacecraft model, physics, and controls
 */
class Spacecraft {
    constructor() {
        // Create a stable root mesh. Vehicle models are swapped inside it as
        // mission phase changes, so scene/camera references stay valid.
        this.mesh = new THREE.Group();
        this.modelGroup = null;
        this.vehicleMode = 'csm';
        this.currentStageIndex = 0;
        this.configureApolloVehicles();

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
            rotationSpeed: 0.24,
            angularDamping: 0.975,
            sasDamping: 0.82,
            maxAngularRate: 0.18
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
        this.thrusterMesh.visible = false;
        this.mesh.add(this.thrusterMesh);
        this.setVehicleMode('csm');
    }

    configureApolloVehicles() {
        this.csmSpec = {
            mode: 'csm',
            label: 'CSM',
            thrust: 91189,
            dryMass: 10198,
            propellant: 18602,
            maxPropellant: 18602,
            isp: 314,
            rcsPropellant: 374,
            rcsMaxPropellant: 374
        };

        this.csmLmSpec = {
            mode: 'csm-lm',
            label: 'CSM+LM',
            thrust: 91189,
            dryMass: 25120,
            propellant: 18602,
            maxPropellant: 18602,
            isp: 314,
            rcsPropellant: 600,
            rcsMaxPropellant: 600
        };

        this.lmDescentSpec = {
            mode: 'lm-descent',
            label: 'LM DPS',
            thrust: 45040,
            dryMass: 6770,
            propellant: 8200,
            maxPropellant: 8200,
            isp: 311,
            rcsPropellant: 287,
            rcsMaxPropellant: 287
        };

        this.lmAscentSpec = {
            mode: 'lm-ascent',
            label: 'LM APS',
            thrust: 15570,
            dryMass: 2500,
            propellant: 2350,
            maxPropellant: 2350,
            isp: 311,
            rcsPropellant: 140,
            rcsMaxPropellant: 140
        };

        this.payloadMass = 45200; // CSM + LM + SLA, approximate trans-lunar payload.
        this.launchStages = [
            {
                label: 'S-IC',
                thrust: 33850000,
                dryMass: 131000,
                propellant: 2140000,
                maxPropellant: 2140000,
                isp: 263
            },
            {
                label: 'S-II',
                thrust: 5141000,
                dryMass: 40100,
                propellant: 443000,
                maxPropellant: 443000,
                isp: 421
            },
            {
                label: 'S-IVB',
                thrust: 1033000,
                dryMass: 13500,
                propellant: 109000,
                maxPropellant: 109000,
                isp: 421
            }
        ];
    }

    setVehicleMode(mode) {
        const oldQuaternion = this.mesh.quaternion.clone();
        const oldPosition = this.mesh.position.clone();

        if (this.modelGroup) {
            this.mesh.remove(this.modelGroup);
        }

        this.vehicleMode = mode;
        if (mode === 'saturn-v') {
            this.currentStageIndex = Math.min(this.currentStageIndex, this.launchStages.length - 1);
            this.modelGroup = this.createSaturnVMesh();
        } else if (mode === 'csm-lm') {
            this.applyVehicleSpec(this.csmLmSpec);
            this.modelGroup = this.createCSMLMMesh();
        } else if (mode === 'lm-descent') {
            this.applyVehicleSpec(this.lmDescentSpec);
            this.modelGroup = this.createLMMesh(true);
        } else if (mode === 'lm-ascent') {
            this.applyVehicleSpec(this.lmAscentSpec);
            this.modelGroup = this.createLMMesh(false);
        } else {
            this.applyVehicleSpec(this.csmSpec);
            this.modelGroup = this.createSpacecraftMesh();
            this.vehicleMode = 'csm';
        }

        this.mesh.add(this.modelGroup);
        if (this.thrusterMesh) {
            this.mesh.remove(this.thrusterMesh);
            this.mesh.add(this.thrusterMesh);
            this.positionThrusterMesh();
        }
        this.mesh.position.copy(oldPosition);
        this.mesh.quaternion.copy(oldQuaternion);
        this.syncActiveStagePerformance();
    }

    applyVehicleSpec(spec) {
        this.thrust = spec.thrust;
        this.dryMass = spec.dryMass;
        this.spsPropellant = spec.propellant;
        this.spsMaxPropellant = spec.maxPropellant;
        this.spsIsp = spec.isp;
        this.rcsPropellant = spec.rcsPropellant;
        this.rcsMaxPropellant = spec.rcsMaxPropellant;
        this.spsFlowRate = spec.thrust / (spec.isp * 9.81);
    }

    syncActiveStagePerformance() {
        if (this.vehicleMode !== 'saturn-v') return;
        const stage = this.getActiveStage();
        if (!stage) return;

        this.thrust = stage.thrust;
        this.spsPropellant = stage.propellant;
        this.spsMaxPropellant = stage.maxPropellant;
        this.spsIsp = stage.isp;
        this.spsFlowRate = stage.thrust / (stage.isp * 9.81);
        this.dryMass = this.payloadMass + this.getRemainingStageDryMass();
        this.rcsPropellant = 0;
        this.rcsMaxPropellant = 1;
        this.positionThrusterMesh();
    }

    getActiveStage() {
        if (this.vehicleMode !== 'saturn-v') return null;
        return this.launchStages[this.currentStageIndex] || null;
    }

    getVehicleLabel() {
        if (this.vehicleMode === 'saturn-v') {
            const stage = this.getActiveStage();
            return stage ? 'SATURN V ' + stage.label : 'SATURN V';
        }
        if (this.vehicleMode === 'csm-lm') return this.csmLmSpec.label;
        if (this.vehicleMode === 'lm-descent') return this.lmDescentSpec.label;
        if (this.vehicleMode === 'lm-ascent') return this.lmAscentSpec.label;
        return this.csmSpec.label;
    }

    getRemainingStageDryMass() {
        let dry = 0;
        for (let i = this.currentStageIndex; i < this.launchStages.length; i++) {
            dry += this.launchStages[i].dryMass;
        }
        return dry;
    }

    getRemainingStageMass() {
        let mass = 0;
        for (let i = this.currentStageIndex; i < this.launchStages.length; i++) {
            mass += this.launchStages[i].dryMass + this.launchStages[i].propellant;
        }
        return mass;
    }

    separateStage() {
        if (this.vehicleMode !== 'saturn-v') return false;
        if (this.currentStageIndex < this.launchStages.length - 1) {
            this.currentStageIndex++;
            this.setVehicleMode('saturn-v');
            return true;
        }

        this.setVehicleMode('csm-lm');
        return true;
    }

    positionThrusterMesh() {
        if (!this.thrusterMesh) return;
        const z = this.vehicleMode === 'saturn-v' ? -12.8 :
            this.vehicleMode === 'lm-descent' ? -1.55 :
            this.vehicleMode === 'lm-ascent' ? -0.92 :
            -3.25;
        const radius = this.vehicleMode === 'saturn-v' ? 1.45 :
            this.vehicleMode.startsWith('lm') ? 0.34 :
            0.55;

        this.thrusterMesh.position.z = z;
        this.thrusterMesh.scale.set(radius / 0.55, radius / 0.55, this.vehicleMode === 'saturn-v' ? 2.5 : 1);
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

    createSaturnVMesh() {
        const group = new THREE.Group();
        const createMaterials = () => {
            const solidMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
            const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
            return { solidMaterial, wireframeMaterial };
        };
        const createEdgedMesh = (geometry) => {
            const { solidMaterial, wireframeMaterial } = createMaterials();
            const mesh = new THREE.Mesh(geometry, solidMaterial);
            const edges = new THREE.EdgesGeometry(geometry);
            const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
            const part = new THREE.Group();
            part.add(mesh);
            part.add(wireframe);
            return part;
        };
        const addCylinder = (radius, height, z, segments = 24) => {
            const body = createEdgedMesh(new THREE.CylinderGeometry(radius, radius, height, segments));
            body.rotation.x = Math.PI / 2;
            body.position.z = z;
            group.add(body);
            return body;
        };

        // Vehicle points +Z upward/forward. Dimensions are stylized but keep
        // Saturn V's proportions and staging landmarks readable.
        if (this.currentStageIndex <= 0) addCylinder(1.25, 5.2, -7.2);
        if (this.currentStageIndex <= 1) addCylinder(0.98, 4.0, -2.6);
        if (this.currentStageIndex <= 2) addCylinder(0.72, 2.5, 0.65);

        const instrumentUnit = addCylinder(0.74, 0.18, 1.98, 24);
        instrumentUnit.scale.z = 1;

        const lmAdapter = createEdgedMesh(new THREE.ConeGeometry(0.72, 1.1, 16));
        lmAdapter.rotation.x = -Math.PI / 2;
        lmAdapter.position.z = 2.6;
        group.add(lmAdapter);

        const csm = this.createSpacecraftMesh();
        csm.scale.setScalar(0.55);
        csm.position.z = 3.8;
        group.add(csm);

        const escapeTower = createEdgedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8));
        escapeTower.rotation.x = Math.PI / 2;
        escapeTower.position.z = 5.12;
        group.add(escapeTower);

        const towerNozzle = createEdgedMesh(new THREE.ConeGeometry(0.18, 0.36, 8));
        towerNozzle.rotation.x = Math.PI / 2;
        towerNozzle.position.z = 5.86;
        group.add(towerNozzle);

        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            const fin = createEdgedMesh(new THREE.BoxGeometry(0.08, 0.55, 0.7));
            fin.position.x = Math.cos(angle) * 1.3;
            fin.position.y = Math.sin(angle) * 1.3;
            fin.position.z = -10.0;
            fin.rotation.z = angle;
            group.add(fin);
        }

        return group;
    }

    createCSMLMMesh() {
        const group = new THREE.Group();
        const csm = this.createSpacecraftMesh();
        csm.position.z = 1.1;
        group.add(csm);

        const lm = this.createLMMesh(true);
        lm.scale.setScalar(0.86);
        lm.rotation.y = Math.PI;
        lm.position.z = -2.15;
        group.add(lm);

        return group;
    }

    createLMMesh(withDescentStage) {
        const group = new THREE.Group();
        const createMaterials = () => {
            const solidMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
            const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
            return { solidMaterial, wireframeMaterial };
        };
        const createEdgedMesh = (geometry) => {
            const { solidMaterial, wireframeMaterial } = createMaterials();
            const mesh = new THREE.Mesh(geometry, solidMaterial);
            const edges = new THREE.EdgesGeometry(geometry);
            const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
            const part = new THREE.Group();
            part.add(mesh);
            part.add(wireframe);
            return part;
        };

        const cabin = createEdgedMesh(new THREE.BoxGeometry(1.25, 1.05, 0.9));
        cabin.position.z = 0.65;
        cabin.rotation.z = Math.PI / 12;
        group.add(cabin);

        const tunnel = createEdgedMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 10));
        tunnel.rotation.x = Math.PI / 2;
        tunnel.position.z = 1.35;
        group.add(tunnel);

        if (withDescentStage) {
            const descent = createEdgedMesh(new THREE.BoxGeometry(1.65, 1.65, 0.55));
            descent.position.z = -0.25;
            group.add(descent);

            const engine = createEdgedMesh(new THREE.ConeGeometry(0.28, 0.5, 10));
            engine.rotation.x = Math.PI / 2;
            engine.position.z = -0.85;
            group.add(engine);
        }

        const legMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
        const legPositions = [];
        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2 + Math.PI / 4;
            const foot = new THREE.Vector3(Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, -1.25);
            const root = new THREE.Vector3(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, -0.22);
            legPositions.push(root.x, root.y, root.z, foot.x, foot.y, foot.z);
            legPositions.push(foot.x - 0.24, foot.y, foot.z, foot.x + 0.24, foot.y, foot.z);
        }
        const legGeometry = new THREE.BufferGeometry();
        legGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(legPositions), 3));
        group.add(new THREE.LineSegments(legGeometry, legMaterial));

        return group;
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
        if (this.vehicleMode === 'saturn-v') {
            return this.payloadMass + this.getRemainingStageMass();
        }
        return this.dryMass + this.spsPropellant + this.rcsPropellant;
    }

    /**
     * Get remaining SPS delta-v using Tsiolkovsky equation
     */
    getDeltaV() {
        if (this.vehicleMode === 'saturn-v') {
            let mass = this.getCurrentMass();
            let deltaV = 0;
            for (let i = this.currentStageIndex; i < this.launchStages.length; i++) {
                const stage = this.launchStages[i];
                const finalMass = Math.max(1, mass - stage.propellant);
                deltaV += stage.isp * 9.81 * Math.log(mass / finalMass);
                mass = finalMass - stage.dryMass;
            }
            return Math.max(0, deltaV);
        }
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
        if (this.vehicleMode === 'saturn-v') {
            const stage = this.getActiveStage();
            if (!stage || stage.propellant <= 0) {
                this.isThrusting = false;
                return 0;
            }

            const flowRate = stage.thrust / (stage.isp * 9.81);
            const fuelNeeded = flowRate * deltaTime;
            if (fuelNeeded > stage.propellant) {
                const actualTime = stage.propellant / flowRate;
                stage.propellant = 0;
                this.spsPropellant = 0;
                this.isThrusting = false;
                return actualTime;
            }

            stage.propellant -= fuelNeeded;
            this.spsPropellant = stage.propellant;
            return deltaTime;
        }

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
