/**
 * Main entry point for the spacecraft simulator
 */

// Global references
let gameScene;
let spacecraft;

// Initialize the application
function init() {
    console.log("Initializing spacecraft simulator...");
    
    // Create the scene
    gameScene = new Scene();
    console.log("Scene created");
    
    // Create spacecraft
    spacecraft = new Spacecraft();
    console.log("Spacecraft created");
    
    // Add spacecraft to scene
    gameScene.addSpacecraft(spacecraft);
    console.log("Spacecraft added to scene");
    
    // Start the animation loop
    gameScene.start();
    console.log("Animation started");
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Log any errors
window.addEventListener('error', function(e) {
    console.error("Runtime error:", e.message);
    console.error("At", e.filename, ":", e.lineno);
});
