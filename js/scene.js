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
        this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
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
        // Grid - horizontal in XZ plane
        const gridHelper = new THREE.GridHelper(100, 10);
        // Default GridHelper is in XZ plane (y=0), so no rotation needed
        this.scene.add(gridHelper);
        
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
        
        // Add some stars in the background
        this.addStars();
    }
    
    /**
     * Add background stars
     */
    addStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1
        });
        
        const starsVertices = [];
        for (let i = 0; i < 1000; i++) {
            const x = THREE.MathUtils.randFloatSpread(100);
            const y = THREE.MathUtils.randFloatSpread(100);
            const z = THREE.MathUtils.randFloatSpread(100);
            
            // Keep stars away from the center
            if (Math.sqrt(x*x + y*y + z*z) < 20) continue;
            
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
     * Update the scene
     */
    update() {
        if (!this.isRunning) return;
        
        // Calculate delta time in seconds
        const deltaTime = this.clock.getDelta();
        
        // Process input
        this.processInput(deltaTime);
        
        // Update spacecraft
        if (this.spacecraft) {
            this.spacecraft.update(deltaTime);
        }
        
        // Update camera position
        this.updateCamera();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Request next frame
        requestAnimationFrame(() => this.update());
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
     * Add the spacecraft to the scene
     */
    addSpacecraft(spacecraft) {
        this.spacecraft = spacecraft;
        this.scene.add(spacecraft.mesh);
        
        // Position the camera to look at the spacecraft
        this.camera.lookAt(spacecraft.position);
    }
    
    /**
     * Update camera position to follow spacecraft
     */
    updateCamera() {
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
     * Update the UI with current spacecraft data
     */
    updateUI() {
        if (!this.spacecraft) return;
        
        // Update velocity
        document.getElementById('velocity').textContent = this.spacecraft.getSpeed().toFixed(2);
        
        // Update orientation
        const orientation = this.spacecraft.getOrientation();
        document.getElementById('orientation').textContent = 
            `${orientation.x}, ${orientation.y}, ${orientation.z}`;
    }
    
    /**
     * Start the animation loop
     */
    start() {
        this.isRunning = true;
        this.clock.start();
        this.update();
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        this.isRunning = false;
        this.clock.stop();
    }
}
