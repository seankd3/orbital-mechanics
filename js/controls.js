/**
 * Controls class - handles user input and spacecraft control
 */
class Controls {
    constructor() {
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
        
        // References
        this.spacecraft = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log("Controls system initialized");
    }
    
    /**
     * Set the spacecraft reference
     * @param {Spacecraft} spacecraft The spacecraft to control
     */
    setSpacecraft(spacecraft) {
        this.spacecraft = spacecraft;
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
                this.spacecraft.setThrust(true);
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
                this.spacecraft.setThrust(false);
                document.getElementById('thrust-status').textContent = 'OFF';
            }
        }
    }
    
    /**
     * Process keyboard input
     * @param {number} deltaTime Time delta since last frame (seconds)
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
}
