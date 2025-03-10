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
        // Create a large sphere for the starfield background
        const starfieldRadius = 100000;
        const starfieldGeometry = new THREE.SphereGeometry(starfieldRadius, 32, 32);
        
        // Create stars texture procedurally
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const context = canvas.getContext('2d');
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add stars of varying brightness
        for (let i = 0; i < 10000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 1.2;
            
            // Random brightness for stars
            const brightness = Math.random() * 100 + 50;
            context.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 1)`;
            
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
        }
        
        // Create texture from canvas
        const starfieldTexture = new THREE.CanvasTexture(canvas);
        
        // Use basic material with the texture on the inside of the sphere
        const starfieldMaterial = new THREE.MeshBasicMaterial({
            map: starfieldTexture,
            side: THREE.BackSide // Render on the inside of the sphere
        });
        
        // Create the mesh and add to scene
        const starfieldMesh = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
        this.scene.add(starfieldMesh);
        
        // Also add some closer, brighter stars as points
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.01
        });
        
        const starsVertices = [];
        for (let i = 0; i < 1000; i++) {
            const x = THREE.MathUtils.randFloatSpread(1000);
            const y = THREE.MathUtils.randFloatSpread(1000);
            const z = THREE.MathUtils.randFloatSpread(1000);
            
            // Keep stars away from the center
            if (Math.sqrt(x*x + y*y + z*z) < 50) continue;
            
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
        
        // Apply gravitational forces from planet if exists
        if (this.planet) {
            // Get scale factor from main.js for physics calculations
            const SCALE_FACTOR = window.SCALE_FACTOR || 0.001;
            
            // Calculate gravitational force - using unscaled distance for physics
            const scaledDistanceVector = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            const scaledDistance = scaledDistanceVector.length();
            
            // Convert to real-world distance for physics calculations
            const realDistance = scaledDistance / SCALE_FACTOR;
            const realDistanceVector = scaledDistanceVector.clone().normalize().multiplyScalar(realDistance);
            
            // Calculate gravitational force using real-world values
            const gravity = this.planet.calculateGravitationalForce(
                this.planet.mesh.position.clone().add(realDistanceVector),
                this.spacecraft.mass
            );
            
            // Scale the force back down for visualization
            gravity.multiplyScalar(SCALE_FACTOR);
            
            // Convert force to acceleration (F = ma, so a = F/m)
            const acceleration = gravity.divideScalar(this.spacecraft.mass);
            
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
        if (!this.planet || !this.spacecraft) return null;
        
        // Get scale factor for physics calculations
        const SCALE_FACTOR = window.SCALE_FACTOR || 0.001;
        
        // Get gravitational parameter (GM)
        const mu = this.planet.G * this.planet.mass;
        
        // Get real-world position and velocity of spacecraft relative to planet
        const scaledPosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
        const realPosition = scaledPosition.clone().multiplyScalar(1/SCALE_FACTOR);
        
        const realVelocity = this.spacecraft.velocity.clone().multiplyScalar(1/SCALE_FACTOR);
        
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
        if (!this.spacecraft) return;
        
        // Scale factor for converting display values
        const SCALE_FACTOR = window.SCALE_FACTOR || 0.001;
        
        // Update velocity display
        const velocity = document.getElementById('velocity');
        if (velocity) {
            // Convert scaled velocity to real-world velocity
            const realVelocity = this.spacecraft.velocity.length() / SCALE_FACTOR;
            velocity.textContent = realVelocity.toFixed(2);
        }
        
        // Update orientation display
        const orientation = document.getElementById('orientation');
        if (orientation) {
            // Extract Euler angles from quaternion
            const euler = new THREE.Euler().setFromQuaternion(this.spacecraft.mesh.quaternion);
            orientation.textContent = 
                `${(euler.x * 180 / Math.PI).toFixed(1)}°, ` +
                `${(euler.y * 180 / Math.PI).toFixed(1)}°, ` +
                `${(euler.z * 180 / Math.PI).toFixed(1)}°`;
        }
        
        // Update thrust status
        const thrustStatus = document.getElementById('thrust-status');
        if (thrustStatus) {
            thrustStatus.textContent = this.spacecraft.isThrusting ? 'ON' : 'OFF';
        }
        
        // If we have a planet, show orbital information
        if (this.planet && this.spacecraft) {
            const scaledDistanceVector = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            const scaledDistance = scaledDistanceVector.length();
            
            // Convert to real-world values
            const realDistance = scaledDistance / SCALE_FACTOR;
            const realAltitude = realDistance - (this.planet.radius / SCALE_FACTOR);
            
            // Update altitude display if element exists
            const altitudeElement = document.getElementById('altitude');
            if (altitudeElement) {
                // Convert to km for display
                altitudeElement.textContent = (realAltitude / 1000).toFixed(1);
            }
            
            // Calculate orbital parameters and update displays
            const orbitalParams = this.calculateOrbitalParameters();
            if (orbitalParams) {
                // Update perigee (km)
                const perigeeElement = document.getElementById('perigee');
                if (perigeeElement) {
                    perigeeElement.textContent = ((orbitalParams.periapsis - this.planet.radius/SCALE_FACTOR) / 1000).toFixed(1);
                }
                
                // Update apogee (km)
                const apogeeElement = document.getElementById('apogee');
                if (apogeeElement) {
                    if (orbitalParams.apoapsis === Infinity) {
                        apogeeElement.textContent = "Escape";
                    } else {
                        apogeeElement.textContent = ((orbitalParams.apoapsis - this.planet.radius/SCALE_FACTOR) / 1000).toFixed(1);
                    }
                }
                
                // Update eccentricity
                const eccentricityElement = document.getElementById('eccentricity');
                if (eccentricityElement) {
                    eccentricityElement.textContent = orbitalParams.eccentricity.toFixed(3);
                }
                
                // Update orbital period (min)
                const periodElement = document.getElementById('orbital-period');
                if (periodElement) {
                    if (orbitalParams.eccentricity < 1) {
                        // Convert from seconds to minutes
                        periodElement.textContent = (orbitalParams.orbitalPeriod / 60).toFixed(1);
                    } else {
                        periodElement.textContent = "N/A";
                    }
                }
                
                // Update semi-major axis (km)
                const semiMajorElement = document.getElementById('semi-major-axis');
                if (semiMajorElement) {
                    semiMajorElement.textContent = (orbitalParams.semiMajorAxis / 1000).toFixed(1);
                }
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
}
