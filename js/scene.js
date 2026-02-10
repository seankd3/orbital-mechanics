/**
 * Scene class - handles the 3D scene setup, camera, and rendering
 */
class Scene {
    constructor() {
        // Create the scene
        this.scene = new THREE.Scene();

        // Setup the camera
        this.setupCamera();

        // Setup the renderer
        this.setupRenderer();

        // Setup lighting
        this.setupLights();

        // Setup grid and helpers
        this.setupHelpers();

        // Add background stars
        this.addStars();

        // Create a reference to the spacecraft
        this.spacecraft = null;

        // Create a reference to the planet
        this.planet = null;

        // Create a reference to the orbital trajectory
        this.orbitalTrajectory = null;

        // Setup camera controls
        this.setupControls();

        // Setup key listeners
        this.setupEventListeners();

        // Animation controls
        this.clock = new THREE.Clock();
        this.isRunning = true;

        // Time warp settings
        this.timeWarp = {
            factor: 1,
            available: [1, 2, 5, 10, 50, 100, 1000],
            currentIndex: 0,
            active: false
        };

        // Control state
        this.keys = {
            space: false, // Forward thrust
            w: false,     // Pitch down
            a: false,     // Yaw left
            d: false,     // Yaw right
            q: false,     // Roll left
            e: false,     // Roll right
            s: false,     // Pitch up
            period: false, // Increase time warp
            comma: false,  // Decrease time warp
            t: false      // Toggle SAS
        };

        // Chase camera settings
        this.cameraSettings = {
            distance: 15,
            height: 5,
            smoothing: 0.1,
            zoomSpeed: 1.0,
            minDistance: 5,
            maxDistance: 30,
            horizontalOrbit: 0,
            verticalOrbit: 0,
            orbitSpeed: 0.01
        };

        // Mouse state for camera control
        this.mouseState = {
            isDragging: false,
            lastX: 0,
            lastY: 0
        };

        // Cached orbital parameters (computed once per frame)
        this._cachedOrbitalParams = null;

        // Setup post-processing
        this.setupPostProcessing();

        // Setup resize handler
        this.setupResizeHandler();
    }

