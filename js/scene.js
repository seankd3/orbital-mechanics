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
        
        // Create a reference to the spacecraft
        this.spacecraft = null;
        
        // Create a reference to the planet
        this.planet = null;
        
        // Setup camera controls
        this.setupControls();
        
        // Setup key listeners
        this.setupEventListeners();
        
        // Animation controls
        this.clock = new THREE.Clock();
        this.isRunning = true;
        
        // Control state
        this.keys = {
            space: false, // Forward thrust
            w: false,     // Pitch down
            a: false,     // Yaw left
            d: false,     // Yaw right
            q: false,     // Roll left
            e: false,     // Roll right
            s: false      // Pitch up
        };
        
        // Chase camera settings
        this.cameraSettings = {
            distance: 15,      // Distance behind the spacecraft
            height: 5,         // Height above the spacecraft
            smoothing: 0.1,    // Camera movement smoothing
            zoomSpeed: 1.0,    // Zoom speed
            minDistance: 5,    // Minimum zoom distance
            maxDistance: 30,   // Maximum zoom distance
            // Orbit settings
            horizontalOrbit: 0,   // Horizontal orbit angle in radians (around Y)
            verticalOrbit: 0,     // Vertical orbit angle in radians (around X)
            orbitSpeed: 0.01      // Speed of orbital rotation
        };
        
        // Mouse state for camera control
        this.mouseState = {
            isDragging: false,
            lastX: 0,
            lastY: 0
        };
        
        console.log("Scene initialized");
    }
    
    /**
     * Setup the camera
     */
    setupCamera() {
        const aspectRatio = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
    }
    
    /**
     * Setup the renderer
     */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        
        // Enable logarithmic depth buffer for better depth precision
        this.renderer.logarithmicDepthBuffer = true;
        
        document.body.appendChild(this.renderer.domElement);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    /**
     * Setup basic lighting
     */
    setupLights() {
        // Add ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        // Add directional light to simulate sun
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(10, 10, 10);
        this.scene.add(sunLight);
    }
    
    /**
     * Setup grid and axes helpers
     */
    setupHelpers() {
        // Add some stars in the background
        this.addStars();
        
        // World origin axes helper
        const worldAxisHelper = new THREE.AxesHelper(5); // 5 units long
        this.scene.add(worldAxisHelper);
        
        // Add text labels for each world axis
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
        
        // Create labels for each axis at world origin
        const worldXLabel = createLabel('X', '#ff0000', new THREE.Vector3(5.5, 0, 0));
        const worldYLabel = createLabel('Y', '#00ff00', new THREE.Vector3(0, 5.5, 0));
        const worldZLabel = createLabel('Z', '#0000ff', new THREE.Vector3(0, 0, 5.5));
        
        // Add the labels to the scene
        this.scene.add(worldXLabel);
        this.scene.add(worldYLabel);
        this.scene.add(worldZLabel);
    }
    
    /**
     * Add background stars
     */
    addStars() {
        // Create multiple star layers for parallax effect and better depth
        this.createStarLayer(10000, 0.008, 50000, 0xffffff);  // Distant small stars
        this.createStarLayer(3000, 0.015, 20000, 0xf8f8ff);   // Medium distance stars
        this.createStarLayer(1000, 0.025, 10000, 0xffffff);   // Closer, brighter stars
        this.createStarLayer(100, 0.04, 5000, 0xf0f0ff);      // Few very bright stars
    }
    
    /**
     * Creates a layer of stars
     * @param {number} count - How many stars to create
     * @param {number} size - Size of the stars
     * @param {number} radius - Radius of the distribution sphere
     * @param {number} color - Color of the stars
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
            // Use random points on sphere surface instead of within volume
            // This creates a more even distribution
            const phi = Math.acos(-1 + (2 * Math.random()));
            const theta = 2 * Math.PI * Math.random();
            
            // Spherical to Cartesian conversion
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
        // Mouse down event for camera orbiting
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button
                this.mouseState.isDragging = true;
                this.mouseState.lastX = event.clientX;
                this.mouseState.lastY = event.clientY;
            }
        });
        
        // Mouse move event for camera orbiting
        document.addEventListener('mousemove', (event) => {
            if (this.mouseState.isDragging) {
                // Calculate delta movement
                const deltaX = event.clientX - this.mouseState.lastX;
                const deltaY = event.clientY - this.mouseState.lastY;
                
                // Update orbit angles
                // Reverse the horizontal orbit direction by negating deltaX
                this.cameraSettings.horizontalOrbit -= deltaX * this.cameraSettings.orbitSpeed;
                this.cameraSettings.verticalOrbit += deltaY * this.cameraSettings.orbitSpeed;
                
                // Limit vertical orbit angle to avoid flipping
                this.cameraSettings.verticalOrbit = Math.max(
                    -Math.PI / 2 + 0.1, 
                    Math.min(Math.PI / 2 - 0.1, this.cameraSettings.verticalOrbit)
                );
                
                // Update last position
                this.mouseState.lastX = event.clientX;
                this.mouseState.lastY = event.clientY;
            }
        });
        
        // Mouse up event to end dragging
        document.addEventListener('mouseup', () => {
            this.mouseState.isDragging = false;
        });
        
        // Mouse leave event to end dragging if cursor leaves window
        document.addEventListener('mouseleave', () => {
            this.mouseState.isDragging = false;
        });
        
        // Add wheel event for zooming
        document.addEventListener('wheel', (event) => {
            // Adjust camera distance with mouse wheel
            this.cameraSettings.distance += event.deltaY * 0.01 * this.cameraSettings.zoomSpeed;
            this.cameraSettings.distance = Math.max(
                this.cameraSettings.minDistance, 
                Math.min(this.cameraSettings.maxDistance, this.cameraSettings.distance)
            );
            
            // Prevent default scrolling
            event.preventDefault();
        });
        
        // Add key for resetting camera position
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyR') {
                // Reset camera orbit position
                this.cameraSettings.horizontalOrbit = 0;
                this.cameraSettings.verticalOrbit = 0;
                console.log("Camera position reset");
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
        const key = event.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = true;
        }
        
        // Handle space bar separately
        if (event.code === 'Space') {
            this.keys.space = true;
            
            // Apply thrust if spacebar is pressed
            if (this.spacecraft) {
                this.spacecraft.applyThrust(true);
                document.getElementById('thrust-status').textContent = 'ON';
            }
        }
    }
    
    /**
     * Handle key up events
     */
    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = false;
        }
        
        // Handle space bar separately
        if (event.code === 'Space') {
            this.keys.space = false;
            
            // Stop thrust if spacebar is released
            if (this.spacecraft) {
                this.spacecraft.applyThrust(false);
                document.getElementById('thrust-status').textContent = 'OFF';
            }
        }
    }
    
    /**
     * Add the spacecraft to the scene
     * @param {Spacecraft} spacecraft The spacecraft object
     */
    addSpacecraft(spacecraft) {
        this.spacecraft = spacecraft;
        this.scene.add(spacecraft.mesh);
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
        
        // Schedule the next animation frame
        requestAnimationFrame(this.animate.bind(this));
        
        // Calculate time since last frame
        const deltaTime = this.clock.getDelta();
        
        // Process inputs
        this.processInput(deltaTime);
        
        // Update physics
        this.updatePhysics(deltaTime);
        
        // Update the camera
        this.updateCamera(deltaTime);
        
        // Update display values
        this.updateDisplay();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Update physics simulation
     * @param {number} deltaTime Time delta since last frame (seconds)
     */
    updatePhysics(deltaTime) {
        // Update planet rotation if exists
        if (this.planet) {
            this.planet.update(deltaTime);
        }
        
        // Skip if spacecraft doesn't exist
        if (!this.spacecraft) return;
        
        // Debug first few frames
        if (this._frameCounter === undefined) {
            this._frameCounter = 0;
        }
        
        if (this._frameCounter < 5) {
            console.log(`[Frame ${this._frameCounter}] DEBUG: Spacecraft position: `, 
                this.spacecraft.position.x.toFixed(4), 
                this.spacecraft.position.y.toFixed(4), 
                this.spacecraft.position.z.toFixed(4));
            console.log(`[Frame ${this._frameCounter}] DEBUG: Spacecraft velocity: `, 
                this.spacecraft.velocity.x.toFixed(4), 
                this.spacecraft.velocity.y.toFixed(4), 
                this.spacecraft.velocity.z.toFixed(4));
                
            // Check distance to planet
            if (this.planet) {
                const distanceVector = this.spacecraft.position.clone().sub(this.planet.mesh.position);
                const distance = distanceVector.length();
                console.log(`[Frame ${this._frameCounter}] DEBUG: Distance to planet center: ${distance.toFixed(4)}`);
                console.log(`[Frame ${this._frameCounter}] DEBUG: Planet radius: ${this.planet.radius.toFixed(4)}`);
                if (distance < this.planet.radius) {
                    console.warn(`[Frame ${this._frameCounter}] WARNING: Spacecraft inside planet! distance=${distance.toFixed(4)}, radius=${this.planet.radius.toFixed(4)}`);
                }
            }
            
            this._frameCounter++;
        }
        
        // Apply gravitational forces from planet if exists
        if (this.planet) {
            // Get scale manager for physics calculations
            const scaleManager = window.scaleManager;
            
            if (!scaleManager) {
                console.error("ScaleManager not found. Physics calculations may be inaccurate.");
                return;
            }
            
            // Calculate gravitational force using real-world distances
            // Get current spacecraft position in visualization space
            const spacecraftVisualPos = this.spacecraft.position.clone();
            const planetVisualPos = this.planet.mesh.position.clone();
            
            // Convert to real-world space for physics calculations
            const spacecraftRealPos = scaleManager.vectorToRealWorld(spacecraftVisualPos);
            const planetRealPos = scaleManager.vectorToRealWorld(planetVisualPos);
            
            // Calculate distance to planet center
            const distanceVector = spacecraftVisualPos.clone().sub(planetVisualPos);
            const distance = distanceVector.length();
            
            // Check for collision with planet and prevent it
            if (distance < this.planet.radius) {
                console.warn(`Spacecraft collision with planet detected! Distance: ${distance.toFixed(2)}, Planet radius: ${this.planet.radius.toFixed(2)}`);
                
                // Move spacecraft to surface of planet
                const newPosition = distanceVector.normalize().multiplyScalar(this.planet.radius * 1.01).add(planetVisualPos);
                this.spacecraft.setPosition(newPosition);
                
                // Reflect velocity to simulate bounce
                const normal = distanceVector.normalize();
                const reflectedVelocity = this.spacecraft.velocity.clone()
                    .sub(normal.multiplyScalar(2 * this.spacecraft.velocity.dot(normal)))
                    .multiplyScalar(0.8); // Dampen velocity
                
                this.spacecraft.setVelocity(reflectedVelocity);
                
                // Skip further physics for this frame
                return;
            }
            
            // Calculate gravitational force in real-world units
            const realForce = this.planet.calculateGravitationalForce(
                spacecraftRealPos,
                this.spacecraft.mass
            );
            
            // Convert force back to visualization space
            const visualForce = scaleManager.vectorToVisualizationSpace(realForce);
            
            // Apply force to spacecraft (F=ma, so a=F/m)
            const acceleration = visualForce.divideScalar(this.spacecraft.mass);
            
            // Apply acceleration to velocity (v = v0 + at)
            this.spacecraft.velocity.add(acceleration.multiplyScalar(deltaTime));
        }
        
        // Update spacecraft physics
        this.spacecraft.update(deltaTime);
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
        
        // Rotation controls using persistent physics
        
        // Pitch: W/S (down/up) - REVERSED
        if (this.keys.w) {
            this.spacecraft.rotate('pitch', 1); // Nose up (reversed)
        }
        if (this.keys.s) {
            this.spacecraft.rotate('pitch', -1); // Nose down (reversed)
        }
        
        // Yaw: A/D (left/right) - REVERSED
        if (this.keys.a) {
            this.spacecraft.rotate('yaw', 1); // Nose right (reversed)
        }
        if (this.keys.d) {
            this.spacecraft.rotate('yaw', -1); // Nose left (reversed)
        }
        
        // Roll: Q/E (left/right)
        if (this.keys.q) {
            this.spacecraft.rotate('roll', -1); // Roll left
        }
        if (this.keys.e) {
            this.spacecraft.rotate('roll', 1); // Roll right
        }
    }
    
    /**
     * Update the camera
     * @param {number} deltaTime Time delta since last frame (seconds)
     */
    updateCamera(deltaTime) {
        if (!this.spacecraft) return;
        
        // Get spacecraft position and orientation
        const spacecraftPos = this.spacecraft.position.clone();
        
        // Start with the base offset behind the spacecraft
        const baseOffset = new THREE.Vector3(0, this.cameraSettings.height, -this.cameraSettings.distance);
        
        // Apply orbit rotations to the offset
        // First rotate around X axis (vertical orbit)
        baseOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraSettings.verticalOrbit);
        
        // Then rotate around Y axis (horizontal orbit)
        baseOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraSettings.horizontalOrbit);
        
        // Now apply the spacecraft's rotation to the orbited offset
        const worldOffset = baseOffset.clone().applyQuaternion(this.spacecraft.mesh.quaternion);
        
        // Calculate final camera position
        const cameraPosition = spacecraftPos.clone().add(worldOffset);
        
        // Set camera position directly without interpolation for rigid attachment
        this.camera.position.copy(cameraPosition);
        
        // Apply the spacecraft's rotation to the camera's up vector
        // This ensures roll is properly represented
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
        if (!this.planet || !this.spacecraft) {
            console.log("DEBUG: calculateOrbitalParameters - planet or spacecraft not available");
            return null;
        }
        
        // Get scale manager for physics calculations
        const scaleManager = window.scaleManager;
        
        if (!scaleManager) {
            console.error("ScaleManager not found. Orbital calculations may be inaccurate.");
            return null;
        }
        
        // Get gravitational parameter (GM)
        const mu = this.planet.G * this.planet.mass;
        
        // Get real-world position and velocity of spacecraft relative to planet
        const scaledPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
        const realPosition = scaleManager.vectorToRealWorld(scaledPosition);
        
        const realVelocity = scaleManager.vectorToRealWorld(this.spacecraft.velocity);
        
        console.log("DEBUG: calculateOrbitalParameters inputs:");
        console.log("  Scaled position:", scaledPosition.x.toFixed(2), scaledPosition.y.toFixed(2), scaledPosition.z.toFixed(2));
        console.log("  Real position:", realPosition.x.toFixed(2), realPosition.y.toFixed(2), realPosition.z.toFixed(2));
        console.log("  Real velocity:", realVelocity.x.toFixed(2), realVelocity.y.toFixed(2), realVelocity.z.toFixed(2));
        console.log("  Gravitational parameter (mu):", mu);
        
        // Calculate orbital elements
        
        // Step 1: Calculate the specific angular momentum vector (h = r × v)
        const h = new THREE.Vector3().crossVectors(realPosition, realVelocity);
        const hMagnitude = h.length();
        
        // Step 2: Calculate the eccentricity vector
        // e = ((v × h) / μ) - (r / |r|)
        const vCrossH = new THREE.Vector3().crossVectors(realVelocity, h);
        const eccentricityVector = vCrossH.divideScalar(mu).sub(
            realPosition.clone().normalize()
        );
        
        const eccentricity = eccentricityVector.length();
        
        // Step 3: Calculate the semi-major axis
        // a = h² / (μ * (1 - e²))
        const r = realPosition.length();
        const v = realVelocity.length();
        
        // Alternative calculation using orbit energy equation
        // a = -μ / (2 * ε), where ε = v²/2 - μ/r
        const energy = (v * v / 2) - (mu / r);
        let semiMajorAxis;
        
        // For near-circular orbits, use standard equation
        if (Math.abs(eccentricity) < 0.0001) {
            semiMajorAxis = r;
        } 
        // For elliptical orbits, use energy equation
        else if (energy < 0) {
            semiMajorAxis = -mu / (2 * energy);
        } 
        // For parabolic/hyperbolic orbits (not typical for orbital spacecraft)
        else {
            semiMajorAxis = Math.abs(hMagnitude * hMagnitude / (mu * (1 - eccentricity * eccentricity)));
        }
        
        // Step 4: Calculate periapsis and apoapsis
        const periapsis = semiMajorAxis * (1 - eccentricity);
        const apoapsis = eccentricity < 1 ? semiMajorAxis * (1 + eccentricity) : Infinity;
        
        // Step 5: Calculate orbital period (only meaningful for elliptical orbits)
        let orbitalPeriod = 0;
        if (eccentricity < 1) {
            orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
        }
        
        console.log("DEBUG: calculateOrbitalParameters results:");
        console.log("  h magnitude:", hMagnitude);
        console.log("  Eccentricity:", eccentricity);
        console.log("  Semi-major axis:", semiMajorAxis);
        console.log("  Periapsis:", periapsis);
        console.log("  Apoapsis:", apoapsis);
        console.log("  Orbital period:", orbitalPeriod);
        
        // Return orbital parameters
        return {
            eccentricity: eccentricity,
            semiMajorAxis: semiMajorAxis,
            periapsis: periapsis, // perigee for Earth
            apoapsis: apoapsis,   // apogee for Earth
            orbitalPeriod: orbitalPeriod, // in seconds
            // Additional parameters
            specificAngularMomentum: hMagnitude,
            position: r,
            velocity: v
        };
    }
    
    /**
     * Update the display with current physics data
     */
    updateDisplay() {
        if (!this.spacecraft) {
            console.log("DEBUG: updateDisplay - spacecraft not available");
            return;
        }
        
        // Get scale manager for converting display values
        const scaleManager = window.scaleManager;
        
        if (!scaleManager) {
            console.warn("ScaleManager not found. Display values may be inaccurate.");
            return;
        }
        
        // Update velocity display
        const velocity = document.getElementById('velocity');
        if (velocity) {
            // Convert scaled velocity to real-world velocity
            const realVelocity = scaleManager.velocityToRealWorld(this.spacecraft.velocity.length());
            velocity.textContent = realVelocity.toFixed(2);
        } else {
            console.log("DEBUG: velocity element not found");
        }
        
        // Update orientation display
        const orientation = document.getElementById('orientation');
        if (orientation) {
            // Extract Euler angles from quaternion
            const euler = new THREE.Euler().setFromQuaternion(this.spacecraft.mesh.quaternion);
            const pitch = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
            const yaw = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
            const roll = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
            orientation.textContent = `P: ${pitch}° Y: ${yaw}° R: ${roll}°`;
        } else {
            console.log("DEBUG: orientation element not found");
        }
        
        // Update thrust status
        const thrustStatus = document.getElementById('thrust-status');
        if (thrustStatus) {
            thrustStatus.textContent = this.spacecraft.isThrusting ? 'ON' : 'OFF';
        } else {
            console.log("DEBUG: thrust-status element not found");
        }
        
        // Update altitude display
        const altitude = document.getElementById('altitude');
        if (altitude && this.planet) {
            // Calculate distance from planet center to spacecraft
            const distanceVector = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            const distance = distanceVector.length();
            
            // Convert to real-world distance
            const realDistance = scaleManager.toRealWorld(distance);
            
            // Calculate altitude (distance minus planet radius)
            const realAltitude = realDistance - scaleManager.toRealWorld(this.planet.radius);
            
            // Convert to kilometers for display
            const altitudeKm = realAltitude / 1000;
            altitude.textContent = altitudeKm.toFixed(2);
        } else {
            console.log("DEBUG: altitude element not found or planet not available");
        }
        
        // Update orbital parameters display
        const orbit = this.calculateOrbitalParameters();
        if (orbit) {
            // Update apogee (km) - match HTML element ID
            const apogee = document.getElementById('apogee');
            if (apogee) {
                // Calculate apogee as altitude above surface (subtract planet radius)
                const planetRadiusKm = scaleManager.toRealWorld(this.planet.radius) / 1000;
                const apogeeAltitudeKm = orbit.apoapsis / 1000 - planetRadiusKm;
                apogee.textContent = apogeeAltitudeKm.toFixed(2);
            } else {
                console.log("DEBUG: apogee element not found");
            }
            
            // Update perigee (km) - match HTML element ID
            const perigee = document.getElementById('perigee');
            if (perigee) {
                // Calculate perigee as altitude above surface (subtract planet radius)
                const planetRadiusKm = scaleManager.toRealWorld(this.planet.radius) / 1000;
                const perigeeAltitudeKm = orbit.periapsis / 1000 - planetRadiusKm;
                perigee.textContent = perigeeAltitudeKm.toFixed(2);
            } else {
                console.log("DEBUG: perigee element not found");
            }
            
            // Update eccentricity
            const eccentricity = document.getElementById('eccentricity');
            if (eccentricity) {
                eccentricity.textContent = orbit.eccentricity.toFixed(6);
            } else {
                console.log("DEBUG: eccentricity element not found");
            }
            
            // Update orbital period (min) - match HTML element ID
            const orbitalPeriod = document.getElementById('orbital-period');
            if (orbitalPeriod) {
                // Convert from seconds to minutes for display
                const periodMinutes = orbit.orbitalPeriod / 60;
                orbitalPeriod.textContent = periodMinutes.toFixed(2);
            } else {
                console.log("DEBUG: orbital-period element not found");
            }
            
            // Update semi-major axis (km)
            const semiMajorAxis = document.getElementById('semi-major-axis');
            if (semiMajorAxis) {
                const semiMajorAxisKm = orbit.semiMajorAxis / 1000;
                semiMajorAxis.textContent = semiMajorAxisKm.toFixed(2);
            } else {
                console.log("DEBUG: semi-major-axis element not found");
            }
        } else {
            console.log("DEBUG: No orbital parameters available");
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
}
