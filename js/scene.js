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
        this.predictedTrajectory = null;
        this.mapOverlay = null;
        this.maneuverMarker = null;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 90;
        this.pointer = new THREE.Vector2();

        this.maneuver = {
            active: false,
            progradeDV: 0,
            normalDV: 0,
            radialDV: 0,
            nodeTime: 0,
            autoAlign: false,
            autoBurn: false,
            burnActive: false,
            burnRemainingDV: 0,
            burnInitialDV: 0,
            burnMassBefore: null,
            burnCutoffTime: null,
            predictedOrbit: null
        };
        this.assistOwnership = {
            manual: null,
            node: null
        };

        this.displayOptions = {
            orbit: true,
            earthGrid: true,
            coastlines: true,
            stars: true
        };

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
            space: false, // Forward thrust (SPS)
            w: false,     // Pitch down
            a: false,     // Yaw left
            d: false,     // Yaw right
            q: false,     // Roll left
            e: false,     // Roll right
            s: false,     // Pitch up
            period: false, // Increase time warp
            comma: false,  // Decrease time warp
            t: false,     // Toggle SAS
            // RCS translation keys
            i: false,     // Translate forward (+Z local)
            k: false,     // Translate backward (-Z local)
            j: false,     // Translate left (-X local)
            l: false,     // Translate right (+X local)
            u: false,     // Translate up (+Y local)
            o: false      // Translate down (-Y local)
        };

        // Chase camera settings
        this.cameraSettings = {
            distance: 10,
            zoomSpeed: 1.0,
            minDistance: 4,
            maxDistance: 42,
            horizontalOrbit: -0.28,
            verticalOrbit: 0.18,
            orbitSpeed: 0.01
        };

        this.mapSettings = {
            zoom: 16000,
            minZoom: 9000,
            maxZoom: 42000
        };

        // Camera reference frame mode: 'craft', 'orbit', or 'map'
        this.cameraMode = 'craft';

        // Mouse state for camera control
        this.mouseState = {
            isDragging: false,
            lastX: 0,
            lastY: 0,
            startX: 0,
            startY: 0,
            moved: false
        };

        // Cached orbital parameters (computed once per frame)
        this._cachedOrbitalParams = null;

        // Setup post-processing
        this.setupPostProcessing();

        // Create navball attitude indicator
        this.navball = new Navball();

        // Create audio engine (initialized on first user interaction)
        this.audio = new AudioEngine();

        // Setup resize handler
        this.setupResizeHandler();

        this.setupMapLabels();
        this.setupNodeEditor();
    }

    /**
     * Get viewport height minus the bottom bar
     */
    getViewportHeight() {
        const bar = document.getElementById('bottom-bar');
        return window.innerHeight - (bar ? bar.offsetHeight : 140);
    }

    /**
     * Setup the camera
     */
    setupCamera() {
        const viewHeight = this.getViewportHeight();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / viewHeight,
            0.1,
            10000000 // Far enough for distant stars, reasonable with logarithmic depth
        );

        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);

        this.mapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000000);
        this.updateMapCameraProjection();
    }

    updateMapCameraProjection() {
        if (!this.mapCamera) return;

        const viewHeight = this.getViewportHeight();
        const aspect = window.innerWidth / viewHeight;
        const halfHeight = this.mapSettings ? this.mapSettings.zoom / 2 : 8000;
        const halfWidth = halfHeight * aspect;

        this.mapCamera.left = -halfWidth;
        this.mapCamera.right = halfWidth;
        this.mapCamera.top = halfHeight;
        this.mapCamera.bottom = -halfHeight;
        this.mapCamera.updateProjectionMatrix();
    }

    getActiveCamera() {
        return this.cameraMode === 'map' ? this.mapCamera : this.camera;
    }

    /**
     * Setup the renderer
     */
    setupRenderer() {
        const viewHeight = this.getViewportHeight();
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, viewHeight);
        this.renderer.setClearColor(0x000000);
        this.renderer.domElement.id = 'main-canvas';
        document.body.insertBefore(this.renderer.domElement, document.body.firstChild);
    }

    /**
     * Handle window resize to keep viewport correct
     */
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            const viewHeight = this.getViewportHeight();
            this.camera.aspect = window.innerWidth / viewHeight;
            this.camera.updateProjectionMatrix();
            this.updateMapCameraProjection();
            this.renderer.setSize(window.innerWidth, viewHeight);
            if (this.navball) {
                this.navball.resize();
            }
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

    setupMapLabels() {
        this.mapLabels = {};
        const labels = ['ap', 'pe', 'ship', 'node'];
        for (let i = 0; i < labels.length; i++) {
            const element = document.createElement('div');
            element.className = 'map-label';
            element.style.display = 'none';
            document.body.appendChild(element);
            this.mapLabels[labels[i]] = element;
        }
    }

    setupNodeEditor() {
        const panel = document.getElementById('node-editor');
        if (!panel) return;

        panel.querySelectorAll('[data-node-axis]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.adjustManeuverComponent(
                    button.dataset.nodeAxis,
                    Number(button.dataset.nodeDelta)
                );
            });
        });

        panel.querySelectorAll('[data-node-time]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.adjustManeuverTime(Number(button.dataset.nodeTime));
            });
        });

        panel.querySelectorAll('[data-node-action]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.handleNodeAction(button.dataset.nodeAction);
            });
        });
    }

    /**
     * Setup grid and axes helpers (disabled - clean view)
     */
    setupHelpers() {
        // Debug helpers removed for clean flight view
    }

    /**
     * Add background stars from real star catalog (HYG Database)
     */
    addStars() {
        const catalog = window.STAR_CATALOG;
        if (!catalog || catalog.length === 0) {
            console.warn('Star catalog not loaded, skipping stars');
            return;
        }

        const geometry = this.createStarGeometry(catalog);
        const material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                attribute vec3 color;
                attribute float size;
                attribute float alpha;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    vColor = color;
                    vAlpha = alpha;
                    gl_PointSize = size;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    float dist = length(coord);
                    if (dist > 0.5) discard;
                    float core = smoothstep(0.5, 0.08, dist);
                    gl_FragColor = vec4(vColor, vAlpha * core);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            vertexColors: true
        });

        // Stars go in their own scene so they never interact with the main depth buffer.
        // Rendered first each frame, then depth is cleared before the main scene.
        this.starScene = new THREE.Scene();
        const stars = new THREE.Points(geometry, material);
        stars.frustumCulled = false;
        this.starField = stars;
        this.starScene.add(stars);
    }

    createStarGeometry(catalog) {
        const radius = 5000000;
        const positions = [];
        const colors = [];
        const sizes = [];
        const alphas = [];

        for (let i = 0; i < catalog.length; i++) {
            const star = catalog[i];
            const mag = star[2];
            if (!isFinite(mag) || mag > 6.5) continue;

            const dir = this.starDirectionFromRaDec(star[0], star[1]);
            const rgb = this.bvToRGB(star[3]);
            const colorScale = this.starColorIntensity(mag);
            positions.push(dir.x * radius, dir.y * radius, dir.z * radius);
            colors.push(rgb[0] * colorScale, rgb[1] * colorScale, rgb[2] * colorScale);
            sizes.push(this.starPointSize(mag));
            alphas.push(this.starAlpha(mag));
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(colors), 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(sizes), 1));
        geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(new Float32Array(alphas), 1));
        return geometry;
    }

    starDirectionFromRaDec(raDeg, decDeg) {
        const raRad = THREE.MathUtils.degToRad(raDeg);
        const decRad = THREE.MathUtils.degToRad(decDeg);
        const cosDec = Math.cos(decRad);

        // ICRS/J2000 equatorial axes remapped to Three: X = RA 0h,
        // Y = north celestial pole, -Z = RA 6h. This preserves handedness.
        return new THREE.Vector3(
            cosDec * Math.cos(raRad),
            Math.sin(decRad),
            -cosDec * Math.sin(raRad)
        ).normalize();
    }

    starPointSize(magnitude) {
        const clamped = THREE.MathUtils.clamp(magnitude, -1.5, 6.5);
        return THREE.MathUtils.clamp(7.4 - (clamped + 1.5) * 0.72, 1.15, 8.2);
    }

    starAlpha(magnitude) {
        const relativeToSirius = Math.pow(10, -0.4 * (magnitude + 1.46));
        return THREE.MathUtils.clamp(0.18 + Math.pow(relativeToSirius, 0.35) * 0.74, 0.18, 0.98);
    }

    starColorIntensity(magnitude) {
        const relativeToSirius = Math.pow(10, -0.4 * (magnitude + 1.46));
        return THREE.MathUtils.clamp(0.62 + Math.pow(relativeToSirius, 0.22) * 0.55, 0.62, 1.25);
    }

    /**
     * Convert B-V color index to RGB [0-1, 0-1, 0-1]
     * Approximation of blackbody stellar colors
     */
    bvToRGB(bv) {
        // Clamp B-V to valid range
        bv = Math.max(-0.4, Math.min(2.0, bv));

        let r, g, b;

        // Red channel
        if (bv < 0.0) {
            r = 0.61 + 0.11 * bv + 0.1 * bv * bv;
        } else if (bv < 0.4) {
            r = 0.83 + 0.17 * bv;
        } else {
            r = 1.0;
        }

        // Green channel
        if (bv < 0.0) {
            g = 0.70 + 0.07 * bv + 0.1 * bv * bv;
        } else if (bv < 0.4) {
            g = 0.87 + 0.11 * bv;
        } else if (bv < 1.6) {
            g = 1.0 - 0.47 * (bv - 0.4);
        } else {
            g = 0.44;
        }

        // Blue channel
        if (bv < 0.0) {
            b = 1.0;
        } else if (bv < 0.4) {
            b = 1.0 - 0.8 * bv;
        } else if (bv < 1.5) {
            b = 0.68 - 0.45 * (bv - 0.4);
        } else {
            b = 0.19;
        }

        return [
            Math.max(0, Math.min(1, r)),
            Math.max(0, Math.min(1, g)),
            Math.max(0, Math.min(1, b))
        ];
    }

    /**
     * Setup controls for camera
     */
    setupControls() {
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && event.target === this.renderer.domElement) {
                this.mouseState.isDragging = true;
                this.mouseState.lastX = event.clientX;
                this.mouseState.lastY = event.clientY;
                this.mouseState.startX = event.clientX;
                this.mouseState.startY = event.clientY;
                this.mouseState.moved = false;
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (this.mouseState.isDragging) {
                const deltaX = event.clientX - this.mouseState.lastX;
                const deltaY = event.clientY - this.mouseState.lastY;
                const totalX = event.clientX - this.mouseState.startX;
                const totalY = event.clientY - this.mouseState.startY;

                if (Math.hypot(totalX, totalY) > 5) {
                    this.mouseState.moved = true;
                }

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

        document.addEventListener('mouseup', (event) => {
            if (
                event.button === 0 &&
                this.mouseState.isDragging &&
                !this.mouseState.moved &&
                event.target === this.renderer.domElement
            ) {
                this.placeNodeFromScreen(event.clientX, event.clientY);
            }
            this.mouseState.isDragging = false;
        });

        document.addEventListener('mouseleave', () => {
            this.mouseState.isDragging = false;
        });

        document.addEventListener('wheel', (event) => {
            if (this.cameraMode === 'map') {
                this.mapSettings.zoom += event.deltaY * 8;
                this.mapSettings.zoom = Math.max(
                    this.mapSettings.minZoom,
                    Math.min(this.mapSettings.maxZoom, this.mapSettings.zoom)
                );
                this.updateMapCameraProjection();
            } else {
                this.cameraSettings.distance += event.deltaY * 0.01 * this.cameraSettings.zoomSpeed;
                this.cameraSettings.distance = Math.max(
                    this.cameraSettings.minDistance,
                    Math.min(this.cameraSettings.maxDistance, this.cameraSettings.distance)
                );
            }
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
        // Initialize audio on first user interaction (browser autoplay policy)
        if (this.audio && !this.audio.initialized) {
            this.audio.init();
        }

        switch (event.key) {
            case ' ':
                if (!this.keys.space && !event.repeat) {
                    this.claimManualAssist('MANUAL THRUST');
                }
                this.keys.space = true;
                break;
            case 'w':
                if (!this.keys.w && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
                this.keys.w = true;
                break;
            case 'a':
                if (!this.keys.a && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
                this.keys.a = true;
                break;
            case 's':
                if (!this.keys.s && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
                this.keys.s = true;
                break;
            case 'd':
                if (!this.keys.d && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
                this.keys.d = true;
                break;
            case 'q':
                if (!this.keys.q && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
                this.keys.q = true;
                break;
            case 'e':
                if (!this.keys.e && !event.repeat) this.claimManualAssist('MANUAL ATTITUDE');
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
            case 'c':
                this.cameraMode = this.cameraMode === 'craft' ? 'orbit' : 'craft';
                break;
            case 'm':
                this.cameraMode = this.cameraMode === 'map' ? 'craft' : 'map';
                break;
            case 'n':
                this.toggleManeuverNode();
                break;
            case '[':
                this.adjustManeuverDV(-10);
                break;
            case ']':
                this.adjustManeuverDV(10);
                break;
            case '{':
                this.adjustManeuverTime(-60);
                break;
            case '}':
                this.adjustManeuverTime(60);
                break;
            case 'b':
                this.executeManeuver();
                break;
            case 'v':
                this.toggleManeuverAutoAlign();
                break;
            case '1':
                this.toggleDisplayOption('orbit');
                break;
            case '2':
                this.toggleDisplayOption('earthGrid');
                break;
            case '3':
                this.toggleDisplayOption('coastlines');
                break;
            case '4':
                this.toggleDisplayOption('stars');
                break;
            // RCS translation keys
            case 'i':
                this.keys.i = true;
                break;
            case 'k':
                this.keys.k = true;
                break;
            case 'j':
                this.keys.j = true;
                break;
            case 'l':
                this.keys.l = true;
                break;
            case 'u':
                this.keys.u = true;
                break;
            case 'o':
                this.keys.o = true;
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
            // RCS translation keys
            case 'i':
                this.keys.i = false;
                break;
            case 'k':
                this.keys.k = false;
                break;
            case 'j':
                this.keys.j = false;
                break;
            case 'l':
                this.keys.l = false;
                break;
            case 'u':
                this.keys.u = false;
                break;
            case 'o':
                this.keys.o = false;
                break;
        }

        if (!this.keys.space && !this.keys.w && !this.keys.a && !this.keys.s &&
            !this.keys.d && !this.keys.q && !this.keys.e) {
            this.clearManualAssistOwner();
        }
    }

    /**
     * Add the spacecraft to the scene
     * @param {Spacecraft} spacecraft The spacecraft object
     */
    addSpacecraft(spacecraft) {
        this.spacecraft = spacecraft;
        this.configureSpacecraftControls();
        this.scene.add(spacecraft.mesh);
        this.createOrbitalTrajectory();
    }

    configureSpacecraftControls() {
        if (!this.spacecraft || !this.spacecraft.rotationControl) return;

        this.spacecraft.rotationControl.rotationSpeed = 0.12;
        this.spacecraft.rotationControl.angularDamping = 0.965;
        this.spacecraft.rotationControl.sasDamping = 0.78;
        this.spacecraft.rotationControl.maxAngularRate = 0.09;
    }

    /**
     * Add a planet to the scene
     * @param {Planet} planet The planet object
     */
    addPlanet(planet) {
        this.planet = planet;
        this.scene.add(planet.mesh);
        this.createMapOverlay();
        this.createManeuverMarker();
    }

    createMapOverlay() {
        if (this.mapOverlay) {
            this.scene.remove(this.mapOverlay);
            this.mapOverlay.geometry.dispose();
            this.mapOverlay.material.dispose();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthTest: false,
            depthWrite: false
        });

        this.mapOverlay = new THREE.LineSegments(geometry, material);
        this.mapOverlay.visible = false;
        this.scene.add(this.mapOverlay);
    }

    createManeuverMarker() {
        if (this.maneuverMarker) {
            this.scene.remove(this.maneuverMarker);
            this.maneuverMarker.geometry.dispose();
            this.maneuverMarker.material.dispose();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3));
        const material = new THREE.LineBasicMaterial({
            color: 0xffef8a,
            transparent: true,
            opacity: 0.95,
            depthTest: false,
            depthWrite: false
        });

        this.maneuverMarker = new THREE.LineSegments(geometry, material);
        this.maneuverMarker.visible = false;
        this.scene.add(this.maneuverMarker);
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

        // Let the maneuver computer steer attitude before physics advances.
        this.updateManeuverAutoAlign(deltaTime);
        this.updateManeuverBurnControl(deltaTime);

        // Update physics
        this.updatePhysics(deltaTime);
        this.updateManeuverBurnProgress();

        // Advance maneuver countdown after the ship has moved for this frame.
        this.updateManeuverCountdown(deltaTime * this.timeWarp.factor);

        // Update the camera
        this.updateCamera(deltaTime);

        // Calculate orbital params once per frame for display and trajectory
        this._cachedOrbitalParams = this.calculateOrbitalParameters();

        // Update display values
        this.updateDisplay();

        // Update the orbital trajectory
        this.updateOrbitalTrajectory();
        this.updatePredictedTrajectory();
        this.updateMapOverlay();
        this.updateManeuverMarker();
        this.updateMapLabels();

        // Update navball
        if (this.navball && this.spacecraft && this.planet) {
            this.navball.update(this.spacecraft, this.planet, this.getCurrentManeuverVectorVisual());
        }

        // Update audio engine
        if (this.audio && this.spacecraft) {
            this.audio.update(this.spacecraft);
        }

        // Render stars first in their own scene (no depth interaction with main scene)
        this.renderer.autoClear = true;
        const activeCamera = this.getActiveCamera();
        if (this.starScene && this.displayOptions.stars) {
            if (this.starField) {
                this.starField.position.copy(activeCamera.position);
            }
            this.renderer.render(this.starScene, activeCamera);
            // Clear only depth so main scene renders on top of star background
            this.renderer.autoClear = false;
            this.renderer.clearDepth();
        }
        this.renderer.render(this.scene, activeCamera);
        this.renderer.autoClear = true;

        // Render navball overlay (dedicated canvas/renderer, no viewport restore needed)
        if (this.navball) {
            this.navball.render();
        }
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

            // Current mass accounts for fuel depletion
            const currentMass = this.spacecraft.getCurrentMass();

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
                this.spacecraft.update(warpedDeltaTime, false);
                return;
            }

            // When in time warp and not thrusting/translating, use Keplerian propagation (on rails)
            if (this.timeWarp.factor > 1 && !this.spacecraft.isThrusting && !this.spacecraft.isRCSThrusting) {
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
            if ((this.spacecraft.isThrusting || this.spacecraft.isRCSThrusting) && this.timeWarp.factor > 1) {
                const numSteps = Math.min(10, Math.ceil(this.timeWarp.factor));
                const stepDeltaTime = warpedDeltaTime / numSteps;

                for (let i = 0; i < numSteps; i++) {
                    const stepMass = this.spacecraft.getCurrentMass();

                    // SPS thrust with fuel consumption
                    if (this.spacecraft.isThrusting && this.spacecraft.spsPropellant > 0) {
                        const actualBurnTime = this.spacecraft.burnSPS(stepDeltaTime);
                        if (actualBurnTime > 0) {
                            const forwardVector = new THREE.Vector3(0, 0, 1);
                            forwardVector.applyQuaternion(this.spacecraft.mesh.quaternion);
                            const visualThrust = scaleManager.forceToVisualizationSpace(this.spacecraft.thrust);
                            const thrustAcceleration = forwardVector.multiplyScalar(visualThrust / stepMass);
                            this.spacecraft.velocity.add(thrustAcceleration.clone().multiplyScalar(actualBurnTime));
                        }
                    }

                    // RCS translation with fuel consumption
                    if (this.spacecraft.isRCSThrusting && this.spacecraft.rcsPropellant > 0) {
                        const rcsActualTime = this.spacecraft.burnRCS(stepDeltaTime);
                        if (rcsActualTime > 0) {
                            const rcsWorldDir = this.spacecraft.rcsTranslation.clone()
                                .applyQuaternion(this.spacecraft.mesh.quaternion);
                            const rcsThrust = 890; // 2 jets x 445N
                            const visualRcsThrust = scaleManager.forceToVisualizationSpace(rcsThrust);
                            const rcsAccel = rcsWorldDir.multiplyScalar(visualRcsThrust / stepMass);
                            this.spacecraft.velocity.add(rcsAccel.clone().multiplyScalar(rcsActualTime));
                        }
                    }

                    // Gravitational force
                    const realForce = physics.calculateGravitationalForce(
                        stepMass,
                        this.planet.mass,
                        scaleManager.vectorToRealWorld(this.spacecraft.position),
                        scaleManager.vectorToRealWorld(this.planet.mesh.position)
                    );

                    const visualForce = scaleManager.vectorToVisualizationSpace(realForce);
                    const acceleration = visualForce.divideScalar(stepMass);
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

            // SPS thrust with fuel consumption
            if (this.spacecraft.isThrusting && this.spacecraft.spsPropellant > 0) {
                const requestedBurnTime = this.getSpsBurnDuration(warpedDeltaTime);
                const actualBurnTime = this.spacecraft.burnSPS(requestedBurnTime);
                if (actualBurnTime > 0) {
                    const forwardVector = new THREE.Vector3(0, 0, 1);
                    forwardVector.applyQuaternion(this.spacecraft.mesh.quaternion);
                    const visualThrust = scaleManager.forceToVisualizationSpace(this.spacecraft.thrust);
                    const thrustAcceleration = forwardVector.multiplyScalar(visualThrust / currentMass);
                    this.spacecraft.velocity.add(thrustAcceleration.multiplyScalar(actualBurnTime));
                }
            }

            // RCS translation with fuel consumption
            if (this.spacecraft.isRCSThrusting && this.spacecraft.rcsPropellant > 0) {
                const rcsActualTime = this.spacecraft.burnRCS(warpedDeltaTime);
                if (rcsActualTime > 0) {
                    const rcsWorldDir = this.spacecraft.rcsTranslation.clone()
                        .applyQuaternion(this.spacecraft.mesh.quaternion);
                    const rcsThrust = 890; // 2 jets x 445N
                    const visualRcsThrust = scaleManager.forceToVisualizationSpace(rcsThrust);
                    const rcsAccel = rcsWorldDir.multiplyScalar(visualRcsThrust / currentMass);
                    this.spacecraft.velocity.add(rcsAccel.multiplyScalar(rcsActualTime));
                }
            }

            // Calculate gravitational force in real-world units
            const realForce = physics.calculateGravitationalForce(
                currentMass,
                this.planet.mass,
                scaleManager.vectorToRealWorld(this.spacecraft.position),
                scaleManager.vectorToRealWorld(this.planet.mesh.position)
            );

            const visualForce = scaleManager.vectorToVisualizationSpace(realForce);
            const acceleration = visualForce.divideScalar(currentMass);
            this.spacecraft.velocity.add(acceleration.multiplyScalar(warpedDeltaTime));
        }

        // Update spacecraft physics
        this.spacecraft.update(warpedDeltaTime, true);
    }

    /**
     * Process keyboard input
     */
    getCurrentAssistOwner() {
        if (this.assistOwnership.node) return this.assistOwnership.node;
        if (this.assistOwnership.manual) return this.assistOwnership.manual;
        return null;
    }

    getNodeAssistOwner() {
        return this.assistOwnership.node;
    }

    getManualAssistOwner() {
        return this.assistOwnership.manual;
    }

    clearManualAssistOwner() {
        this.assistOwnership.manual = null;
    }

    claimManualAssist(reason) {
        this.assistOwnership.manual = 'manual';
        this.cancelManeuverAssist(reason || 'MANUAL', { log: true });
        if (this.mission && this.mission.cancelForManualInput) {
            this.mission.cancelForManualInput(reason || 'MANUAL');
        }
    }

    setNodeAssistOwner(owner) {
        this.assistOwnership.node = owner || null;
        if (owner) {
            this.clearManualAssistOwner();
            if (this.mission && this.mission.cancelGuidanceForExternalOwner) {
                this.mission.cancelGuidanceForExternalOwner('NODE');
            }
        }
    }

    cancelManeuverAssist(reason, options = {}) {
        const hadNodeAssist = this.maneuver.autoAlign || this.maneuver.autoBurn || this.maneuver.burnActive || this.assistOwnership.node;
        if (!hadNodeAssist) return false;

        this.maneuver.autoAlign = false;
        this.maneuver.autoBurn = false;
        this.maneuver.burnActive = false;
        this.maneuver.burnRemainingDV = 0;
        this.maneuver.burnInitialDV = 0;
        this.maneuver.burnMassBefore = null;
        this.maneuver.burnCutoffTime = null;
        this.assistOwnership.node = null;
        if (this.spacecraft) {
            this.spacecraft.setThrust(false);
        }
        if (options.log && this.mission && this.mission.log) {
            this.mission.log((reason || 'ASSIST') + ' CANCEL NODE');
        }
        return true;
    }

    isAutoThrustOwnerActive() {
        const missionOwner = this.mission && this.mission.getMissionAssistOwner ?
            this.mission.getMissionAssistOwner() :
            null;
        return this.maneuver.burnActive ||
            missionOwner === 'mission-burn' ||
            missionOwner === 'launch-guidance';
    }

    processInput(deltaTime) {
        if (!this.spacecraft) return;

        // Forward thrust with spacebar (SPS engine)
        if (this.keys.space && this.spacecraft.spsPropellant > 0) {
            this.spacecraft.setThrust(true);
        } else if (!this.isAutoThrustOwnerActive()) {
            this.spacecraft.setThrust(false);
        }

        // Rotation controls (deltaTime passed for frame-rate independence)
        if (this.keys.w) this.spacecraft.rotate('pitch', 1, deltaTime);
        if (this.keys.s) this.spacecraft.rotate('pitch', -1, deltaTime);
        if (this.keys.a) this.spacecraft.rotate('yaw', 1, deltaTime);
        if (this.keys.d) this.spacecraft.rotate('yaw', -1, deltaTime);
        if (this.keys.q) this.spacecraft.rotate('roll', -1, deltaTime);
        if (this.keys.e) this.spacecraft.rotate('roll', 1, deltaTime);

        // RCS translation (IJKL + UO)
        const rcsDir = new THREE.Vector3(0, 0, 0);
        if (this.keys.i) rcsDir.z += 1;  // forward
        if (this.keys.k) rcsDir.z -= 1;  // backward
        if (this.keys.j) rcsDir.x -= 1;  // left
        if (this.keys.l) rcsDir.x += 1;  // right
        if (this.keys.u) rcsDir.y += 1;  // up
        if (this.keys.o) rcsDir.y -= 1;  // down

        if (rcsDir.lengthSq() > 0 && this.spacecraft.rcsPropellant > 0) {
            rcsDir.normalize();
            this.spacecraft.rcsTranslation.copy(rcsDir);
            this.spacecraft.isRCSThrusting = true;
            // Fire RCS audio pop
            if (this.audio) this.audio.fireRCS();
        } else {
            this.spacecraft.rcsTranslation.set(0, 0, 0);
            this.spacecraft.isRCSThrusting = false;
        }
    }

    /**
     * Update the camera
     * @param {number} deltaTime Time delta since last frame (seconds)
     */
    updateCamera(deltaTime) {
        if (!this.spacecraft) return;

        const spacecraftPos = this.spacecraft.position.clone();

        if (this.cameraMode === 'map') {
            if (this.planet) {
                const relPosition = spacecraftPos.clone().sub(this.planet.mesh.position);
                const velocity = this.spacecraft.velocity.clone();
                let normal = new THREE.Vector3().crossVectors(relPosition, velocity);
                if (normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
                normal.normalize();

                let radial = relPosition.clone();
                if (radial.lengthSq() < 1e-10) radial.set(0, 1, 0);
                radial.normalize();

                this.mapCamera.position.copy(this.planet.mesh.position).addScaledVector(normal, 1000000);
                this.mapCamera.up.copy(radial);
                this.mapCamera.lookAt(this.planet.mesh.position);
            }
            return;
        }

        if (this.cameraMode === 'craft') {
            // Craft-locked: camera offset is in spacecraft local space
            const baseOffset = new THREE.Vector3(0, 0, -this.cameraSettings.distance);
            baseOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraSettings.verticalOrbit);
            baseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraSettings.horizontalOrbit);

            const worldOffset = baseOffset.clone().applyQuaternion(this.spacecraft.mesh.quaternion);
            this.camera.position.copy(spacecraftPos).add(worldOffset);

            const localUp = new THREE.Vector3(0, 1, 0);
            this.camera.up.copy(localUp.applyQuaternion(this.spacecraft.mesh.quaternion));
        } else {
            // Orbit mode: build camera offset relative to radial-up frame
            // so mouse drag orbits naturally around the planet's radial axis
            if (this.planet) {
                const radialUp = spacecraftPos.clone().sub(this.planet.mesh.position).normalize();

                // Build a local frame: radialUp is Y, derive X and Z from velocity or fallback
                var forward = this.spacecraft.velocity.clone();
                if (forward.lengthSq() < 1e-10) forward.set(0, 0, 1);
                // Remove the radial component to get a tangent direction
                forward.sub(radialUp.clone().multiplyScalar(forward.dot(radialUp))).normalize();
                if (forward.lengthSq() < 1e-10) {
                    // Velocity is purely radial, pick an arbitrary tangent
                    forward.set(1, 0, 0);
                    forward.sub(radialUp.clone().multiplyScalar(forward.dot(radialUp))).normalize();
                }
                var right = new THREE.Vector3().crossVectors(forward, radialUp).normalize();

                // Build offset in this local frame using orbit angles
                // Negate horizontal to match drag direction (frame handedness differs from craft mode)
                var baseOffset = new THREE.Vector3(0, 0, -this.cameraSettings.distance);
                baseOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraSettings.verticalOrbit);
                baseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.cameraSettings.horizontalOrbit);

                // Transform from local frame to world: x->right, y->radialUp, z->forward
                var worldOffset = new THREE.Vector3();
                worldOffset.addScaledVector(right, baseOffset.x);
                worldOffset.addScaledVector(radialUp, baseOffset.y);
                worldOffset.addScaledVector(forward, baseOffset.z);

                this.camera.position.copy(spacecraftPos).add(worldOffset);
                this.camera.up.copy(radialUp);
            } else {
                var baseOffset2 = new THREE.Vector3(0, 0, -this.cameraSettings.distance);
                baseOffset2.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraSettings.verticalOrbit);
                baseOffset2.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraSettings.horizontalOrbit);
                this.camera.position.copy(spacecraftPos).add(baseOffset2);
                this.camera.up.set(0, 1, 0);
            }
        }

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

            const timeToAp = document.getElementById('time-to-ap');
            if (timeToAp) {
                timeToAp.textContent = this.formatOrbitTime(this.timeToTrueAnomaly(orbit, Math.PI));
            }

            const timeToPe = document.getElementById('time-to-pe');
            if (timeToPe) {
                timeToPe.textContent = this.formatOrbitTime(this.timeToTrueAnomaly(orbit, 0));
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

        // Update camera mode display
        const cameraModeDisplay = document.getElementById('camera-mode');
        if (cameraModeDisplay) {
            cameraModeDisplay.textContent = this.cameraMode.toUpperCase();
        }

        // Update fuel displays
        if (this.spacecraft) {
            const fuelDisplay = document.getElementById('fuel-percent');
            if (fuelDisplay) {
                fuelDisplay.textContent = this.spacecraft.getSPSFuelPercent().toFixed(1);
            }

            const dvDisplay = document.getElementById('delta-v');
            if (dvDisplay) {
                dvDisplay.textContent = this.spacecraft.getDeltaV().toFixed(0);
            }

            const rcsFuelDisplay = document.getElementById('rcs-fuel');
            if (rcsFuelDisplay) {
                rcsFuelDisplay.textContent = this.spacecraft.getRCSFuelPercent().toFixed(1);
            }

            const rateDisplay = document.getElementById('attitude-rate');
            if (rateDisplay) {
                rateDisplay.textContent = this.spacecraft.getAngularRateDeg().toFixed(1);
            }
        }

        const maneuverStatus = document.getElementById('maneuver-status');
        if (maneuverStatus) {
            maneuverStatus.textContent = this.maneuver.active ?
                (this.maneuver.burnActive ? 'BURN' : this.maneuver.autoBurn ? 'AUTO' : this.maneuver.autoAlign ? 'ALIGN' : 'ARMED') :
                'NONE';
        }
        const maneuverDV = document.getElementById('maneuver-dv');
        if (maneuverDV) {
            maneuverDV.textContent = this.getDisplayedManeuverDV().toFixed(0);
        }
        const dskyMode = document.getElementById('dsky-mode');
        if (dskyMode) dskyMode.textContent = this.cameraMode.toUpperCase();
        const dskyNode = document.getElementById('dsky-node');
        if (dskyNode) dskyNode.textContent = this.maneuver.active ?
            (this.maneuver.burnActive ? 'BRN ' : this.maneuver.autoBurn ? 'ARM ' : this.maneuver.autoAlign ? 'ALN ' : 'TIG ') + this.formatNodeTime(this.maneuver.nodeTime) :
            'NO NODE';
        const dskyVector = document.getElementById('dsky-vector');
        if (dskyVector) dskyVector.textContent = 'DV ' + this.getDisplayedManeuverDV().toFixed(0);
        this.updateNodeEditorDisplay();
    }

    timeToTrueAnomaly(orbit, targetTrueAnomaly) {
        if (!orbit || orbit.eccentricity >= 1 || !isFinite(orbit.orbitalPeriod)) return Infinity;
        const currentM = physics.trueToMeanAnomaly(orbit.trueAnomaly, orbit.eccentricity);
        const targetM = physics.trueToMeanAnomaly(targetTrueAnomaly, orbit.eccentricity);
        const meanMotion = (Math.PI * 2) / orbit.orbitalPeriod;
        let deltaM = targetM - currentM;
        while (deltaM < 0) deltaM += Math.PI * 2;
        return deltaM / meanMotion;
    }

    updateNodeEditorDisplay() {
        const setText = (id, text) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        };

        const totalDV = this.getDisplayedManeuverDV();
        setText('node-state', this.maneuver.active ?
            (this.maneuver.burnActive ? 'BURNING' : this.maneuver.autoBurn ? 'AUTO BURN' : this.maneuver.autoAlign ? 'ALIGNING' : 'NODE ARMED') :
            'NO NODE');
        setText('node-total', totalDV.toFixed(0) + ' m/s');
        setText('node-time', this.formatNodeTime(this.maneuver.nodeTime));
        setText('node-prograde', this.formatSigned(this.maneuver.progradeDV, 0));
        setText('node-normal', this.formatSigned(this.maneuver.normalDV, 0));
        setText('node-radial', this.formatSigned(this.maneuver.radialDV, 0));

        if (this.maneuver.predictedOrbit && this.planet && window.scaleManager) {
            const radiusKm = window.scaleManager.toRealWorld(this.planet.radius) / 1000;
            setText('node-ap', (this.maneuver.predictedOrbit.apoapsis / 1000 - radiusKm).toFixed(1) + ' km');
            setText('node-pe', (this.maneuver.predictedOrbit.periapsis / 1000 - radiusKm).toFixed(1) + ' km');
        } else {
            setText('node-ap', '-- km');
            setText('node-pe', '-- km');
        }

        const burnSeconds = this.maneuver.burnActive ? this.estimateRemainingManeuverBurnTime() : this.estimateManeuverBurnTime();
        const ignitionSeconds = this.maneuver.nodeTime - (burnSeconds / 2);
        setText('node-ignition', totalDV > 0 ? this.formatIgnitionTime(ignitionSeconds) : '--');
        const alignError = this.getManeuverAlignmentErrorDeg();
        setText('node-align-error', isFinite(alignError) ? alignError.toFixed(1) + ' deg' : '-- deg');
        setText('node-burn', burnSeconds > 0 ? burnSeconds.toFixed(1) + ' s' : '-- s');
    }

    formatOrbitTime(seconds) {
        if (!isFinite(seconds)) return '--';
        return (seconds / 60).toFixed(1);
    }

    formatNodeTime(seconds) {
        const clamped = Math.max(0, Math.round(seconds));
        const minutes = Math.floor(clamped / 60);
        const secs = clamped % 60;
        return '+' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    formatSigned(value, decimals) {
        return (value >= 0 ? '+' : '-') + Math.abs(value).toFixed(decimals);
    }

    formatIgnitionTime(seconds) {
        if (!isFinite(seconds)) return '--';
        if (seconds <= 0) return 'BURN';
        return 'T-' + this.formatNodeTime(seconds).slice(1);
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

        const segmentPoints = this.buildVisibleOrbitSegments(points);
        if (segmentPoints.length === 0) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);

        const material = new THREE.LineBasicMaterial({
            color: 0x00a8d8,
            opacity: 0.85,
            transparent: true,
            linewidth: 1
        });

        this.orbitalTrajectory = new THREE.LineSegments(geometry, material);
        this.scene.add(this.orbitalTrajectory);
    }

    buildVisibleOrbitSegments(points) {
        if (this.cameraMode === 'map' || !this.planet) {
            const allSegments = [];
            for (let i = 0; i < points.length - 1; i++) {
                allSegments.push(points[i], points[i + 1]);
            }
            return allSegments;
        }

        const camera = this.getActiveCamera();
        const visible = [];
        for (let i = 0; i < points.length - 1; i++) {
            const mid = points[i].clone().add(points[i + 1]).multiplyScalar(0.5);
            if (!this.isPointBehindPlanet(mid, camera)) {
                visible.push(points[i], points[i + 1]);
            }
        }
        return visible;
    }

    isPointBehindPlanet(point, camera) {
        const planetCenter = this.planet.mesh.position;
        const cameraToPoint = point.clone().sub(camera.position);
        const cameraToPlanet = planetCenter.clone().sub(camera.position);
        const distanceToPoint = cameraToPoint.length();
        if (distanceToPoint <= 0.0001) return false;

        const direction = cameraToPoint.clone().divideScalar(distanceToPoint);
        const projection = cameraToPlanet.dot(direction);
        if (projection <= 0 || projection >= distanceToPoint) return false;

        const closest = camera.position.clone().addScaledVector(direction, projection);
        const missDistance = closest.distanceTo(planetCenter);
        return missDistance < this.planet.radius * 1.002;
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

        const numPoints = 720;
        const points = [];

        const hNormalized = orbitParams.h.clone().normalize();
        let eNormalized = orbitParams.eVector.clone();
        if (eNormalized.lengthSq() < 1e-12) {
            const relPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            eNormalized = scaleManager.vectorToRealWorld(relPosition).normalize();
        } else {
            eNormalized.normalize();
        }

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

    updateMapOverlay() {
        if (!this.mapOverlay || !this.spacecraft || !this.planet) return;

        this.mapOverlay.visible = this.cameraMode === 'map';
        if (!this.mapOverlay.visible) return;

        const relPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
        const velocity = this.spacecraft.velocity.clone();
        if (relPosition.lengthSq() < 1e-10 || velocity.lengthSq() < 1e-10) return;

        const tangent = velocity.normalize();
        const normal = new THREE.Vector3().crossVectors(relPosition, tangent).normalize();
        const radial = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const pos = this.spacecraft.position.clone();
        const markerSize = 145;
        const velocityLength = 850;

        const points = [
            pos.clone().addScaledVector(tangent, -markerSize),
            pos.clone().addScaledVector(tangent, markerSize),
            pos.clone().addScaledVector(radial, -markerSize),
            pos.clone().addScaledVector(radial, markerSize),
            pos.clone(),
            pos.clone().addScaledVector(tangent, velocityLength)
        ];

        const attribute = this.mapOverlay.geometry.attributes.position;
        for (let i = 0; i < points.length; i++) {
            attribute.setXYZ(i, points[i].x, points[i].y, points[i].z);
        }
        attribute.needsUpdate = true;
        this.mapOverlay.geometry.computeBoundingSphere();
    }

    updateManeuverMarker() {
        if (!this.maneuverMarker || !this.spacecraft || !this.planet || !window.scaleManager) return;

        this.maneuverMarker.visible = this.maneuver.active;
        if (!this.maneuverMarker.visible) return;

        const state = this.getNodeStateReal();
        const nodePosition = this.getNodeWorldPosition();
        if (!state || !nodePosition) return;

        const frame = this.getOrbitalFrameReal(state.position, state.velocity);
        const prograde = window.scaleManager.vectorToVisualizationSpace(frame.prograde).normalize();
        const normal = window.scaleManager.vectorToVisualizationSpace(frame.normal).normalize();
        const radial = window.scaleManager.vectorToVisualizationSpace(frame.radial).normalize();
        const burn = window.scaleManager.vectorToVisualizationSpace(this.getManeuverVectorReal(state));
        const burnDirection = burn.lengthSq() > 1e-10 ? burn.normalize() : prograde;

        const markerSize = this.cameraMode === 'map' ? 230 : 72;
        const burnLength = markerSize * THREE.MathUtils.clamp(this.getManeuverTotalDV() / 120, 0.7, 5.0);
        const connector = this.cameraMode === 'map' ? this.spacecraft.position : nodePosition;
        const points = [
            nodePosition.clone().addScaledVector(prograde, -markerSize),
            nodePosition.clone().addScaledVector(prograde, markerSize),
            nodePosition.clone().addScaledVector(radial, -markerSize * 0.72),
            nodePosition.clone().addScaledVector(radial, markerSize * 0.72),
            nodePosition.clone().addScaledVector(normal, -markerSize * 0.52),
            nodePosition.clone().addScaledVector(normal, markerSize * 0.52),
            connector.clone(),
            nodePosition.clone(),
            nodePosition.clone(),
            nodePosition.clone().addScaledVector(burnDirection, burnLength),
            nodePosition.clone().addScaledVector(burnDirection, burnLength).addScaledVector(radial, -markerSize * 0.18),
            nodePosition.clone().addScaledVector(burnDirection, burnLength),
        ];

        const attribute = this.maneuverMarker.geometry.attributes.position;
        for (let i = 0; i < points.length; i++) {
            attribute.setXYZ(i, points[i].x, points[i].y, points[i].z);
        }
        attribute.needsUpdate = true;
        this.maneuverMarker.geometry.computeBoundingSphere();
    }

    updateMapLabels() {
        if (!this.mapLabels) return;
        const visible = this.cameraMode === 'map' && this.planet && this.spacecraft && this._cachedOrbitalParams;
        for (const key in this.mapLabels) {
            this.mapLabels[key].style.display = visible ? 'block' : 'none';
        }
        if (!visible) return;

        const orbit = this._cachedOrbitalParams;
        const periDir = orbit.eVector.lengthSq() > 1e-12 ?
            orbit.eVector.clone().normalize() :
            this.spacecraft.position.clone().sub(this.planet.mesh.position).normalize();
        const apoDir = periDir.clone().negate();
        const pe = this.planet.mesh.position.clone().addScaledVector(
            window.scaleManager.vectorToVisualizationSpace(periDir),
            orbit.periapsis
        );
        const ap = this.planet.mesh.position.clone().addScaledVector(
            window.scaleManager.vectorToVisualizationSpace(apoDir),
            orbit.apoapsis
        );

        this.placeScreenLabel(this.mapLabels.pe, pe, 'PE');
        this.placeScreenLabel(this.mapLabels.ap, ap, 'AP');
        this.placeScreenLabel(this.mapLabels.ship, this.spacecraft.position, 'CSM');
        const nodePosition = this.getNodeWorldPosition();
        this.placeScreenLabel(
            this.mapLabels.node,
            nodePosition || this.spacecraft.position,
            this.maneuver.active ? 'NODE DV ' + this.getManeuverTotalDV().toFixed(0) : ''
        );
    }

    placeScreenLabel(element, worldPosition, text) {
        if (!text) {
            element.style.display = 'none';
            return;
        }
        const viewHeight = this.getViewportHeight();
        const projected = worldPosition.clone().project(this.getActiveCamera());
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-projected.y * 0.5 + 0.5) * viewHeight;
        element.textContent = text;
        element.style.left = x + 'px';
        element.style.top = y + 'px';
    }

    toggleDisplayOption(name) {
        if (!(name in this.displayOptions)) return;
        this.displayOptions[name] = !this.displayOptions[name];

        if (name === 'earthGrid' && this.planet && this.planet.gridLines) {
            this.planet.gridLines.visible = this.displayOptions[name];
        }
        if (name === 'coastlines' && this.planet && this.planet.coastlineSegments) {
            this.planet.coastlineSegments.visible = this.displayOptions[name];
        }
        if (name === 'orbit') {
            this.createOrbitalTrajectory();
            this.updatePredictedTrajectory(true);
        }
    }

    toggleManeuverNode() {
        if (this.maneuver.active) {
            this.clearManeuver();
            return;
        }
        this.createManeuver();
    }

    createManeuver() {
        this.maneuver.active = true;
        if (this.getManeuverTotalDV() === 0) {
            this.maneuver.progradeDV = 10;
        }
        this.updatePredictedTrajectory(true);
    }

    clearManeuver() {
        this.cancelManeuverAssist('CLEAR', { log: false });
        this.maneuver.active = false;
        this.maneuver.progradeDV = 0;
        this.maneuver.normalDV = 0;
        this.maneuver.radialDV = 0;
        this.maneuver.nodeTime = 0;
        this.maneuver.autoAlign = false;
        this.maneuver.autoBurn = false;
        this.maneuver.burnActive = false;
        this.maneuver.burnRemainingDV = 0;
        this.maneuver.burnInitialDV = 0;
        this.maneuver.burnMassBefore = null;
        this.maneuver.burnCutoffTime = null;
        this.assistOwnership.node = null;
        if (this.spacecraft) {
            this.spacecraft.setThrust(false);
        }
        this.updatePredictedTrajectory(true);
    }

    adjustManeuverDV(delta) {
        this.adjustManeuverComponent('prograde', delta);
    }

    adjustManeuverComponent(axis, delta) {
        if (!this.maneuver.active) {
            this.createManeuver();
        }

        const property = axis + 'DV';
        if (!(property in this.maneuver)) return;
        this.maneuver[property] = THREE.MathUtils.clamp(this.maneuver[property] + delta, -3000, 3000);
        this.cancelManeuverAssist('NODE EDIT', { log: true });
        this.updatePredictedTrajectory(true);
    }

    adjustManeuverTime(deltaSeconds) {
        if (!this.maneuver.active) {
            this.createManeuver();
        }

        const orbit = this._cachedOrbitalParams || this.calculateOrbitalParameters();
        const maxTime = orbit && isFinite(orbit.orbitalPeriod) ? orbit.orbitalPeriod : 86400;
        this.maneuver.nodeTime = THREE.MathUtils.clamp(this.maneuver.nodeTime + deltaSeconds, 0, maxTime);
        this.cancelManeuverAssist('NODE EDIT', { log: true });
        this.updatePredictedTrajectory(true);
    }

    handleNodeAction(action) {
        switch (action) {
            case 'create':
                this.createManeuver();
                break;
            case 'clear':
                this.clearManeuver();
                break;
            case 'zero':
                this.maneuver.progradeDV = 0;
                this.maneuver.normalDV = 0;
                this.maneuver.radialDV = 0;
                this.cancelManeuverAssist('NODE ZERO', { log: true });
                this.updatePredictedTrajectory(true);
                break;
            case 'align':
                this.toggleManeuverAutoAlign();
                break;
            case 'execute':
                this.executeManeuver();
                break;
            case 'now':
                this.maneuver.nodeTime = 0;
                this.cancelManeuverAssist('NODE EDIT', { log: true });
                this.createManeuver();
                break;
            case 'ap':
                this.setNodeAtTrueAnomaly(Math.PI);
                break;
            case 'pe':
                this.setNodeAtTrueAnomaly(0);
                break;
        }
    }

    setNodeAtTrueAnomaly(trueAnomaly) {
        const orbit = this._cachedOrbitalParams || this.calculateOrbitalParameters();
        if (!orbit) return;
        this.maneuver.nodeTime = Math.max(0, this.timeToTrueAnomaly(orbit, trueAnomaly));
        this.cancelManeuverAssist('NODE EDIT', { log: true });
        this.createManeuver();
    }

    placeNodeFromScreen(clientX, clientY) {
        if (!this.orbitalTrajectory || !this.spacecraft || !this.planet || !window.scaleManager) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.getActiveCamera());

        const hits = this.raycaster.intersectObject(this.orbitalTrajectory, false);
        if (hits.length === 0) return;

        this.setNodeAtWorldPosition(hits[0].point);
    }

    setNodeAtWorldPosition(worldPosition) {
        const orbit = this._cachedOrbitalParams || this.calculateOrbitalParameters();
        if (!orbit || orbit.eccentricity >= 1 || !window.scaleManager) return;

        const realPosition = window.scaleManager.vectorToRealWorld(worldPosition.clone().sub(this.planet.mesh.position));
        if (realPosition.lengthSq() < 1e-8) return;

        let periDir = orbit.eVector.clone();
        if (periDir.lengthSq() < 1e-12) {
            periDir = window.scaleManager.vectorToRealWorld(
                this.spacecraft.position.clone().sub(this.planet.mesh.position)
            );
        }
        periDir.normalize();

        const orbitNormal = orbit.h.clone().normalize();
        const planeY = new THREE.Vector3().crossVectors(orbitNormal, periDir).normalize();
        const projected = realPosition.sub(
            orbitNormal.clone().multiplyScalar(realPosition.dot(orbitNormal))
        ).normalize();

        let trueAnomaly = Math.atan2(projected.dot(planeY), projected.dot(periDir));
        if (trueAnomaly < 0) trueAnomaly += Math.PI * 2;

        this.maneuver.nodeTime = Math.max(0, this.timeToTrueAnomaly(orbit, trueAnomaly));
        this.cancelManeuverAssist('NODE EDIT', { log: true });
        this.createManeuver();
    }

    getManeuverTotalDV() {
        return Math.sqrt(
            this.maneuver.progradeDV * this.maneuver.progradeDV +
            this.maneuver.normalDV * this.maneuver.normalDV +
            this.maneuver.radialDV * this.maneuver.radialDV
        );
    }

    getDisplayedManeuverDV() {
        return this.maneuver.burnActive ? this.maneuver.burnRemainingDV : this.getManeuverTotalDV();
    }

    estimateManeuverBurnTime() {
        if (!this.spacecraft) return 0;
        const totalDV = this.getManeuverTotalDV();
        if (totalDV <= 0) return 0;
        return this.estimateBurnTimeForDV(totalDV);
    }

    estimateRemainingManeuverBurnTime() {
        return this.estimateBurnTimeForDV(this.maneuver.burnRemainingDV);
    }

    estimateBurnTimeForDV(deltaV) {
        if (!this.spacecraft || deltaV <= 0) return 0;
        const currentMass = this.spacecraft.getCurrentMass();
        const exhaustVelocity = this.spacecraft.spsIsp * 9.81;
        const requiredPropellant = currentMass * (1 - Math.exp(-deltaV / exhaustVelocity));
        const usablePropellant = Math.min(requiredPropellant, this.spacecraft.spsPropellant);
        return usablePropellant / this.spacecraft.spsFlowRate;
    }

    updateManeuverCountdown(deltaTime) {
        if (!this.maneuver.active || this.maneuver.burnActive || this.maneuver.nodeTime <= 0 || deltaTime <= 0) return;

        this.maneuver.nodeTime = Math.max(0, this.maneuver.nodeTime - deltaTime);
        const ignitionLeadTime = this.estimateManeuverBurnTime() / 2;
        if (this.maneuver.autoBurn && this.maneuver.nodeTime <= ignitionLeadTime) {
            this.executeManeuver(true);
            return;
        }

        if (this.maneuver.nodeTime <= 0.001) {
            this.maneuver.nodeTime = 0;
        }
    }

    armManeuverBurn() {
        if (!this.maneuver.active || this.getManeuverTotalDV() <= 0) return;

        this.maneuver.autoBurn = true;
        this.maneuver.autoAlign = true;
        this.setNodeAssistOwner('manual-node');
        if (this.spacecraft) {
            this.spacecraft.sasActive = true;
        }
    }

    toggleManeuverAutoAlign() {
        if (!this.maneuver.active || this.getManeuverTotalDV() <= 0) {
            this.createManeuver();
        }
        this.maneuver.autoAlign = !this.maneuver.autoAlign;
        if (this.maneuver.autoAlign) {
            this.setNodeAssistOwner('manual-node');
        } else if (!this.maneuver.autoBurn && !this.maneuver.burnActive) {
            this.assistOwnership.node = null;
        }
        if (this.spacecraft && this.maneuver.autoAlign) {
            this.spacecraft.sasActive = true;
        }
    }

    updateManeuverAutoAlign(deltaTime) {
        if (!this.maneuver.autoAlign || !this.spacecraft) return;

        const target = this.getCurrentManeuverVectorVisual();
        if (!target || target.lengthSq() < 1e-10) {
            this.maneuver.autoAlign = false;
            if (!this.maneuver.autoBurn && !this.maneuver.burnActive) {
                this.assistOwnership.node = null;
            }
            return;
        }

        const targetDirection = target.normalize();
        const state = this.getNodeStateReal();
        let up = new THREE.Vector3(0, 1, 0);
        if (state && window.scaleManager) {
            up = window.scaleManager.vectorToVisualizationSpace(state.position).normalize();
        }
        if (Math.abs(up.dot(targetDirection)) > 0.92) {
            up = new THREE.Vector3(0, 0, 1);
        }

        const targetMatrix = new THREE.Matrix4().lookAt(
            new THREE.Vector3(0, 0, 0),
            targetDirection.clone().negate(),
            up
        );
        const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
        const slewRate = 1 - Math.exp(-deltaTime * 1.8);
        this.spacecraft.mesh.quaternion.slerp(targetQuaternion, slewRate);
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;

        if (!this.maneuver.burnActive && this.getManeuverAlignmentErrorDeg() < 0.4) {
            this.maneuver.autoAlign = false;
            if (!this.maneuver.autoBurn) {
                this.assistOwnership.node = null;
            }
        }
    }

    getSpsBurnDuration(warpedDeltaTime) {
        if (!this.maneuver.burnActive || !this.spacecraft) return warpedDeltaTime;
        if (this.maneuver.burnCutoffTime !== null) {
            return Math.max(0, Math.min(warpedDeltaTime, this.maneuver.burnCutoffTime));
        }
        return warpedDeltaTime;
    }

    beginManeuverBurn() {
        if (!this.maneuver.active || !this.spacecraft || this.getManeuverTotalDV() <= 0) return;

        this.maneuver.nodeTime = 0;
        this.maneuver.autoBurn = false;
        this.maneuver.autoAlign = true;
        this.maneuver.burnActive = true;
        this.maneuver.burnInitialDV = this.getManeuverTotalDV();
        this.maneuver.burnRemainingDV = this.maneuver.burnInitialDV;
        this.maneuver.burnMassBefore = null;
        this.maneuver.burnCutoffTime = null;
        this.setNodeAssistOwner('manual-node');
        this.spacecraft.sasActive = true;

        if (this.timeWarp.factor > 1) {
            this.timeWarp.currentIndex = 0;
            this.timeWarp.factor = 1;
            this.timeWarp.active = false;
        }
    }

    updateManeuverBurnControl(deltaTime) {
        if (!this.maneuver.burnActive || !this.spacecraft) return;

        if (this.maneuver.burnRemainingDV <= 0.05 || this.spacecraft.spsPropellant <= 0) {
            this.finishManeuverBurn();
            return;
        }

        this.maneuver.autoAlign = true;
        this.maneuver.burnMassBefore = this.spacecraft.getCurrentMass();

        const burnSeconds = this.estimateRemainingManeuverBurnTime();
        const warpedDeltaTime = deltaTime * this.timeWarp.factor;
        this.maneuver.burnCutoffTime = burnSeconds > 0 && burnSeconds < warpedDeltaTime ? burnSeconds : null;
        this.spacecraft.setThrust(true);
    }

    updateManeuverBurnProgress() {
        if (!this.maneuver.burnActive || !this.spacecraft || this.maneuver.burnMassBefore === null) return;

        const massBefore = this.maneuver.burnMassBefore;
        const massAfter = this.spacecraft.getCurrentMass();
        if (massAfter < massBefore) {
            const deliveredDV = this.spacecraft.spsIsp * 9.81 * Math.log(massBefore / massAfter);
            this.maneuver.burnRemainingDV = Math.max(0, this.maneuver.burnRemainingDV - deliveredDV);
        }

        this.maneuver.burnMassBefore = null;
        this.maneuver.burnCutoffTime = null;

        if (this.maneuver.burnRemainingDV <= 0.05 || this.spacecraft.spsPropellant <= 0) {
            this.finishManeuverBurn();
        }
    }

    finishManeuverBurn() {
        if (!this.spacecraft) return;
        this.spacecraft.setThrust(false);
        this.maneuver.burnActive = false;
        this.maneuver.burnRemainingDV = 0;
        this.maneuver.burnInitialDV = 0;
        this.maneuver.burnMassBefore = null;
        this.maneuver.burnCutoffTime = null;
        this.clearManeuver();
        this.createOrbitalTrajectory();
    }

    getManeuverAlignmentErrorDeg() {
        if (!this.spacecraft || !this.maneuver.active || this.getManeuverTotalDV() <= 0) return Infinity;

        const target = this.getCurrentManeuverVectorVisual();
        if (!target || target.lengthSq() < 1e-10) return Infinity;

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.spacecraft.mesh.quaternion).normalize();
        const targetDirection = target.normalize();
        const dot = THREE.MathUtils.clamp(forward.dot(targetDirection), -1, 1);
        return THREE.MathUtils.radToDeg(Math.acos(dot));
    }

    getNodeStateReal() {
        if (!this.spacecraft || !this.planet || !window.scaleManager) return null;

        const scaleManager = window.scaleManager;
        const position = scaleManager.vectorToRealWorld(this.spacecraft.position.clone().sub(this.planet.mesh.position));
        const velocity = scaleManager.vectorToRealWorld(this.spacecraft.velocity);

        if (this.maneuver.nodeTime <= 0) {
            return { position, velocity };
        }

        const orbit = this._cachedOrbitalParams || this.calculateOrbitalParameters();
        if (!orbit || orbit.eccentricity >= 1) {
            return { position, velocity };
        }

        return physics.propagateKeplerian(orbit, this.planet.mass, this.maneuver.nodeTime) || { position, velocity };
    }

    getOrbitalFrameReal(position, velocity) {
        const prograde = velocity.clone();
        if (prograde.lengthSq() < 1e-10) prograde.set(0, 1, 0);
        prograde.normalize();

        const normal = new THREE.Vector3().crossVectors(position, velocity);
        if (normal.lengthSq() < 1e-10) normal.set(0, 0, 1);
        normal.normalize();

        const radial = new THREE.Vector3().crossVectors(prograde, normal);
        if (radial.lengthSq() < 1e-10) radial.copy(position);
        radial.normalize();

        return { prograde, normal, radial };
    }

    getManeuverVectorReal(state) {
        if (!state) return new THREE.Vector3();
        const frame = this.getOrbitalFrameReal(state.position, state.velocity);
        return new THREE.Vector3()
            .addScaledVector(frame.prograde, this.maneuver.progradeDV)
            .addScaledVector(frame.normal, this.maneuver.normalDV)
            .addScaledVector(frame.radial, this.maneuver.radialDV);
    }

    getCurrentManeuverVectorVisual() {
        if (!this.maneuver.active || this.getManeuverTotalDV() <= 0 || !window.scaleManager) return null;
        const state = this.getNodeStateReal();
        if (!state) return null;
        return window.scaleManager.vectorToVisualizationSpace(this.getManeuverVectorReal(state));
    }

    getNodeWorldPosition() {
        const state = this.getNodeStateReal();
        if (!state || !this.planet || !window.scaleManager) return null;
        return window.scaleManager.vectorToVisualizationSpace(state.position).add(this.planet.mesh.position);
    }

    coastSpacecraftToNode(state) {
        if (!state || !this.spacecraft || !this.planet || !window.scaleManager) return;
        const scaleManager = window.scaleManager;
        const visualPosition = scaleManager.vectorToVisualizationSpace(state.position).add(this.planet.mesh.position);
        const visualVelocity = scaleManager.vectorToVisualizationSpace(state.velocity);
        this.spacecraft.setPosition(visualPosition);
        this.spacecraft.setVelocity(visualVelocity);
    }

    executeManeuver(forceNow = false) {
        if (!this.maneuver.active || !this.spacecraft) return;
        const totalDV = this.getManeuverTotalDV();
        if (totalDV <= 0) return;

        const ignitionLeadTime = this.estimateManeuverBurnTime() / 2;
        if (!forceNow && this.maneuver.nodeTime > ignitionLeadTime) {
            this.armManeuverBurn();
            return;
        }

        this.beginManeuverBurn();
    }

    updatePredictedTrajectory(force = false) {
        if (!force && this._lastPredictedTrajectoryUpdate &&
            (Date.now() - this._lastPredictedTrajectoryUpdate) < 500) {
            return;
        }
        this._lastPredictedTrajectoryUpdate = Date.now();

        if (this.predictedTrajectory) {
            this.scene.remove(this.predictedTrajectory);
            this.predictedTrajectory.geometry.dispose();
            this.predictedTrajectory.material.dispose();
            this.predictedTrajectory = null;
        }
        this.maneuver.predictedOrbit = null;

        if (!this.maneuver.active || !this.spacecraft || !this.planet || !this.displayOptions.orbit) return;

        const scaleManager = window.scaleManager;
        if (!scaleManager) return;

        const nodeState = this.getNodeStateReal();
        if (!nodeState) return;

        const plannedVelocity = nodeState.velocity.clone().add(this.getManeuverVectorReal(nodeState));
        const predicted = physics.calculateOrbitalParameters(nodeState.position, plannedVelocity, this.planet.mass);
        if (!predicted || predicted.eccentricity >= 1 || predicted.semiMajorAxis <= 0) return;

        this.maneuver.predictedOrbit = predicted;
        const points = this.calculateOrbitPoints(predicted.semiMajorAxis, predicted.eccentricity, predicted);
        const segmentPoints = this.cameraMode === 'map' ? this.buildVisibleOrbitSegments(points) : pointsToSegments(points);
        if (segmentPoints.length === 0) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
        const material = new THREE.LineBasicMaterial({
            color: 0xffef8a,
            transparent: true,
            opacity: 0.95,
            linewidth: 1
        });
        this.predictedTrajectory = new THREE.LineSegments(geometry, material);
        this.scene.add(this.predictedTrajectory);

        function pointsToSegments(sourcePoints) {
            const result = [];
            for (let i = 0; i < sourcePoints.length - 1; i++) {
                result.push(sourcePoints[i], sourcePoints[i + 1]);
            }
            return result;
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
     * Setup post-processing (currently direct render - no bloom per design)
     */
    setupPostProcessing() {
        // No EffectComposer needed without bloom.
        // Direct renderer.render() avoids viewport state issues
        // that the composer's internal render targets can cause.
    }
}