    /**
     * Setup the camera
     */
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000000 // Far enough for distant stars, reasonable with logarithmic depth
        );

        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Setup the renderer
     */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        document.body.appendChild(this.renderer.domElement);
    }

    /**
     * Handle window resize to keep viewport correct
     */
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    /**
     * Setup basic lighting
     */
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(10, 10, 10);
        this.scene.add(sunLight);
    }

    /**
     * Setup grid and axes helpers
     */
    setupHelpers() {
        const gridHelper = new THREE.GridHelper(10, 10);
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
    }

    /**
     * Add background stars
     */
    addStars() {
        this.createStarLayer(20000, 0.015, 5000000, 0xffffff);
        this.createStarLayer(5000, 0.025, 2000000, 0xf8f8ff);
        this.createStarLayer(1000, 0.04, 1000000, 0xffffff);
        this.createStarLayer(100, 0.05, 500000, 0xf0f0ff);
    }

    /**
     * Creates a layer of stars
     */
    createStarLayer(count, size, radius, color) {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: color,
            size: size,
            sizeAttenuation: true
        });

        const starsVertices = [];
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * Math.random()));
            const theta = 2 * Math.PI * Math.random();
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            starsVertices.push(x, y, z);
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }

    /**
     * Setup controls for camera
     */
    setupControls() {
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) {
                this.mouseState.isDragging = true;
                this.mouseState.lastX = event.clientX;
                this.mouseState.lastY = event.clientY;
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (this.mouseState.isDragging) {
                const deltaX = event.clientX - this.mouseState.lastX;
                const deltaY = event.clientY - this.mouseState.lastY;

                this.cameraSettings.horizontalOrbit -= deltaX * this.cameraSettings.orbitSpeed;
                this.cameraSettings.verticalOrbit += deltaY * this.cameraSettings.orbitSpeed;

                this.cameraSettings.verticalOrbit = Math.max(
                    -Math.PI / 2 + 0.1,
                    Math.min(Math.PI / 2 - 0.1, this.cameraSettings.verticalOrbit)
                );

                this.mouseState.lastX = event.clientX;
                this.mouseState.lastY = event.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            this.mouseState.isDragging = false;
        });

        document.addEventListener('mouseleave', () => {
            this.mouseState.isDragging = false;
        });

        document.addEventListener('wheel', (event) => {
            this.cameraSettings.distance += event.deltaY * 0.01 * this.cameraSettings.zoomSpeed;
            this.cameraSettings.distance = Math.max(
                this.cameraSettings.minDistance,
                Math.min(this.cameraSettings.maxDistance, this.cameraSettings.distance)
            );
            event.preventDefault();
        }, { passive: false });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'r') {
                this.cameraSettings.horizontalOrbit = 0;
                this.cameraSettings.verticalOrbit = 0;
            }
        });
    }

    /**
     * Setup keyboard event listeners
     */
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }

    /**
     * Handle key down events
     */
    handleKeyDown(event) {
        switch (event.key) {
            case ' ':
                this.keys.space = true;
                break;
            case 'w':
                this.keys.w = true;
                break;
            case 'a':
                this.keys.a = true;
                break;
            case 's':
                this.keys.s = true;
                break;
            case 'd':
                this.keys.d = true;
                break;
            case 'q':
                this.keys.q = true;
                break;
            case 'e':
                this.keys.e = true;
                break;
            case '.':
                this.increaseTimeWarp();
                break;
            case ',':
                this.decreaseTimeWarp();
                break;
            case 't':
                if (this.spacecraft) {
                    this.spacecraft.toggleSAS();
                }
                break;
        }
    }

    /**
     * Handle key up events
     */
    handleKeyUp(event) {
        switch (event.key) {
            case ' ':
                this.keys.space = false;
                break;
            case 'w':
                this.keys.w = false;
                break;
            case 'a':
                this.keys.a = false;
                break;
            case 's':
                this.keys.s = false;
                break;
            case 'd':
                this.keys.d = false;
                break;
            case 'q':
                this.keys.q = false;
                break;
            case 'e':
                this.keys.e = false;
                break;
        }
    }

    /**
     * Add the spacecraft to the scene
     * @param {Spacecraft} spacecraft The spacecraft object
     */
    addSpacecraft(spacecraft) {
        this.spacecraft = spacecraft;
        this.scene.add(spacecraft.mesh);
        this.createOrbitalTrajectory();
    }

    /**
     * Add a planet to the scene
     * @param {Planet} planet The planet object
     */
    addPlanet(planet) {
        this.planet = planet;
        this.scene.add(planet.mesh);
    }

    /**
     * Execute the animation loop
     */
    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(this.animate.bind(this));

        const deltaTime = this.clock.getDelta();

        // Process inputs
        this.processInput(deltaTime);

        // Update physics
        this.updatePhysics(deltaTime);

        // Update the camera
        this.updateCamera(deltaTime);

        // Calculate orbital params once per frame for display and trajectory
        this._cachedOrbitalParams = this.calculateOrbitalParameters();

        // Update display values
        this.updateDisplay();

        // Update the orbital trajectory
        this.updateOrbitalTrajectory();

        // Render the scene
        this.composer.render();
    }

    /**
     * Update physics simulation
     * @param {number} deltaTime Time delta since last frame (seconds)
     */
    updatePhysics(deltaTime) {
        const warpedDeltaTime = deltaTime * this.timeWarp.factor;

        // Update planet rotation if exists
        if (this.planet) {
            this.planet.update(warpedDeltaTime);
        }

        // Skip if spacecraft doesn't exist
        if (!this.spacecraft) return;

        // Apply gravitational forces from planet if exists
        if (this.planet) {
            const scaleManager = window.scaleManager;
            if (!scaleManager) return;

            // Check for collision with planet
            const collision = physics.handlePlanetCollision(
                this.spacecraft.position,
                this.planet.mesh.position,
                this.planet.radius,
                this.spacecraft.velocity
            );

            if (collision) {
                this.spacecraft.setPosition(collision.position);
                this.spacecraft.setVelocity(collision.velocity);
                // Still update rotation/visuals even during collision
                this.spacecraft.update(warpedDeltaTime, false);
                return;
            }

            // When in time warp and not thrusting, use Keplerian propagation (on rails)
            if (this.timeWarp.factor > 1 && !this.spacecraft.isThrusting) {
                const orbitalParameters = this.calculateOrbitalParameters();

                if (orbitalParameters && orbitalParameters.eccentricity < 1.0) {
                    const propagated = physics.propagateKeplerian(
                        orbitalParameters,
                        this.planet.mass,
                        warpedDeltaTime
                    );

                    if (propagated) {
                        const newPosition = scaleManager.vectorToVisualizationSpace(propagated.position);
                        const newVelocity = scaleManager.vectorToVisualizationSpace(propagated.velocity);
                        newPosition.add(this.planet.mesh.position);

                        this.spacecraft.setPosition(newPosition);
                        this.spacecraft.setVelocity(newVelocity);
                        this.spacecraft.update(warpedDeltaTime, false);
                        return;
                    }
                }
            }

            // Numerical integration with substeps when thrusting during time warp
            if (this.spacecraft.isThrusting && this.timeWarp.factor > 1) {
                const numSteps = Math.min(10, Math.ceil(this.timeWarp.factor));
                const stepDeltaTime = warpedDeltaTime / numSteps;

                for (let i = 0; i < numSteps; i++) {
                    // Apply thrust in every substep (properly scaled with time warp)
                    if (this.spacecraft.isThrusting) {
                        const forwardVector = new THREE.Vector3(0, 0, 1);
                        forwardVector.applyQuaternion(this.spacecraft.mesh.quaternion);
                        const visualThrust = scaleManager.forceToVisualizationSpace(this.spacecraft.thrust);
                        const thrustAcceleration = forwardVector.multiplyScalar(visualThrust / this.spacecraft.mass);
                        this.spacecraft.velocity.add(thrustAcceleration.clone().multiplyScalar(stepDeltaTime));
                    }

                    // Calculate gravitational force for this substep
                    const realForce = physics.calculateGravitationalForce(
                        this.spacecraft.mass,
                        this.planet.mass,
                        scaleManager.vectorToRealWorld(this.spacecraft.position),
                        scaleManager.vectorToRealWorld(this.planet.mesh.position)
                    );

                    const visualForce = scaleManager.vectorToVisualizationSpace(realForce);
                    const acceleration = visualForce.divideScalar(this.spacecraft.mass);
                    this.spacecraft.velocity.add(acceleration.multiplyScalar(stepDeltaTime));

                    // Update position for this substep
                    const deltaPosition = this.spacecraft.velocity.clone().multiplyScalar(stepDeltaTime);
                    this.spacecraft.position.add(deltaPosition);
                }

                this.spacecraft.mesh.position.copy(this.spacecraft.position);
                this.spacecraft.update(warpedDeltaTime, false);
                return;
            }

            // Standard physics path: apply thrust + gravity with single-step integration
            if (this.spacecraft.isThrusting) {
                const forwardVector = new THREE.Vector3(0, 0, 1);
                forwardVector.applyQuaternion(this.spacecraft.mesh.quaternion);
                const visualThrust = scaleManager.forceToVisualizationSpace(this.spacecraft.thrust);
                const thrustAcceleration = forwardVector.multiplyScalar(visualThrust / this.spacecraft.mass);
                this.spacecraft.velocity.add(thrustAcceleration.multiplyScalar(warpedDeltaTime));
            }

            // Calculate gravitational force in real-world units
            const realForce = physics.calculateGravitationalForce(
                this.spacecraft.mass,
                this.planet.mass,
                scaleManager.vectorToRealWorld(this.spacecraft.position),
                scaleManager.vectorToRealWorld(this.planet.mesh.position)
            );

            const visualForce = scaleManager.vectorToVisualizationSpace(realForce);
            const acceleration = visualForce.divideScalar(this.spacecraft.mass);
            this.spacecraft.velocity.add(acceleration.multiplyScalar(warpedDeltaTime));
        }

        // Update spacecraft physics
        this.spacecraft.update(warpedDeltaTime, true);
    }

    /**
     * Process keyboard input
     */
    processInput(deltaTime) {
        if (!this.spacecraft) return;

        // Forward thrust with spacebar
        if (this.keys.space) {
            this.spacecraft.setThrust(true);
        } else {
            this.spacecraft.setThrust(false);
        }

        // Rotation controls (deltaTime passed for frame-rate independence)
        if (this.keys.w) this.spacecraft.rotate('pitch', 1, deltaTime);
        if (this.keys.s) this.spacecraft.rotate('pitch', -1, deltaTime);
        if (this.keys.a) this.spacecraft.rotate('yaw', 1, deltaTime);
        if (this.keys.d) this.spacecraft.rotate('yaw', -1, deltaTime);
        if (this.keys.q) this.spacecraft.rotate('roll', -1, deltaTime);
        if (this.keys.e) this.spacecraft.rotate('roll', 1, deltaTime);
    }

    /**
     * Update the camera
     * @param {number} deltaTime Time delta since last frame (seconds)
     */
    updateCamera(deltaTime) {
        if (!this.spacecraft) return;

        const spacecraftPos = this.spacecraft.position.clone();

        // Start with the base offset behind the spacecraft
        const baseOffset = new THREE.Vector3(0, this.cameraSettings.height, -this.cameraSettings.distance);

        // Apply orbit rotations to the offset
        baseOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraSettings.verticalOrbit);
        baseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraSettings.horizontalOrbit);

        // Apply the spacecraft's rotation to the orbited offset
        const worldOffset = baseOffset.clone().applyQuaternion(this.spacecraft.mesh.quaternion);

        // Calculate final camera position
        const cameraPosition = spacecraftPos.clone().add(worldOffset);

        // Set camera position directly
        this.camera.position.copy(cameraPosition);

        // Apply the spacecraft's rotation to the camera's up vector for proper roll
        const localUpVector = new THREE.Vector3(0, 1, 0);
        const worldUpVector = localUpVector.clone().applyQuaternion(this.spacecraft.mesh.quaternion);
        this.camera.up.copy(worldUpVector);

        // Look at the spacecraft
        this.camera.lookAt(spacecraftPos);
    }

    /**
     * Calculate orbital parameters for the spacecraft's current orbit
     * @returns {Object} Object containing orbital parameters
     */
    calculateOrbitalParameters() {
        if (!this.planet || !this.spacecraft) return null;

        const scaleManager = window.scaleManager;
        if (!scaleManager) return null;

        const scaledPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
        const realPosition = scaleManager.vectorToRealWorld(scaledPosition);
        const realVelocity = scaleManager.vectorToRealWorld(this.spacecraft.velocity);

        return physics.calculateOrbitalParameters(realPosition, realVelocity, this.planet.mass);
    }

    /**
     * Update the display with current physics data
     */
    updateDisplay() {
        if (!this.spacecraft) return;

        const scaleManager = window.scaleManager;
        if (!scaleManager) return;

        // Update velocity display
        const velocity = document.getElementById('velocity');
        if (velocity) {
            const realVelocity = scaleManager.velocityToRealWorld(this.spacecraft.velocity.length());
            velocity.textContent = realVelocity.toFixed(2);
        }

        // Update orientation display
        const orientation = document.getElementById('orientation');
        if (orientation) {
            const euler = new THREE.Euler().setFromQuaternion(this.spacecraft.mesh.quaternion);
            const pitch = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
            const yaw = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
            const roll = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
            orientation.textContent = `P: ${pitch}\u00B0 Y: ${yaw}\u00B0 R: ${roll}\u00B0`;
        }

        // Update thrust status
        const thrustStatus = document.getElementById('thrust-status');
        if (thrustStatus) {
            thrustStatus.textContent = this.spacecraft.isThrusting ? 'ON' : 'OFF';
        }

        // Update altitude display
        const altitude = document.getElementById('altitude');
        if (altitude && this.planet) {
            const distanceVector = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            const distance = distanceVector.length();
            const realDistance = scaleManager.toRealWorld(distance);
            const realAltitude = realDistance - scaleManager.toRealWorld(this.planet.radius);
            const altitudeKm = realAltitude / 1000;
            altitude.textContent = altitudeKm.toFixed(2);
        }

        // Update orbital parameters display (using cached params from animate())
        const orbit = this._cachedOrbitalParams;
        if (orbit) {
            const planetRadiusKm = scaleManager.toRealWorld(this.planet.radius) / 1000;

            const apogee = document.getElementById('apogee');
            if (apogee) {
                const apogeeAltitudeKm = orbit.apoapsis / 1000 - planetRadiusKm;
                apogee.textContent = apogeeAltitudeKm.toFixed(2);
            }

            const perigee = document.getElementById('perigee');
            if (perigee) {
                const perigeeAltitudeKm = orbit.periapsis / 1000 - planetRadiusKm;
                perigee.textContent = perigeeAltitudeKm.toFixed(2);
            }

            const eccentricity = document.getElementById('eccentricity');
            if (eccentricity) {
                eccentricity.textContent = orbit.eccentricity.toFixed(6);
            }

            const orbitalPeriod = document.getElementById('orbital-period');
            if (orbitalPeriod) {
                const periodMinutes = orbit.orbitalPeriod / 60;
                orbitalPeriod.textContent = periodMinutes.toFixed(2);
            }

            const semiMajorAxis = document.getElementById('semi-major-axis');
            if (semiMajorAxis) {
                const semiMajorAxisKm = orbit.semiMajorAxis / 1000;
                semiMajorAxis.textContent = semiMajorAxisKm.toFixed(2);
            }
        }

        // Update time warp display
        const timeWarpDisplay = document.getElementById('time-warp');
        if (timeWarpDisplay) {
            timeWarpDisplay.textContent = this.timeWarp.factor + 'x';

            const timeWarpIndicator = document.getElementById('time-warp-indicator');
            if (timeWarpIndicator) {
                timeWarpIndicator.style.display = this.timeWarp.factor > 1 ? 'block' : 'none';
            }
        }

        // Update SAS status display
        if (this.spacecraft) {
            const sasStatus = document.getElementById('sas-status');
            if (sasStatus) {
                sasStatus.textContent = this.spacecraft.getSASState() ? 'ON' : 'OFF';
            }
        }
    }

    /**
     * Start the animation loop
     */
    start() {
        this.isRunning = true;
        this.clock.start();
        this.animate();
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this.isRunning = false;
        this.clock.stop();
    }

    /**
     * Creates the orbital trajectory visualization
     */
    createOrbitalTrajectory() {
        // Remove and dispose any existing trajectory
        if (this.orbitalTrajectory) {
            this.scene.remove(this.orbitalTrajectory);
            if (this.orbitalTrajectory.geometry) {
                this.orbitalTrajectory.geometry.dispose();
            }
            if (this.orbitalTrajectory.material) {
                this.orbitalTrajectory.material.dispose();
            }
            this.orbitalTrajectory = null;
        }

        if (!this.spacecraft || !this.planet) return;

        const orbit = this._cachedOrbitalParams || this.calculateOrbitalParameters();
        if (!orbit || orbit.eccentricity >= 1.0) return;

        const { semiMajorAxis, eccentricity } = orbit;

        const points = this.calculateOrbitPoints(semiMajorAxis, eccentricity, orbit);
        if (points.length === 0) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            opacity: 0.7,
            transparent: true,
            linewidth: 1
        });

        this.orbitalTrajectory = new THREE.Line(geometry, material);
        this.scene.add(this.orbitalTrajectory);
    }

    /**
     * Calculates points along the elliptical orbit
     * @param {number} semiMajorAxis - Semi-major axis of the orbit
     * @param {number} eccentricity - Eccentricity of the orbit
     * @param {Object} orbitParams - Pre-computed orbital parameters
     * @returns {Array<THREE.Vector3>} Points defining the orbital path
     */
    calculateOrbitPoints(semiMajorAxis, eccentricity, orbitParams) {
        const scaleManager = window.scaleManager;
        if (!scaleManager) return [];

        const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
        const focalDistance = semiMajorAxis * eccentricity;

        const numPoints = 200;
        const points = [];

        // Get real-world position and velocity for orbital orientation
        const relPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
        const relPositionReal = scaleManager.vectorToRealWorld(relPosition);
        const relVelocityReal = scaleManager.vectorToRealWorld(this.spacecraft.velocity);

        // Calculate angular momentum vector
        const h = new THREE.Vector3().crossVectors(relPositionReal, relVelocityReal);
        const hNormalized = h.clone().normalize();

        // Calculate the eccentricity vector (points toward periapsis)
        const mu = physics.G * this.planet.mass;
        const vCrossH = new THREE.Vector3().crossVectors(relVelocityReal, h);
        const eVector = vCrossH.divideScalar(mu).sub(relPositionReal.clone().normalize());
        const eNormalized = eVector.clone().normalize();

        // Perpendicular vector in the orbital plane
        const pVector = new THREE.Vector3().crossVectors(hNormalized, eNormalized).normalize();

        // Generate points around the ellipse in the orbital plane
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;

            const x = semiMajorAxis * Math.cos(angle) - focalDistance;
            const y = semiMinorAxis * Math.sin(angle);

            const point = new THREE.Vector3();
            point.addScaledVector(eNormalized, x);
            point.addScaledVector(pVector, y);

            const scaledPoint = scaleManager.vectorToVisualizationSpace(point);
            scaledPoint.add(this.planet.mesh.position);

            points.push(scaledPoint);
        }

        return points;
    }

    /**
     * Updates the orbital trajectory visualization when orbit changes
     */
    updateOrbitalTrajectory() {
        // Only update periodically to avoid performance issues
        if (!this._lastTrajectoryUpdate ||
            (Date.now() - this._lastTrajectoryUpdate) > 1000) {

            this.createOrbitalTrajectory();
            this._lastTrajectoryUpdate = Date.now();
        }
    }

    /**
     * Increase the time warp factor to the next level
     */
    increaseTimeWarp() {
        if (this.timeWarp.currentIndex < this.timeWarp.available.length - 1) {
            this.timeWarp.currentIndex++;
            this.timeWarp.factor = this.timeWarp.available[this.timeWarp.currentIndex];
            this.timeWarp.active = this.timeWarp.factor > 1;
        }
    }

    /**
     * Decrease the time warp factor to the previous level
     */
    decreaseTimeWarp() {
        if (this.timeWarp.currentIndex > 0) {
            this.timeWarp.currentIndex--;
            this.timeWarp.factor = this.timeWarp.available[this.timeWarp.currentIndex];
            this.timeWarp.active = this.timeWarp.factor > 1;
        }
    }

    /**
     * Setup post-processing
     */
    setupPostProcessing() {
        this.composer = new THREE.EffectComposer(this.renderer);

        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        renderPass.renderToScreen = true;
        this.composer.addPass(renderPass);
    }
}
