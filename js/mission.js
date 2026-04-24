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
        this.phase = 'PRELAUNCH';
        this.guidance = null;
        this.holdMode = null;
        this.burn = null;
        this.logs = [];

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
        this.resetToLaunchPad();
        this.log('GUIDANCE READY');
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
            <div class="mission-title">[ APOLLO MISSION ]</div>
            <div class="mission-grid">
                <span>PHASE</span><span data-mission="phase">PRELAUNCH</span>
                <span>MET</span><span data-mission="met">000:00:00</span>
                <span>BODY</span><span data-mission="body">EARTH</span>
                <span>VEH</span><span data-mission="vehicle">SATURN V</span>
                <span>GUID</span><span data-mission="guidance">IDLE</span>
                <span>RANGE</span><span data-mission="range">--</span>
            </div>
            <div class="mission-actions">
                <button type="button" data-apollo="launch">LAUNCH</button>
                <button type="button" data-apollo="stage">STAGE</button>
                <button type="button" data-apollo="park">ORBIT</button>
                <button type="button" data-apollo="hold-prograde">PRO</button>
                <button type="button" data-apollo="hold-retrograde">RET</button>
                <button type="button" data-apollo="hold-radial">RAD</button>
                <button type="button" data-apollo="tli">TLI</button>
                <button type="button" data-apollo="dock">DOCK</button>
                <button type="button" data-apollo="loi">LOI</button>
                <button type="button" data-apollo="lm">LM</button>
                <button type="button" data-apollo="pdi">PDI</button>
                <button type="button" data-apollo="ascent">ASC</button>
                <button type="button" data-apollo="tei">TEI</button>
                <button type="button" data-apollo="csm">CSM</button>
                <button type="button" data-apollo="off">OFF</button>
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
            case 'hold-prograde':
                this.setHold('prograde');
                break;
            case 'hold-retrograde':
                this.setHold('retrograde');
                break;
            case 'hold-radial':
                this.setHold('radialOut');
                break;
            case 'tli':
                this.startFixedBurn('prograde', 3150, 'TLI');
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
        this.missionTime += warpedDeltaTime;

        if (this.scene.planet !== this.earth) {
            this.earth.update(warpedDeltaTime);
        }

        this.updateMoonPosition(warpedDeltaTime);
        this.updatePrimaryBody();
        if (this.primaryBody === this.moon && this.scene.timeWarp.factor > 1) {
            this.setWarp(1);
        }
        this.updateGuidance(deltaTime, warpedDeltaTime);
    }

    postPhysics() {
        this.updateBurnProgress();
        this.updateTelemetry();
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
            this.stage();
        }

        const orbit = this.computeOrbit(this.earth);
        const earthRadius = this.scaleManager.toRealWorld(this.earth.radius);
        if (orbit && orbit.apoapsis - earthRadius > 185000 && this.spacecraft.vehicleMode === 'saturn-v') {
            this.phase = 'PARKING';
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

        this.spacecraft.setPosition(padPosition);
        this.spacecraft.setVelocity(this.scaleManager.vectorToVisualizationSpace(east.multiplyScalar(earthRotationSpeed)));
        this.spacecraft.mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            radial
        ));
        this.spacecraft.angularVelocity.x = 0;
        this.spacecraft.angularVelocity.y = 0;
        this.spacecraft.angularVelocity.z = 0;

        this.phase = 'PRELAUNCH';
        this.clearGuidance(false);
        this.primaryBody = this.earth;
        this.scene.planet = this.earth;
        this.scene.primaryBody = this.earth;
        this.scene.cameraMode = 'craft';
        this.scene.cameraSettings.distance = 28;
        this.scene.createOrbitalTrajectory();
        this.updateTelemetry();
    }

    startLaunch() {
        if (this.spacecraft.vehicleMode !== 'saturn-v') {
            this.resetToLaunchPad();
        }
        this.setWarp(1);
        this.phase = 'LAUNCH';
        this.guidance = { type: 'launch', elapsed: 0 };
        this.burn = null;
        this.log('LAUNCH COMMIT');
    }

    stage() {
        if (!this.spacecraft.separateStage || !this.spacecraft.separateStage()) {
            this.log('NO STAGE');
            return;
        }
        this.phase = this.spacecraft.vehicleMode === 'saturn-v' ? 'ASCENT' : 'CSM-LM';
        this.log('STAGE ' + this.spacecraft.getVehicleLabel());
    }

    setParkingOrbit() {
        this.spacecraft.configureApolloVehicles();
        this.spacecraft.setVehicleMode('csm-lm');

        const altitude = 185000;
        const radius = 6371000 + altitude;
        const radial = latLonToVector3(0, -80, 1).normalize();
        const prograde = this.getEastVector(radial);
        const speed = Math.sqrt(physics.G * this.earth.mass / radius);

        this.spacecraft.setPosition(this.scaleManager.vectorToVisualizationSpace(radial.multiplyScalar(radius)));
        this.spacecraft.setVelocity(this.scaleManager.vectorToVisualizationSpace(prograde.multiplyScalar(speed)));
        this.spacecraft.mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            this.spacecraft.velocity.clone().normalize()
        ));

        this.phase = 'PARKING';
        this.primaryBody = this.earth;
        this.scene.planet = this.earth;
        this.scene.primaryBody = this.earth;
        this.scene.cameraMode = 'map';
        this.scene.mapSettings.zoom = 16000;
        this.clearGuidance(false);
        this.scene.createOrbitalTrajectory();
        this.log('PARKING ORBIT');
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
        this.holdMode = mode;
        this.guidance = { type: 'hold', mode };
        this.spacecraft.sasActive = true;
        this.log('HOLD ' + mode.toUpperCase());
    }

    startFixedBurn(mode, deltaV, label) {
        if (this.spacecraft.spsPropellant <= 0) {
            this.log('NO PROP');
            return;
        }
        this.setWarp(1);
        this.holdMode = mode;
        this.burn = {
            label,
            remainingDV: deltaV,
            massBefore: null
        };
        this.guidance = { type: 'burn', mode };
        this.spacecraft.sasActive = true;
        this.phase = label + ' BURN';
        this.log(label + ' START ' + deltaV.toFixed(0));
    }

    clearGuidance(log = true) {
        this.guidance = null;
        this.burn = null;
        this.holdMode = null;
        if (this.spacecraft) this.spacecraft.setThrust(false);
        if (log) this.log('GUIDANCE OFF');
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
        const relPosition = this.scaleManager.vectorToRealWorld(
            this.spacecraft.position.clone().sub(body.mesh.position)
        );
        const relVelocity = this.scaleManager.vectorToRealWorld(
            this.spacecraft.velocity.clone().sub(body.velocity || new THREE.Vector3())
        );
        return physics.calculateOrbitalParameters(relPosition, relVelocity, body.mass);
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
        const guidanceLabel = this.guidance ?
            (this.guidance.type === 'burn' && this.burn ? this.burn.label + ' ' + this.burn.remainingDV.toFixed(0) : this.guidance.type.toUpperCase()) :
            'IDLE';

        setText('phase', this.phase);
        setText('met', this.formatMET(this.missionTime));
        setText('body', this.primaryBody ? this.primaryBody.name.toUpperCase() : 'EARTH');
        setText('vehicle', this.spacecraft.getVehicleLabel ? this.spacecraft.getVehicleLabel() : 'CSM');
        setText('guidance', guidanceLabel);
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

    formatDistance(meters) {
        if (!isFinite(meters)) return '--';
        if (meters >= 1000000) return (meters / 1000000).toFixed(1) + ' Mm';
        return (meters / 1000).toFixed(0) + ' km';
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
