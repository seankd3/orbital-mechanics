/**
 * Practical Apollo profile data for mission selection, guidance presets, and
 * scripted events. Values are gameplay-oriented approximations in SI units.
 */
window.APOLLO_PROFILES = {
    version: 1,
    units: {
        deltaV: 'm/s',
        mass: 'kg',
        thrust: 'N',
        altitude: 'm',
        time: 's'
    },
    bodies: {
        earth: {
            label: 'Earth',
            radius: 6371000,
            mu: 3.986004418e14,
            parkingOrbitAltitude: 185000
        },
        moon: {
            label: 'Moon',
            radius: 1737400,
            mu: 4.9048695e12,
            soiRadius: 66100000,
            orbitAltitude: 110000
        }
    },
    scenarios: [
        {
            id: 'apollo8_lunar_orbit',
            label: 'Apollo 8',
            style: 'lunar-orbit',
            summary: 'First crewed lunar-orbit profile: launch, TLI, LOI, ten lunar orbits, TEI, re-entry.',
            crew: ['Borman', 'Lovell', 'Anders'],
            startPhase: 'prelaunch',
            startVehicleMode: 'saturn-v',
            objectivePhaseIds: [
                'prelaunch',
                'ascent',
                'parking-orbit',
                'tli',
                'trans-lunar-coast',
                'loi',
                'lunar-orbit',
                'tei',
                'trans-earth-coast',
                'entry'
            ],
            recommendedBurnIds: ['tli', 'mcc-small', 'loi-1', 'loi-2', 'tei', 'entry-corridor-trim'],
            enabledFailureIds: ['imu-drift', 'sps-underburn', 'comm-dropout'],
            target: {
                body: 'moon',
                periluneAltitude: 110000,
                lunarOrbits: 10,
                freeReturnAllowed: true
            }
        },
        {
            id: 'apollo11_landing',
            label: 'Apollo 11',
            style: 'lunar-landing',
            summary: 'Landing profile with CSM/LM operations, powered descent, ascent, rendezvous, TEI, and entry.',
            crew: ['Armstrong', 'Collins', 'Aldrin'],
            startPhase: 'prelaunch',
            startVehicleMode: 'saturn-v',
            objectivePhaseIds: [
                'prelaunch',
                'ascent',
                'parking-orbit',
                'tli',
                'trans-lunar-coast',
                'loi',
                'lunar-orbit',
                'lm-activation',
                'descent',
                'surface',
                'ascent-rendezvous',
                'tei',
                'trans-earth-coast',
                'entry'
            ],
            recommendedBurnIds: [
                'tli',
                'mcc-small',
                'loi-1',
                'loi-2',
                'doi',
                'pdi',
                'hover-trim',
                'lm-ascent',
                'rendezvous-trim',
                'tei',
                'entry-corridor-trim'
            ],
            enabledFailureIds: ['landing-radar-late', 'program-alarm', 'low-lm-fuel', 'sps-underburn', 'comm-dropout'],
            target: {
                body: 'moon',
                landingSite: 'Mare Tranquillitatis',
                landingSiteLat: 0.674,
                landingSiteLon: 23.473,
                lunarOrbitAltitude: 110000,
                surfaceStay: 75600
            }
        },
        {
            id: 'apollo13_free_return',
            label: 'Apollo 13-style',
            style: 'contingency-free-return',
            summary: 'Abort scenario centered on CSM failure, LM lifeboat power limits, PC+2 burn, and safe entry.',
            crew: ['Commander', 'CMP', 'LMP'],
            startPhase: 'trans-lunar-coast',
            startVehicleMode: 'csm-lm',
            objectivePhaseIds: [
                'trans-lunar-coast',
                'contingency',
                'free-return',
                'trans-earth-coast',
                'entry'
            ],
            recommendedBurnIds: ['free-return-correction', 'pc-plus-two', 'lm-descent-midcourse', 'entry-corridor-trim'],
            enabledFailureIds: ['service-module-oxygen-loss', 'main-bus-undervolt', 'co2-scrubber-limit', 'lm-water-low'],
            target: {
                body: 'earth',
                abortMode: 'free-return',
                moonFlybyAltitude: 250000,
                entryInterfaceAltitude: 122000,
                landingZone: 'Pacific recovery corridor'
            }
        }
    ],
    phaseChecklists: {
        prelaunch: {
            label: 'Prelaunch',
            body: 'earth',
            vehicleMode: 'saturn-v',
            checklist: [
                'Load launch vehicle and mission profile.',
                'Set guidance reference to Earth inertial.',
                'Verify S-IC, S-II, and S-IVB propellant state.',
                'Arm staging and confirm crew cabin mode.',
                'Commit to launch at guidance mark.'
            ],
            completeWhen: ['vehicleMode:saturn-v', 'guidance:ready']
        },
        ascent: {
            label: 'Ascent',
            body: 'earth',
            vehicleMode: 'saturn-v',
            checklist: [
                'Pitch downrange after tower clear.',
                'Hold prograde through maximum dynamic pressure.',
                'Stage S-IC and S-II on velocity targets.',
                'Use S-IVB to circularize near parking altitude.',
                'Confirm stable Earth parking orbit.'
            ],
            completeWhen: ['apoapsis:>180000', 'periapsis:>160000', 'vehicleMode:saturn-v']
        },
        'parking-orbit': {
            label: 'Earth Parking Orbit',
            body: 'earth',
            vehicleMode: 'saturn-v',
            checklist: [
                'Coast to TLI window.',
                'Trim attitude to prograde.',
                'Check S-IVB propellant margin.',
                'Verify CSM guidance and optics alignment.',
                'Commit TLI burn.'
            ],
            completeWhen: ['orbitBody:earth', 'altitude:>160000', 'burn:tli']
        },
        tli: {
            label: 'Trans-Lunar Injection',
            body: 'earth',
            vehicleMode: 'saturn-v',
            checklist: [
                'Ignite S-IVB on prograde attitude.',
                'Track apogee growth beyond lunar distance.',
                'Cut off near planned C3/free-return corridor.',
                'Separate CSM from S-IVB.',
                'Dock with LM when applicable.'
            ],
            completeWhen: ['burnComplete:tli', 'trajectory:lunar-transfer']
        },
        'trans-lunar-coast': {
            label: 'Trans-Lunar Coast',
            body: 'earth',
            vehicleMode: 'csm-lm',
            checklist: [
                'Perform transposition and docking if LM is carried.',
                'Run navigation sightings and state-vector update.',
                'Use small SPS/RCS corrections only as needed.',
                'Monitor free-return corridor.',
                'Configure for lunar SOI entry.'
            ],
            completeWhen: ['soi:moon']
        },
        loi: {
            label: 'Lunar Orbit Insertion',
            body: 'moon',
            vehicleMode: 'csm-lm',
            checklist: [
                'Point retrograde at perilune.',
                'Burn SPS for initial capture.',
                'Verify bound lunar orbit.',
                'Circularize near mission altitude.',
                'Update lunar orbit references.'
            ],
            completeWhen: ['orbitBody:moon', 'apoapsis:<400000', 'periapsis:>80000']
        },
        'lunar-orbit': {
            label: 'Lunar Orbit',
            body: 'moon',
            vehicleMode: 'csm-lm',
            checklist: [
                'Stabilize orbit and map landing/observation targets.',
                'Align CSM and LM guidance platforms.',
                'Prepare LM activation or TEI depending on scenario.',
                'Keep SPS reserve above return requirement.',
                'Verify Earth return window.'
            ],
            completeWhen: ['orbitBody:moon', 'guidance:ready']
        },
        'lm-activation': {
            label: 'LM Activation',
            body: 'moon',
            vehicleMode: 'lm-descent',
            checklist: [
                'Power LM descent systems.',
                'Undock and inspect CSM separation.',
                'Initialize LM guidance.',
                'Perform descent orbit insertion.',
                'Arm powered descent initiation.'
            ],
            completeWhen: ['vehicleMode:lm-descent', 'burn:doi']
        },
        descent: {
            label: 'Powered Descent',
            body: 'moon',
            vehicleMode: 'lm-descent',
            checklist: [
                'Start PDI near perilune.',
                'Hold retrograde braking until approach phase.',
                'Pitch up to manage vertical rate.',
                'Use hover trim sparingly.',
                'Touch down with positive fuel reserve.'
            ],
            completeWhen: ['altitude:<5', 'verticalSpeed:<2', 'vehicleMode:lm-descent']
        },
        surface: {
            label: 'Lunar Surface',
            body: 'moon',
            vehicleMode: 'lm-descent',
            checklist: [
                'Safe descent engine.',
                'Log landing site and fuel remaining.',
                'Run surface timeline.',
                'Prepare ascent stage separation.',
                'Load rendezvous target state.'
            ],
            completeWhen: ['surfaceOps:complete', 'vehicleMode:lm-ascent']
        },
        'ascent-rendezvous': {
            label: 'Ascent and Rendezvous',
            body: 'moon',
            vehicleMode: 'lm-ascent',
            checklist: [
                'Launch ascent stage to CSM plane.',
                'Circularize below CSM orbit.',
                'Run phasing and terminal rendezvous trims.',
                'Dock with CSM.',
                'Jettison LM ascent stage.'
            ],
            completeWhen: ['vehicleMode:csm', 'rendezvous:complete']
        },
        contingency: {
            label: 'Contingency',
            body: 'earth',
            vehicleMode: 'csm-lm',
            checklist: [
                'Identify failed system and isolate affected bus.',
                'Power up LM lifeboat systems.',
                'Disable nonessential CSM loads.',
                'Build consumables timeline.',
                'Choose free-return or direct-abort burn.'
            ],
            completeWhen: ['vehicleMode:lm-descent', 'abortPlan:selected']
        },
        'free-return': {
            label: 'Free Return',
            body: 'moon',
            vehicleMode: 'lm-descent',
            checklist: [
                'Use LM DPS for PC+2 or equivalent correction.',
                'Keep burn attitude manually controllable.',
                'Target Earth entry corridor after lunar flyby.',
                'Preserve LM consumables for coast.',
                'Prepare CSM power-up procedure.'
            ],
            completeWhen: ['trajectory:earth-return', 'entryAngle:in-family']
        },
        tei: {
            label: 'Trans-Earth Injection',
            body: 'moon',
            vehicleMode: 'csm',
            checklist: [
                'Set retrograde/prograde TEI attitude per orbit geometry.',
                'Burn SPS to escape lunar orbit.',
                'Confirm Earth periapsis and entry corridor.',
                'Trim with midcourse correction if required.',
                'Power down for trans-Earth coast.'
            ],
            completeWhen: ['burnComplete:tei', 'trajectory:earth-return']
        },
        'trans-earth-coast': {
            label: 'Trans-Earth Coast',
            body: 'earth',
            vehicleMode: 'csm',
            checklist: [
                'Track entry interface angle.',
                'Perform final corridor correction.',
                'Separate service module before entry.',
                'Orient command module blunt-end forward.',
                'Arm recovery systems.'
            ],
            completeWhen: ['altitude:<122000', 'entryAngle:in-family']
        },
        entry: {
            label: 'Entry and Recovery',
            body: 'earth',
            vehicleMode: 'cm',
            checklist: [
                'Hold entry attitude through blackout.',
                'Respect heating and g-load limits.',
                'Deploy drogue then main parachutes.',
                'Splash down in recovery corridor.',
                'End mission.'
            ],
            completeWhen: ['altitude:0', 'speed:<15']
        }
    },
    burnPresets: {
        launch: {
            id: 'launch',
            label: 'Launch to Parking Orbit',
            body: 'earth',
            vehicleMode: 'saturn-v',
            engine: 'S-IC/S-II/S-IVB stack',
            mode: 'ascent-guidance',
            attitude: 'gravity-turn',
            deltaV: 9400,
            duration: 705,
            notes: 'Includes gravity and drag losses to reach a low Earth parking orbit.'
        },
        circularize: {
            id: 'circularize',
            label: 'Parking Orbit Circularization',
            body: 'earth',
            vehicleMode: 'saturn-v',
            engine: 'S-IVB J-2',
            mode: 'prograde',
            attitude: 'prograde',
            deltaV: 150,
            duration: 20,
            notes: 'Small trim after ascent insertion.'
        },
        tli: {
            id: 'tli',
            label: 'Trans-Lunar Injection',
            body: 'earth',
            vehicleMode: 'saturn-v',
            engine: 'S-IVB J-2',
            mode: 'prograde',
            attitude: 'prograde',
            deltaV: 3150,
            duration: 350,
            notes: 'Earth parking orbit to lunar transfer.'
        },
        'mcc-small': {
            id: 'mcc-small',
            label: 'Small Midcourse Correction',
            body: 'earth',
            vehicleMode: 'csm-lm',
            engine: 'CSM RCS or SPS',
            mode: 'vector-trim',
            attitude: 'node-vector',
            deltaV: 8,
            duration: 12,
            notes: 'Generic coast correction for lunar or Earth return legs.'
        },
        'free-return-correction': {
            id: 'free-return-correction',
            label: 'Free-Return Correction',
            body: 'earth',
            vehicleMode: 'csm-lm',
            engine: 'CSM SPS or LM DPS',
            mode: 'abort-guidance',
            attitude: 'node-vector',
            deltaV: 35,
            duration: 35,
            notes: 'Targets a passive Earth-return corridor before lunar encounter.'
        },
        'loi-1': {
            id: 'loi-1',
            label: 'LOI-1 Capture',
            body: 'moon',
            vehicleMode: 'csm-lm',
            engine: 'CSM SPS',
            mode: 'retrograde',
            attitude: 'retrograde',
            deltaV: 890,
            duration: 360,
            notes: 'Initial lunar capture near perilune.'
        },
        'loi-2': {
            id: 'loi-2',
            label: 'LOI-2 Circularization',
            body: 'moon',
            vehicleMode: 'csm-lm',
            engine: 'CSM SPS',
            mode: 'retrograde',
            attitude: 'retrograde',
            deltaV: 60,
            duration: 25,
            notes: 'Circularizes to a low lunar orbit.'
        },
        doi: {
            id: 'doi',
            label: 'Descent Orbit Insertion',
            body: 'moon',
            vehicleMode: 'lm-descent',
            engine: 'LM DPS',
            mode: 'retrograde',
            attitude: 'retrograde',
            deltaV: 75,
            duration: 28,
            notes: 'Lowers perilune ahead of powered descent.'
        },
        pdi: {
            id: 'pdi',
            label: 'Powered Descent Initiation',
            body: 'moon',
            vehicleMode: 'lm-descent',
            engine: 'LM DPS',
            mode: 'landing-guidance',
            attitude: 'retrograde-to-pitch-up',
            deltaV: 1850,
            duration: 720,
            notes: 'Main braking and approach burn to the surface.'
        },
        'hover-trim': {
            id: 'hover-trim',
            label: 'Hover and Landing Trim',
            body: 'moon',
            vehicleMode: 'lm-descent',
            engine: 'LM DPS throttle',
            mode: 'vertical-rate',
            attitude: 'manual',
            deltaV: 120,
            duration: 80,
            notes: 'Final translation and vertical-rate control near touchdown.'
        },
        'lm-ascent': {
            id: 'lm-ascent',
            label: 'LM Ascent',
            body: 'moon',
            vehicleMode: 'lm-ascent',
            engine: 'LM APS',
            mode: 'ascent-guidance',
            attitude: 'pitch-program',
            deltaV: 1850,
            duration: 435,
            notes: 'Surface launch to low lunar rendezvous orbit.'
        },
        'rendezvous-trim': {
            id: 'rendezvous-trim',
            label: 'Rendezvous Trim',
            body: 'moon',
            vehicleMode: 'lm-ascent',
            engine: 'LM RCS',
            mode: 'relative-velocity',
            attitude: 'target-relative',
            deltaV: 35,
            duration: 60,
            notes: 'Phasing, braking, and terminal approach reserve.'
        },
        tei: {
            id: 'tei',
            label: 'Trans-Earth Injection',
            body: 'moon',
            vehicleMode: 'csm',
            engine: 'CSM SPS',
            mode: 'prograde',
            attitude: 'prograde',
            deltaV: 1000,
            duration: 160,
            notes: 'Lunar orbit departure onto Earth-return trajectory.'
        },
        'pc-plus-two': {
            id: 'pc-plus-two',
            label: 'PC+2 Abort Burn',
            body: 'moon',
            vehicleMode: 'lm-descent',
            engine: 'LM DPS',
            mode: 'abort-guidance',
            attitude: 'node-vector',
            deltaV: 260,
            duration: 270,
            notes: 'Post-pericynthion burn used to shorten Earth return after a contingency.'
        },
        'lm-descent-midcourse': {
            id: 'lm-descent-midcourse',
            label: 'LM DPS Midcourse',
            body: 'earth',
            vehicleMode: 'lm-descent',
            engine: 'LM DPS',
            mode: 'vector-trim',
            attitude: 'node-vector',
            deltaV: 15,
            duration: 20,
            notes: 'Low-rate correction while the LM is serving as lifeboat.'
        },
        'entry-corridor-trim': {
            id: 'entry-corridor-trim',
            label: 'Entry Corridor Trim',
            body: 'earth',
            vehicleMode: 'csm',
            engine: 'CSM RCS',
            mode: 'flight-path-angle',
            attitude: 'node-vector',
            deltaV: 3,
            duration: 8,
            notes: 'Fine correction for safe entry interface.'
        }
    },
    vehicles: {
        'saturn-v': {
            id: 'saturn-v',
            label: 'Saturn V Stack',
            role: 'launch',
            referenceMass: 2965000,
            dryMass: 184600,
            propellantMass: 2780000,
            thrust: 33850000,
            thrustLabel: 'S-IC first stage, five F-1 engines',
            engineLabels: ['S-IC F-1 cluster', 'S-II J-2 cluster', 'S-IVB J-2'],
            modes: ['ascent-guidance', 'prograde', 'stage']
        },
        's-ivb': {
            id: 's-ivb',
            label: 'S-IVB',
            role: 'earth-orbit-departure',
            referenceMass: 122500,
            dryMass: 13500,
            propellantMass: 109000,
            thrust: 1033000,
            thrustLabel: 'Single J-2 restartable stage',
            engineLabels: ['J-2'],
            modes: ['prograde', 'ullage', 'stage']
        },
        'csm-lm': {
            id: 'csm-lm',
            label: 'CSM + LM',
            role: 'lunar-transfer-stack',
            referenceMass: 45200,
            dryMass: 25120,
            propellantMass: 20100,
            thrust: 91189,
            thrustLabel: 'CSM SPS with docked LM mass',
            engineLabels: ['CSM SPS', 'CSM RCS', 'LM RCS'],
            modes: ['prograde', 'retrograde', 'vector-trim', 'abort-guidance']
        },
        csm: {
            id: 'csm',
            label: 'Command/Service Module',
            role: 'crew-return-and-main-propulsion',
            referenceMass: 28800,
            dryMass: 10198,
            propellantMass: 18602,
            thrust: 91189,
            thrustLabel: 'Service Propulsion System AJ10-137',
            engineLabels: ['CSM SPS', 'SM RCS'],
            modes: ['prograde', 'retrograde', 'vector-trim', 'flight-path-angle']
        },
        cm: {
            id: 'cm',
            label: 'Command Module',
            role: 'entry',
            referenceMass: 5560,
            dryMass: 5560,
            propellantMass: 0,
            thrust: 0,
            thrustLabel: 'No main propulsion',
            engineLabels: ['CM RCS'],
            modes: ['entry-attitude']
        },
        'lm-descent': {
            id: 'lm-descent',
            label: 'Lunar Module Descent Stage',
            role: 'landing-and-lifeboat',
            referenceMass: 14970,
            dryMass: 6770,
            propellantMass: 8200,
            thrust: 45040,
            thrustLabel: 'Throttleable LM Descent Propulsion System',
            engineLabels: ['LM DPS', 'LM RCS'],
            modes: ['landing-guidance', 'vertical-rate', 'abort-guidance', 'vector-trim']
        },
        'lm-ascent': {
            id: 'lm-ascent',
            label: 'Lunar Module Ascent Stage',
            role: 'surface-ascent-and-rendezvous',
            referenceMass: 4850,
            dryMass: 2500,
            propellantMass: 2350,
            thrust: 15570,
            thrustLabel: 'Fixed-thrust LM Ascent Propulsion System',
            engineLabels: ['LM APS', 'LM RCS'],
            modes: ['ascent-guidance', 'relative-velocity', 'vector-trim']
        }
    },
    failures: {
        'imu-drift': {
            id: 'imu-drift',
            label: 'IMU Drift',
            severity: 'minor',
            phaseIds: ['trans-lunar-coast', 'lunar-orbit', 'trans-earth-coast'],
            effects: {
                navigationError: 0.015,
                checklistHint: 'Run optics alignment or accept larger burn dispersions.'
            },
            recoveryBurnIds: ['mcc-small', 'entry-corridor-trim']
        },
        'comm-dropout': {
            id: 'comm-dropout',
            label: 'Communications Dropout',
            severity: 'minor',
            phaseIds: ['trans-lunar-coast', 'lunar-orbit', 'descent', 'trans-earth-coast'],
            effects: {
                telemetryDelay: 120,
                guidanceAssistAvailable: false
            },
            recoveryBurnIds: []
        },
        'sps-underburn': {
            id: 'sps-underburn',
            label: 'SPS Underburn',
            severity: 'major',
            phaseIds: ['loi', 'tei'],
            effects: {
                burnEfficiency: 0.92,
                residualDeltaV: 80
            },
            recoveryBurnIds: ['mcc-small', 'entry-corridor-trim']
        },
        'landing-radar-late': {
            id: 'landing-radar-late',
            label: 'Landing Radar Late Lock',
            severity: 'major',
            phaseIds: ['descent'],
            effects: {
                altitudeUncertainty: 250,
                pdiThrottleMargin: -0.04
            },
            recoveryBurnIds: ['hover-trim']
        },
        'program-alarm': {
            id: 'program-alarm',
            label: 'Guidance Program Alarm',
            severity: 'major',
            phaseIds: ['descent'],
            effects: {
                autopilotInterrupt: 8,
                workload: 'high'
            },
            recoveryBurnIds: ['hover-trim']
        },
        'low-lm-fuel': {
            id: 'low-lm-fuel',
            label: 'Low LM Descent Fuel',
            severity: 'major',
            phaseIds: ['descent'],
            effects: {
                propellantReserve: 0.08,
                hoverTimeLimit: 45
            },
            recoveryBurnIds: []
        },
        'service-module-oxygen-loss': {
            id: 'service-module-oxygen-loss',
            label: 'Service Module Oxygen Loss',
            severity: 'critical',
            phaseIds: ['trans-lunar-coast'],
            effects: {
                csmPowerAvailable: false,
                spsAvailable: false,
                requiresVehicleMode: 'lm-descent'
            },
            recoveryBurnIds: ['free-return-correction', 'pc-plus-two', 'lm-descent-midcourse']
        },
        'main-bus-undervolt': {
            id: 'main-bus-undervolt',
            label: 'Main Bus Undervolt',
            severity: 'critical',
            phaseIds: ['contingency', 'free-return'],
            effects: {
                csmGuidanceAvailable: false,
                commandModuleBatteryReserve: 0.35
            },
            recoveryBurnIds: ['pc-plus-two']
        },
        'co2-scrubber-limit': {
            id: 'co2-scrubber-limit',
            label: 'CO2 Scrubber Limit',
            severity: 'major',
            phaseIds: ['free-return', 'trans-earth-coast'],
            effects: {
                consumableDeadline: 54000,
                crewEfficiency: 0.85
            },
            recoveryBurnIds: []
        },
        'lm-water-low': {
            id: 'lm-water-low',
            label: 'LM Water Low',
            severity: 'major',
            phaseIds: ['free-return', 'trans-earth-coast'],
            effects: {
                coolingMargin: 0.2,
                maxTimeWarpRecommended: 100
            },
            recoveryBurnIds: ['entry-corridor-trim']
        }
    },
    events: [
        {
            id: 'max-q',
            label: 'Maximum Dynamic Pressure',
            phaseId: 'ascent',
            missionTime: 78,
            body: 'earth',
            vehicleMode: 'saturn-v',
            type: 'callout'
        },
        {
            id: 's-ic-separation',
            label: 'S-IC Separation',
            phaseId: 'ascent',
            missionTime: 162,
            body: 'earth',
            vehicleMode: 'saturn-v',
            type: 'stage'
        },
        {
            id: 's-ii-separation',
            label: 'S-II Separation',
            phaseId: 'ascent',
            missionTime: 552,
            body: 'earth',
            vehicleMode: 'saturn-v',
            type: 'stage'
        },
        {
            id: 'orbit-insertion',
            label: 'Earth Orbit Insertion',
            phaseId: 'parking-orbit',
            missionTime: 705,
            body: 'earth',
            vehicleMode: 'saturn-v',
            type: 'milestone'
        },
        {
            id: 'transposition-docking',
            label: 'Transposition and Docking',
            phaseId: 'trans-lunar-coast',
            missionTime: 14400,
            body: 'earth',
            vehicleMode: 'csm-lm',
            type: 'operation'
        },
        {
            id: 'lunar-soi',
            label: 'Lunar SOI Entry',
            phaseId: 'loi',
            missionTime: 245000,
            body: 'moon',
            vehicleMode: 'csm-lm',
            type: 'milestone'
        },
        {
            id: 'lm-undock',
            label: 'LM Undock',
            phaseId: 'lm-activation',
            missionTime: 360000,
            body: 'moon',
            vehicleMode: 'lm-descent',
            type: 'operation'
        },
        {
            id: 'touchdown',
            label: 'Lunar Touchdown',
            phaseId: 'surface',
            missionTime: 370000,
            body: 'moon',
            vehicleMode: 'lm-descent',
            type: 'milestone'
        },
        {
            id: 'lifeboat-powerup',
            label: 'LM Lifeboat Power-Up',
            phaseId: 'contingency',
            missionTime: 205000,
            body: 'earth',
            vehicleMode: 'lm-descent',
            type: 'contingency',
            failureId: 'service-module-oxygen-loss'
        },
        {
            id: 'entry-interface',
            label: 'Entry Interface',
            phaseId: 'entry',
            missionTime: 520000,
            body: 'earth',
            vehicleMode: 'cm',
            type: 'milestone'
        }
    ]
};
