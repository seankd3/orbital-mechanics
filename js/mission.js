/**
 * ApolloMission - KSP/MechJeb-style mission layer for the Apollo sim.
 *
 * This module deliberately lives beside the maneuver-node system. It owns
 * staging, vehicle switching, body/SOI context, and simple autopilot assists
 * without rewriting the node editor another agent may be touching.
 */
class ApolloMission {
    constructor(scene, spacecraft, earth, scaleManager) {
        this.scene = scene;
        this.spacecraft = spacecraft;
        this.earth = earth;
        this.scaleManager = scaleManager;
        this.primaryBody = earth;
        this.missionTime = 0;
        this.phase = 'PARKING';
        this.guidance = null;
        this.assistOwner = null;
        this.holdMode = null;
        this.burn = null;
        this.logs = [];
        this.padState = null;
        this.metRunning = false;
        this.telemetryRecorder = window.ApolloTelemetryRecorder ?
            new window.ApolloTelemetryRecorder({ maxSamples: 7200 }) :
            null;
        this._lastTelemetrySampleTime = -Infinity;

        this.moonOrbitRadius = 384400000;
        this.moonPeriod = 27.321661 * 86400;
        this.moonAngle = THREE.MathUtils.degToRad(54);
        this.cape = { lat: 28.608, lon: -80.604 };

        this.scene.mission = this;
        this.scene.primaryBody = this.primaryBody;
        this.scene.timeWarp.available = [1, 2, 5, 10, 50, 100, 1000, 5000, 10000];
        this.scene.mapSettings.maxZoom = 900000;

        this.createMoon();
        this.createMissionPanel();
        this.setParkingOrbit({ log: false });
        this.log('ORBIT OPS READY');
    }

    createMoon() {
        const moonRadius = this.scaleManager.toVisualizationSpace(1737400);
        this.moon = new Planet({
            name: 'Moon',
            radius: moonRadius,
            mass: 7.342e22,
            rotationPeriod: this.moonPeriod,
            showGrid: false,
            showCoastlines: false,
            lineColor: 0xaaaaaa,
            gridOpacity: 0.28,
            craterColor: 0xb8b8b8,
            craterOpacity: 0.58,
            soiRadius: 66100000,
            craters: [
                { lat: 8, lon: 31, radiusDeg: 3.4 },
                { lat: -24, lon: -22, radiusDeg: 4.8 },
                { lat: -58, lon: -14, radiusDeg: 5.6 },
                { lat: 26, lon: -3, radiusDeg: 2.8 },
                { lat: -5, lon: 17, radiusDeg: 2.2 },
                { lat: 42, lon: 51, radiusDeg: 3.1 },
                { lat: -17, lon: 84, radiusDeg: 4.1 },
                { lat: 11, lon: -46, radiusDeg: 2.5 }
            ]
        });

        this.updateMoonPosition(0);
        this.scene.moon = this.moon;
        this.scene.scene.add(this.moon.mesh);
        this.createMoonOrbitLine();
    }

    createMoonOrbitLine() {
        const points = [];
        const radius = this.scaleManager.toVisualizationSpace(this.moonOrbitRadius);
        for (let i = 0; i <= 360; i++) {
            const a1 = (i / 360) * Math.PI * 2;
            const a2 = ((i + 1) / 360) * Math.PI * 2;
            points.push(
                new THREE.Vector3(Math.cos(a1) * radius, 0, -Math.sin(a1) * radius),
                new THREE.Vector3(Math.cos(a2) * radius, 0, -Math.sin(a2) * radius)
            );
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x6fa979,
            transparent: true,
            opacity: 0.42,
            depthWrite: false
        });
        this.moonOrbitLine = new THREE.LineSegments(geometry, material);
        this.scene.scene.add(this.moonOrbitLine);
    }

    createMissionPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'mission-panel';
        this.panel.innerHTML = `
            <div class="mission-title">
                <span>[ APOLLO ORBIT OPS ]</span>
                <span class="mission-mode">ORBIT-FIRST</span>
            </div>
            <div class="mission-summary">
                <div><span>Phase</span><strong data-mission="phase">PARKING</strong></div>
                <div><span>Body</span><strong data-mission="body">EARTH</strong></div>
                <div><span>Craft</span><strong data-mission="vehicle">CSM+LM</strong></div>
                <div><span>Assist</span><strong data-mission="guidance">IDLE</strong></div>
            </div>
            <div class="mission-readouts">
                <div><span>MET</span><span data-mission="met">000:00:00</span></div>
                <div><span>Orbit</span><span data-mission="orbit-status">--</span></div>
                <div><span>AP</span><span data-mission="ap">--</span></div>
                <div><span>PE</span><span data-mission="pe">--</span></div>
                <div><span>To AP</span><span data-mission="tta">--</span></div>
                <div><span>To PE</span><span data-mission="ttp">--</span></div>
                <div><span>TLI</span><span data-mission="tli-dv">--</span></div>
                <div><span>Circ</span><span data-mission="circ-dv">--</span></div>
                <div><span>Moon</span><span data-mission="range">--</span></div>
            </div>
            <div class="mission-action-groups">
                <div class="mission-action-group">
                    <span>Checkpoint</span>
                    <button type="button" data-apollo="park" title="Reset to Earth parking orbit">Earth</button>
                    <button type="button" data-apollo="lunar-orbit" title="Reset to low lunar orbit">Moon</button>
                    <button type="button" data-apollo="pad" title="Return to the Saturn V pad checkpoint">Pad</button>
                </div>
                <div class="mission-action-group">
                    <span>Attitude</span>
                    <button type="button" data-apollo="hold-prograde" title="Hold prograde">Pro</button>
                    <button type="button" data-apollo="hold-retrograde" title="Hold retrograde">Retro</button>
                    <button type="button" data-apollo="hold-radial" title="Hold radial out">Rad+</button>
                    <button type="button" data-apollo="hold-radial-in" title="Hold radial in">Rad-</button>
                    <button type="button" data-apollo="hold-normal" title="Hold normal">Norm+</button>
                    <button type="button" data-apollo="hold-antinormal" title="Hold anti-normal">Norm-</button>
                </div>
                <div class="mission-action-group">
                    <span>Burns</span>
                    <button type="button" data-apollo="tli" title="Trans-lunar injection burn">TLI</button>
                    <button type="button" data-apollo="circularize" title="Circularize the current orbit">Circ</button>
                    <button type="button" data-apollo="loi" title="Lunar orbit insertion burn">LOI</button>
                    <button type="button" data-apollo="pdi" title="Powered descent initiation burn">PDI</button>
                    <button type="button" data-apollo="tei" title="Trans-Earth injection burn">TEI</button>
                </div>
                <div class="mission-action-group">
                    <span>Vehicle</span>
                    <button type="button" data-apollo="dock" title="Set docked CSM and LM state">Dock</button>
                    <button type="button" data-apollo="lm" title="Activate LM descent stage">LM</button>
                    <button type="button" data-apollo="ascent" title="Activate LM ascent stage">Ascent</button>
                    <button type="button" data-apollo="csm" title="Activate CSM">CSM</button>
                    <button type="button" data-apollo="off" title="Cancel mission guidance">Off</button>
                </div>
            </div>
            <div class="mission-log" data-mission="log"></div>
        `;
        document.body.appendChild(this.panel);

        this.panel.querySelectorAll('[data-apollo]').forEach((button) => {
            button.addEventListener('click', () => this.handleCommand(button.dataset.apollo));
        });
    }

    handleCommand(command) {
        switch (command) {
            case 'launch':
                this.startLaunch();
                break;
            case 'stage':
                this.stage();
                break;
            case 'park':
                this.setParkingOrbit();
                break;
            case 'lunar-orbit':
                this.setLunarOrbit();
                break;
            case 'pad':
                this.resetToLaunchPad();
                break;
            case 'hold-prograde':
                this.setHold('prograde');
                break;
            case 'hold-retrograde':
                this.setHold('retrograde');
                break;
            case 'hold-radial':
                this.setHold('radialOut');
                break;
            case 'hold-radial-in':
                this.setHold('radialIn');
                break;
            case 'hold-normal':
                this.setHold('normal');
                break;
            case 'hold-antinormal':
                this.setHold('antiNormal');
                break;
            case 'tli':
                this.startTliBurn();
                break;
            case 'circularize':
                this.startCircularizeBurn();
                break;
            case 'dock':
                this.transpositionDock();
                break;
            case 'loi':
                this.startFixedBurn('retrograde', 900, 'LOI');
                break;
            case 'lm':
                this.activateLM();
                break;
            case 'pdi':
                this.startFixedBurn('retrograde', 420, 'PDI');
                break;
            case 'ascent':
                this.activateLMAscent();
                break;
            case 'tei':
                this.startFixedBurn('prograde', 1000, 'TEI');
                break;
            case 'csm':
                this.activateCSM();
                break;
            case 'off':
                this.clearGuidance();
                break;
        }
    }

    prePhysics(deltaTime) {
        const warpedDeltaTime = deltaTime * this.scene.timeWarp.factor;
        if (this.metRunning) {
            this.missionTime += warpedDeltaTime;
        }

        if (this.scene.planet !== this.earth) {
            this.earth.update(warpedDeltaTime);
        }

        this.updateMoonPosition(warpedDeltaTime);
        this.updatePrimaryBody();
        if (this.primaryBody === this.moon && this.scene.timeWarp.factor > 1) {
            this.setWarp(1);
        }
        if (this.isPadHoldActive()) {
            this.holdOnPad();
            return;
        }
        this.updateGuidance(deltaTime, warpedDeltaTime);
    }

    postPhysics() {
        this.updateBurnProgress();
        if (this.isPadHoldActive()) {
            this.holdOnPad();
        }
        if (this.isLaunchDisplayActive()) {
            this.setLaunchDisplayMode(true);
        }
        this.recordTelemetrySample();
        this.updateTelemetry();
    }

    recordTelemetrySample() {
        if (!this.telemetryRecorder) return;
        if (this.missionTime - this._lastTelemetrySampleTime < 1) return;

        this.telemetryRecorder.record(this.scene, this, this.spacecraft);
        this._lastTelemetrySampleTime = this.missionTime;
    }

    updateMoonPosition(deltaTime) {
        const meanMotion = (Math.PI * 2) / this.moonPeriod;
        this.moonAngle = (this.moonAngle + meanMotion * deltaTime) % (Math.PI * 2);

        const realPosition = new THREE.Vector3(
            Math.cos(this.moonAngle) * this.moonOrbitRadius,
            0,
            -Math.sin(this.moonAngle) * this.moonOrbitRadius
        );
        const realVelocity = new THREE.Vector3(
            -Math.sin(this.moonAngle) * this.moonOrbitRadius * meanMotion,
            0,
            -Math.cos(this.moonAngle) * this.moonOrbitRadius * meanMotion
        );

        this.moon.mesh.position.copy(this.scaleManager.vectorToVisualizationSpace(realPosition));
        this.moon.velocity.copy(this.scaleManager.vectorToVisualizationSpace(realVelocity));
    }

    updatePrimaryBody() {
        if (!this.spacecraft || !this.moon) return;

        const moonRange = this.scaleManager.toRealWorld(
            this.spacecraft.position.distanceTo(this.moon.mesh.position)
        );
        const nextBody = moonRange < this.moon.soiRadius ? this.moon : this.earth;

        if (nextBody !== this.primaryBody) {
            this.primaryBody = nextBody;
            this.scene.planet = nextBody;
            this.scene.primaryBody = nextBody;
            this.scene.createOrbitalTrajectory();
            this.log((nextBody === this.moon ? 'LUNAR' : 'EARTH') + ' SOI');
            this.setWarp(1);
        }
    }

    updateGuidance(deltaTime, warpedDeltaTime) {
        if (!this.guidance) return;

        if (this.guidance.type === 'launch') {
            this.guidance.elapsed += warpedDeltaTime;
            this.updateLaunchGuidance(deltaTime);
            return;
        }

        if (this.guidance.type === 'hold') {
            this.holdAttitude(this.guidance.mode, deltaTime);
            return;
        }

        if (this.guidance.type === 'burn') {
            this.holdAttitude(this.guidance.mode, deltaTime);
            this.burn.massBefore = this.spacecraft.getCurrentMass();
            this.spacecraft.setThrust(true);
        }
    }

    updateLaunchGuidance(deltaTime) {
        const body = this.earth;
        const radial = this.spacecraft.position.clone().sub(body.mesh.position).normalize();
        const east = this.getEastVector(radial);
        const pitch = THREE.MathUtils.clamp((this.guidance.elapsed - 12) / 330, 0, 1) * THREE.MathUtils.degToRad(82);
        const target = radial.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(east, Math.sin(pitch)).normalize();

        this.orientForwardTo(target, deltaTime, 1.1);
        this.spacecraft.setThrust(true);

        const stage = this.spacecraft.getActiveStage ? this.spacecraft.getActiveStage() : null;
        if (stage && stage.propellant <= 1) {
            this.stage({ preserveGuidance: true });
        }

        const orbit = this.computeOrbit(this.earth);
        const earthRadius = this.scaleManager.toRealWorld(this.earth.radius);
        if (orbit && orbit.apoapsis - earthRadius > 185000 && this.spacecraft.vehicleMode === 'saturn-v') {
            this.phase = 'PARKING';
            this.setLaunchDisplayMode(false);
        }
    }

    updateBurnProgress() {
        if (!this.burn || !this.spacecraft || this.burn.massBefore === null) return;

        const massBefore = this.burn.massBefore;
        const massAfter = this.spacecraft.getCurrentMass();
        if (massAfter < massBefore) {
            const deliveredDV = this.spacecraft.spsIsp * 9.81 * Math.log(massBefore / massAfter);
            this.burn.remainingDV = Math.max(0, this.burn.remainingDV - deliveredDV);
        }
        this.burn.massBefore = null;

        if (this.burn.remainingDV <= 0.5 || this.spacecraft.spsPropellant <= 0) {
            const label = this.burn.label;
            this.spacecraft.setThrust(false);
            this.burn = null;
            this.guidance = { type: 'hold', mode: this.holdMode || 'prograde' };
            this.assistOwner = 'mission-hold';
            this.phase = label + ' COMPLETE';
            this.log(label + ' CUTOFF');
            this.scene.createOrbitalTrajectory();
        }
    }

    resetToLaunchPad() {
        this.spacecraft.configureApolloVehicles();
        this.spacecraft.currentStageIndex = 0;
        this.spacecraft.setVehicleMode('saturn-v');

        const radial = latLonToVector3(this.cape.lat, this.cape.lon, 1).normalize();
        const east = this.getEastVector(radial);
        const padPosition = radial.clone().multiplyScalar(this.earth.radius + this.scaleManager.toVisualizationSpace(130));
        const earthRotationSpeed = 465.1 * Math.cos(THREE.MathUtils.degToRad(this.cape.lat));
        const padVelocity = this.scaleManager.vectorToVisualizationSpace(east.clone().multiplyScalar(earthRotationSpeed));

        this.spacecraft.setPosition(padPosition);
        this.spacecraft.setVelocity(padVelocity);
        this.spacecraft.mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            radial
        ));
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;
        this.spacecraft.setThrust(false);

        this.padState = {
            position: padPosition.clone(),
            velocity: padVelocity.clone(),
            quaternion: this.spacecraft.mesh.quaternion.clone()
        };
        this.missionTime = 0;
        this.metRunning = false;
        this.phase = 'PRELAUNCH';
        this.clearGuidance(false);
        this.primaryBody = this.earth;
        this.scene.planet = this.earth;
        this.scene.primaryBody = this.earth;
        this.scene.cameraMode = 'craft';
        this.scene.cameraSettings.distance = 48;
        this.scene.cameraSettings.horizontalOrbit = -0.36;
        this.scene.cameraSettings.verticalOrbit = 0.22;
        this.setLaunchDisplayMode(true);
        if (this.scene.clearManeuver) {
            this.scene.clearManeuver();
        }
        this.scene.createOrbitalTrajectory();
        this.setLaunchDisplayMode(true);
        this.updateTelemetry();
    }

    startLaunch() {
        if (this.spacecraft.vehicleMode !== 'saturn-v') {
            this.resetToLaunchPad();
        }
        this.setWarp(1);
        this.cancelSceneAssistOwners('LAUNCH');
        this.metRunning = true;
        this.padState = null;
        this.phase = 'LAUNCH';
        this.guidance = { type: 'launch', elapsed: 0 };
        this.assistOwner = 'launch-guidance';
        this.burn = null;
        this.setLaunchDisplayMode(true);
        this.log('LAUNCH COMMIT');
    }

    stage(options = {}) {
        if (!options.preserveGuidance) {
            this.cancelGuidanceForExternalOwner('STAGE');
            this.cancelSceneAssistOwners('STAGE');
        }
        if (!this.spacecraft.separateStage || !this.spacecraft.separateStage()) {
            this.log('NO STAGE');
            return;
        }
        this.phase = this.spacecraft.vehicleMode === 'saturn-v' ? 'ASCENT' : 'CSM-LM';
        this.log('STAGE ' + this.spacecraft.getVehicleLabel());
    }

    setParkingOrbit(options = {}) {
        this.setOrbitAroundBody(this.earth, Object.assign({
            altitude: 185000,
            phase: 'PARKING',
            logMessage: 'EARTH ORBIT READY',
            lat: 0,
            lon: -80,
            mapZoom: 16000
        }, options));
    }

    setLunarOrbit(options = {}) {
        this.setOrbitAroundBody(this.moon, Object.assign({
            altitude: 110000,
            phase: 'LUNAR ORBIT',
            logMessage: 'LUNAR ORBIT READY',
            lat: 0,
            lon: 24,
            mapZoom: 5200
        }, options));
    }

    setOrbitAroundBody(body, options = {}) {
        if (!body || !this.spacecraft) return;

        this.spacecraft.configureApolloVehicles();
        this.spacecraft.setVehicleMode(options.vehicleMode || 'csm-lm');

        const radial = (options.radial || latLonToVector3(options.lat || 0, options.lon || 0, 1)).normalize();
        const progradeSeed = options.prograde || this.getEastVector(radial);
        const orbitState = this.createCircularOrbitState(body, options.altitude || 185000, radial, progradeSeed);

        this.spacecraft.setPosition(orbitState.position);
        this.spacecraft.setVelocity(orbitState.velocity);
        this.spacecraft.mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            orbitState.relativeVelocity.clone().normalize()
        ));
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;
        this.spacecraft.setThrust(false);
        this.spacecraft.sasActive = true;

        this.padState = null;
        this.metRunning = true;
        this.missionTime = options.keepClock ? this.missionTime : 0;
        this.primaryBody = body;
        this.scene.planet = body;
        this.scene.primaryBody = body;
        this.phase = options.phase || (body === this.moon ? 'LUNAR ORBIT' : 'PARKING');
        this.setWarp(1);
        this.clearGuidance(false);
        this.holdMode = options.holdMode || 'prograde';
        this.guidance = { type: 'hold', mode: this.holdMode };
        this.assistOwner = 'mission-hold';
        this.scene.cameraMode = 'map';
        this.scene.mapSettings.zoom = options.mapZoom || (body === this.moon ? 5200 : 16000);
        this.scene.updateMapCameraProjection();
        this.setLaunchDisplayMode(false);
        if (this.scene.clearManeuver) {
            this.scene.clearManeuver();
        }
        this.scene.createOrbitalTrajectory();
        if (options.log !== false) {
            this.log(options.logMessage || 'ORBIT READY');
        } else {
            this.updateTelemetry();
        }
    }

    createCircularOrbitState(body, altitude, radial, progradeSeed) {
        const bodyRadius = this.scaleManager.toRealWorld(body.radius);
        const orbitRadius = bodyRadius + altitude;
        const radialUnit = radial.clone().normalize();
        let progradeUnit = progradeSeed.clone().sub(
            radialUnit.clone().multiplyScalar(progradeSeed.dot(radialUnit))
        );
        if (progradeUnit.lengthSq() < 1e-10) {
            progradeUnit = this.getEastVector(radialUnit);
        }
        progradeUnit.normalize();

        const orbitalSpeed = Math.sqrt(physics.G * body.mass / orbitRadius);
        const relativePosition = radialUnit.clone().multiplyScalar(orbitRadius);
        const relativeVelocity = progradeUnit.clone().multiplyScalar(orbitalSpeed);
        const bodyPosition = body.mesh && body.mesh.position ? body.mesh.position : new THREE.Vector3();
        const bodyVelocity = body.velocity || new THREE.Vector3();

        return {
            orbitRadius,
            orbitalSpeed,
            relativePosition,
            relativeVelocity,
            position: bodyPosition.clone().add(this.scaleManager.vectorToVisualizationSpace(relativePosition)),
            velocity: bodyVelocity.clone().add(this.scaleManager.vectorToVisualizationSpace(relativeVelocity))
        };
    }

    isPadHoldActive() {
        return this.phase === 'PRELAUNCH' && !this.guidance && this.padState;
    }

    isLaunchDisplayActive() {
        return this.spacecraft &&
            this.spacecraft.vehicleMode === 'saturn-v' &&
            (this.phase === 'PRELAUNCH' || this.phase === 'LAUNCH' || this.phase === 'ASCENT');
    }

    holdOnPad() {
        if (!this.padState || !this.spacecraft) return;

        this.spacecraft.setPosition(this.padState.position);
        this.spacecraft.setVelocity(this.padState.velocity);
        this.spacecraft.mesh.quaternion.copy(this.padState.quaternion);
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;
        this.spacecraft.setThrust(false);
    }

    setLaunchDisplayMode(isLaunchMode) {
        if (!this.scene || !this.scene.displayOptions) return;

        this.scene.displayOptions.orbit = !isLaunchMode;
        if (this.scene.orbitalTrajectory) {
            this.scene.orbitalTrajectory.visible = !isLaunchMode;
        }
        if (this.scene.predictedTrajectory) {
            this.scene.predictedTrajectory.visible = !isLaunchMode;
        }
        if (this.scene.maneuverMarker) {
            this.scene.maneuverMarker.visible = !isLaunchMode &&
                this.scene.maneuver &&
                this.scene.maneuver.active;
        }
    }

    transpositionDock() {
        this.spacecraft.setVehicleMode('csm-lm');
        this.phase = 'CSM-LM';
        this.clearGuidance(false);
        this.scene.createOrbitalTrajectory();
        this.log('CSM LM DOCKED');
    }

    activateLM() {
        this.spacecraft.setVehicleMode('lm-descent');
        this.phase = 'LM DESCENT';
        this.clearGuidance(false);
        this.log('LM ACTIVE');
    }

    activateLMAscent() {
        this.spacecraft.setVehicleMode('lm-ascent');
        this.phase = 'LM ASCENT';
        this.clearGuidance(false);
        this.log('ASCENT STAGE');
    }

    activateCSM() {
        this.spacecraft.setVehicleMode('csm');
        this.phase = 'CSM ACTIVE';
        this.clearGuidance(false);
        this.log('CSM ACTIVE');
    }

    setHold(mode) {
        this.cancelSceneAssistOwners('HOLD');
        this.holdMode = mode;
        this.guidance = { type: 'hold', mode };
        this.assistOwner = 'mission-hold';
        this.spacecraft.sasActive = true;
        this.log('HOLD ' + this.formatHoldMode(mode));
    }

    startTliBurn() {
        const estimate = this.computeTliDeltaV();
        if (!estimate || !isFinite(estimate.deltaV)) {
            this.log('TLI NO SOLUTION');
            return;
        }
        if (estimate.deltaV <= 0.5) {
            this.log('TLI DV ZERO');
            return;
        }
        this.startFixedBurn(estimate.mode, estimate.deltaV, 'TLI');
    }

    startCircularizeBurn() {
        const assist = this.computeCircularizeDeltaV(this.primaryBody);
        if (!assist || !isFinite(assist.deltaV)) {
            this.log('CIRC NO SOLUTION');
            return;
        }
        if (assist.deltaV <= 0.5) {
            this.log('CIRC OK');
            return;
        }
        this.startFixedBurn(assist.mode, assist.deltaV, 'CIRC');
    }

    startFixedBurn(mode, deltaV, label) {
        if (this.spacecraft.spsPropellant <= 0) {
            this.log('NO PROP');
            return;
        }
        this.setWarp(1);
        this.cancelSceneAssistOwners(label);
        this.holdMode = mode;
        this.burn = {
            label,
            remainingDV: deltaV,
            massBefore: null
        };
        this.guidance = { type: 'burn', mode };
        this.assistOwner = 'mission-burn';
        this.spacecraft.sasActive = true;
        this.phase = label + ' BURN';
        this.log(label + ' START ' + deltaV.toFixed(0));
    }

    clearGuidance(log = true) {
        this.guidance = null;
        this.burn = null;
        this.assistOwner = null;
        this.holdMode = null;
        if (this.spacecraft) this.spacecraft.setThrust(false);
        if (this.scene && this.scene.cancelManeuverAssist) {
            this.scene.cancelManeuverAssist('OFF', { log: false });
        }
        if (log) this.log('GUIDANCE OFF');
    }

    getMissionAssistOwner() {
        return this.assistOwner;
    }

    getActiveAssistOwner() {
        if (this.assistOwner) return this.assistOwner;
        if (this.scene && this.scene.getCurrentAssistOwner) {
            return this.scene.getCurrentAssistOwner();
        }
        return null;
    }

    cancelSceneAssistOwners(reason) {
        if (!this.scene) return;
        if (this.scene.cancelManeuverAssist) {
            this.scene.cancelManeuverAssist(reason, { log: false });
        }
        if (this.scene.clearManualAssistOwner) {
            this.scene.clearManualAssistOwner();
        }
    }

    cancelGuidanceForExternalOwner(reason) {
        if (!this.guidance && !this.assistOwner && !this.burn) return false;

        const owner = this.assistOwner || 'mission';
        this.guidance = null;
        this.burn = null;
        this.assistOwner = null;
        this.holdMode = null;
        if (this.spacecraft) this.spacecraft.setThrust(false);
        this.log(reason + ' CANCEL ' + this.formatAssistOwner(owner));
        return true;
    }

    cancelForManualInput(reason) {
        return this.cancelGuidanceForExternalOwner(reason || 'MANUAL');
    }

    holdAttitude(mode, deltaTime) {
        const vectors = this.getBodyFrameVectors(this.primaryBody);
        if (!vectors || !vectors[mode]) return;
        this.orientForwardTo(vectors[mode], deltaTime, 1.8);
    }

    orientForwardTo(targetDirection, deltaTime, rate) {
        if (!targetDirection || targetDirection.lengthSq() < 1e-10) return;
        const target = targetDirection.clone().normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), target);
        const alpha = 1 - Math.exp(-deltaTime * rate);
        this.spacecraft.mesh.quaternion.slerp(targetQuaternion, THREE.MathUtils.clamp(alpha, 0, 1));
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;
    }

    getBodyFrameVectors(body) {
        if (!body || !this.spacecraft) return null;
        const relPosition = this.spacecraft.position.clone().sub(body.mesh.position);
        const relVelocity = this.spacecraft.velocity.clone().sub(body.velocity || new THREE.Vector3());
        if (relPosition.lengthSq() < 1e-10 || relVelocity.lengthSq() < 1e-10) return null;

        const prograde = relVelocity.normalize();
        const radialOut = relPosition.normalize();
        let normal = new THREE.Vector3().crossVectors(relPosition, relVelocity);
        if (normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
        normal.normalize();

        return {
            prograde,
            retrograde: prograde.clone().negate(),
            radialOut,
            radialIn: radialOut.clone().negate(),
            normal,
            antiNormal: normal.clone().negate()
        };
    }

    computeOrbit(body) {
        if (!body || !this.spacecraft) return null;
        const state = this.getRelativeState(body);
        if (!state) return null;
        const relPosition = state.position;
        const relVelocity = state.velocity;
        return physics.calculateOrbitalParameters(relPosition, relVelocity, body.mass);
    }

    getRelativeState(body) {
        if (!body || !body.mesh || !this.spacecraft || !this.scaleManager) return null;
        return {
            position: this.scaleManager.vectorToRealWorld(
                this.spacecraft.position.clone().sub(body.mesh.position)
            ),
            velocity: this.scaleManager.vectorToRealWorld(
                this.spacecraft.velocity.clone().sub(body.velocity || new THREE.Vector3())
            )
        };
    }

    computeTliDeltaV() {
        if (this.primaryBody !== this.earth) return null;

        const state = this.getRelativeState(this.earth);
        if (!state) return null;

        const radius = state.position.length();
        const currentSpeed = state.velocity.length();
        const transferRadius = Math.max(this.getMoonTransferRadius(), radius + 1);
        const mu = physics.G * this.earth.mass;
        const transferSemiMajorAxis = (radius + transferRadius) / 2;
        const transferSpeed = Math.sqrt(mu * ((2 / radius) - (1 / transferSemiMajorAxis)));
        const signedDeltaV = transferSpeed - currentSpeed;

        return this.createDeltaVEstimate(signedDeltaV, transferSpeed, currentSpeed);
    }

    computeCircularizeDeltaV(body) {
        const state = this.getRelativeState(body);
        if (!state || !body) return null;

        const radius = state.position.length();
        if (radius <= 0) return null;

        const mu = physics.G * body.mass;
        const currentSpeed = state.velocity.length();
        const circularSpeed = Math.sqrt(mu / radius);
        const signedDeltaV = circularSpeed - currentSpeed;

        return this.createDeltaVEstimate(signedDeltaV, circularSpeed, currentSpeed);
    }

    createDeltaVEstimate(signedDeltaV, targetSpeed, currentSpeed) {
        if (!isFinite(signedDeltaV)) return null;
        return {
            signedDeltaV,
            deltaV: Math.abs(signedDeltaV),
            mode: signedDeltaV >= 0 ? 'prograde' : 'retrograde',
            targetSpeed,
            currentSpeed
        };
    }

    getMoonTransferRadius() {
        if (!this.moon || !this.moon.mesh || !this.earth || !this.earth.mesh) {
            return this.moonOrbitRadius;
        }
        return this.scaleManager.toRealWorld(this.moon.mesh.position.distanceTo(this.earth.mesh.position));
    }

    getEastVector(radial) {
        let east = new THREE.Vector3(0, 1, 0).cross(radial);
        if (east.lengthSq() < 0.0001) {
            east = new THREE.Vector3(0, 0, 1).cross(radial);
        }
        return east.normalize();
    }

    setWarp(factor) {
        const index = this.scene.timeWarp.available.indexOf(factor);
        this.scene.timeWarp.currentIndex = index >= 0 ? index : 0;
        this.scene.timeWarp.factor = this.scene.timeWarp.available[this.scene.timeWarp.currentIndex];
        this.scene.timeWarp.active = this.scene.timeWarp.factor > 1;
    }

    updateTelemetry() {
        if (!this.panel) return;
        const setText = (name, value) => {
            const element = this.panel.querySelector('[data-mission="' + name + '"]');
            if (element) element.textContent = value;
        };

        const moonRange = this.spacecraft ?
            this.scaleManager.toRealWorld(this.spacecraft.position.distanceTo(this.moon.mesh.position)) :
            Infinity;
        const activeBody = this.primaryBody || this.earth;
        const orbit = this.computeOrbit(activeBody);
        const bodyRadius = activeBody ? this.scaleManager.toRealWorld(activeBody.radius) : 0;
        const showPlanning = !this.isLaunchDisplayActive() && this.phase !== 'PRELAUNCH';
        const tliEstimate = showPlanning ? this.computeTliDeltaV() : null;
        const circularizeEstimate = showPlanning ? this.computeCircularizeDeltaV(activeBody) : null;
        const orbitGuard = showPlanning ? this.getOrbitGuard(activeBody, orbit) : null;
        const guidanceLabel = this.guidance ?
            (this.guidance.type === 'burn' && this.burn ? 'MISSION BURN ' + this.burn.label + ' ' + this.burn.remainingDV.toFixed(0) :
                this.guidance.type === 'hold' ? 'MISSION HOLD ' + this.formatHoldMode(this.guidance.mode) :
                    this.formatAssistOwner(this.assistOwner) || this.guidance.type.toUpperCase()) :
            this.formatAssistOwner(this.getActiveAssistOwner()) || 'IDLE';

        setText('phase', this.phase);
        setText('met', this.formatMET(this.missionTime));
        setText('body', activeBody ? activeBody.name.toUpperCase() : 'EARTH');
        setText('vehicle', this.spacecraft.getVehicleLabel ? this.spacecraft.getVehicleLabel() : 'CSM');
        setText('guidance', guidanceLabel);
        setText('ap', this.phase !== 'PRELAUNCH' && orbit ? this.formatOrbitAltitude(orbit.apoapsis, bodyRadius) : '--');
        setText('pe', this.phase !== 'PRELAUNCH' && orbit ? this.formatOrbitAltitude(orbit.periapsis, bodyRadius) : '--');
        setText('tta', this.phase !== 'PRELAUNCH' && orbit ? this.formatDuration(this.timeToTrueAnomaly(orbit, Math.PI)) : '--');
        setText('ttp', this.phase !== 'PRELAUNCH' && orbit ? this.formatDuration(this.timeToTrueAnomaly(orbit, 0)) : '--');
        setText('orbit-status', this.formatOrbitGuard(orbitGuard));
        setText('tli-dv', showPlanning ? this.formatDeltaVEstimate(tliEstimate) : '--');
        setText('circ-dv', showPlanning ? this.formatDeltaVEstimate(circularizeEstimate) : '--');
        setText('range', this.formatDistance(moonRange));

        const logElement = this.panel.querySelector('[data-mission="log"]');
        if (logElement) logElement.innerHTML = this.logs.slice(-5).map((line) => '<div>' + line + '</div>').join('');
    }

    formatMET(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return String(hours).padStart(3, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(secs).padStart(2, '0');
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

    formatDuration(seconds) {
        if (!isFinite(seconds)) return '--';
        const total = Math.max(0, Math.floor(seconds));
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (days > 0) {
            return days + 'd ' + String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0');
        }
        return String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(secs).padStart(2, '0');
    }

    formatDistance(meters) {
        if (!isFinite(meters)) return '--';
        const sign = meters < 0 ? '-' : '';
        const absMeters = Math.abs(meters);
        if (absMeters >= 1000000) return sign + (absMeters / 1000000).toFixed(1) + ' Mm';
        return sign + (absMeters / 1000).toFixed(0) + ' km';
    }

    formatOrbitAltitude(radius, bodyRadius) {
        if (!isFinite(radius)) return 'ESC';
        return this.formatDistance(radius - bodyRadius);
    }

    formatDeltaVEstimate(estimate) {
        if (!estimate || !isFinite(estimate.deltaV)) return '--';
        return (estimate.mode === 'prograde' ? 'PRO ' : 'RET ') + estimate.deltaV.toFixed(0);
    }

    getOrbitGuard(body, orbit) {
        if (!orbit || !window.ApolloOrbitGuards) return null;
        const profileName = body === this.moon ?
            (this.spacecraft.vehicleMode === 'lm-ascent' ? 'lmAscentInsertion' : 'lunarOrbit') :
            'earthParking';
        return window.ApolloOrbitGuards.validateProfile(profileName, orbit);
    }

    formatOrbitGuard(guard) {
        if (!guard) return '--';
        if (guard.ok) return 'GO';
        const labels = {
            'surface-intersecting': 'IMPACT',
            'periapsis-too-low': 'PE LOW',
            'apoapsis-too-high': 'AP HIGH',
            'not-bound': 'ESCAPE',
            'eccentricity-too-high': 'ECC HIGH',
            'periapsis-unavailable': 'PE?',
            'apoapsis-unavailable': 'AP?',
            'eccentricity-unavailable': 'ECC?',
            'period-unavailable': 'PER?'
        };
        return labels[guard.issues[0]] || 'CHECK';
    }

    formatHoldMode(mode) {
        const labels = {
            prograde: 'PRO',
            retrograde: 'RET',
            radialOut: 'RAD OUT',
            radialIn: 'RAD IN',
            normal: 'NORMAL',
            antiNormal: 'ANTI-NORMAL'
        };
        return labels[mode] || String(mode || 'HOLD').toUpperCase();
    }

    formatAssistOwner(owner) {
        const labels = {
            manual: 'MANUAL',
            'manual-node': 'NODE',
            'mission-hold': 'MISSION HOLD',
            'mission-burn': 'MISSION BURN',
            'launch-guidance': 'LAUNCH GUIDANCE',
            'descent-guidance': 'DESCENT GUIDANCE',
            'rendezvous-guidance': 'RENDEZVOUS GUIDANCE'
        };
        return owner ? (labels[owner] || String(owner).toUpperCase()) : '';
    }

    log(message) {
        this.logs.push(this.formatMET(this.missionTime) + ' ' + message);
        this.updateTelemetry();
    }
}

(function installApolloMissionSceneHooks() {
    if (window.__apolloMissionHooksInstalled || typeof Scene === 'undefined') return;
    window.__apolloMissionHooksInstalled = true;

    const originalUpdatePhysics = Scene.prototype.updatePhysics;
    Scene.prototype.updatePhysics = function(deltaTime) {
        if (this.mission && this.mission.prePhysics) {
            this.mission.prePhysics(deltaTime);
        }
        originalUpdatePhysics.call(this, deltaTime);
        if (this.mission && this.mission.postPhysics) {
            this.mission.postPhysics(deltaTime);
        }
    };

    const originalCalculateOrbitalParameters = Scene.prototype.calculateOrbitalParameters;
    Scene.prototype.calculateOrbitalParameters = function() {
        if (
            this.mission &&
            this.planet &&
            this.spacecraft &&
            window.scaleManager &&
            this.planet.velocity
        ) {
            const relativePosition = this.spacecraft.position.clone().sub(this.planet.mesh.position);
            const relativeVelocity = this.spacecraft.velocity.clone().sub(this.planet.velocity);
            return physics.calculateOrbitalParameters(
                window.scaleManager.vectorToRealWorld(relativePosition),
                window.scaleManager.vectorToRealWorld(relativeVelocity),
                this.planet.mass
            );
        }
        return originalCalculateOrbitalParameters.call(this);
    };
})();

window.ApolloMission = ApolloMission;
