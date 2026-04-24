/**
 * Detailed Apollo-style gameplay checklists.
 *
 * This file intentionally contains plain browser data only. It does not import
 * or depend on the simulator runtime so it can be loaded before or after other
 * mission scripts.
 */
window.APOLLO_CHECKLISTS = {
    version: 1,
    schema: 'apollo-checklists/browser-global/v1',
    profile: 'KSP-like Apollo lunar landing',
    units: {
        altitude: 'm',
        velocity: 'm/s',
        deltaV: 'm/s',
        inclination: 'deg',
        time: 's'
    },
    usageNotes: [
        'Targets are gameplay-oriented approximations for an Earth/Moon scale mission.',
        'For a smaller Kerbin/Mun-style system, preserve the sequence and scale altitude and delta-v targets to the local ruleset.',
        'Trigger hints describe when a player or mission script should surface the checklist.',
        'Success criteria describe the state that should be true before the next phase is unlocked.'
    ],
    phaseOrder: [
        'prelaunch',
        's-ic-ascent',
        's-ii-ascent',
        's-ivb-ascent',
        'parking-orbit',
        'tli',
        'transposition-docking',
        'lunar-coast',
        'loi',
        'lm-undock',
        'pdi-descent',
        'surface',
        'lm-ascent',
        'rendezvous',
        'tei',
        'entry-splashdown'
    ],
    phases: {
        prelaunch: {
            id: 'prelaunch',
            label: 'Prelaunch',
            body: 'Earth',
            vehicle: 'Saturn V stack',
            objective: 'Configure the full launch stack, guidance, and mission timeline before committing to liftoff.',
            triggerHints: [
                'Show on the pad after the player selects an Apollo lunar mission profile.',
                'Show again after reverting to launch or after any staging, fuel, crew, or guidance edit.',
                'Require completion before enabling the launch commit control.'
            ],
            successCriteria: [
                'Vehicle is upright, clamped or stable, and assigned to the Saturn V launch configuration.',
                'Crew, CSM, LM, S-IC, S-II, and S-IVB resources are present and mission critical tanks are not locked.',
                'Guidance reference, launch azimuth, staging order, and abort actions are verified.',
                'Countdown reaches T-0 with first-stage engines at stable thrust.'
            ],
            checklist: [
                {
                    id: 'mission-profile',
                    step: 'Load the lunar landing profile and confirm the mission target is the Moon or local moon analog.',
                    triggerHint: 'Before time warp or countdown begins.',
                    successCriteria: 'Mission display shows the lunar landing sequence from launch through recovery.'
                },
                {
                    id: 'crew-and-control',
                    step: 'Confirm crew assignment, command module control point, probe core state if used, and crewed command authority.',
                    triggerHint: 'When the vessel first becomes active on the pad.',
                    successCriteria: 'Attitude controls respond from the command module and no required crew seat is empty.'
                },
                {
                    id: 'staging-order',
                    step: 'Verify staging from bottom to top: S-IC engines, tower or LES jettison, S-IC separation, S-II ignition, S-II separation, S-IVB ignition, CSM separation, LM extraction hardware.',
                    triggerHint: 'After any vehicle edit, payload fairing change, or staging panel warning.',
                    successCriteria: 'Staging stack contains no accidental parachute, docking port, or service module separation before orbit.'
                },
                {
                    id: 'propellant-and-power',
                    step: 'Check fuel, oxidizer, monopropellant, batteries, fuel cells or generators, and boiloff settings if modeled.',
                    triggerHint: 'At T-2 minutes or when resource readouts become available.',
                    successCriteria: 'All ascent stages are full and CSM/LM reserves are isolated from launch-stage drains.'
                },
                {
                    id: 'guidance-setup',
                    step: 'Set navball to surface mode, enable stability assist, select launch heading, and load target inclination.',
                    triggerHint: 'Before engine ignition.',
                    successCriteria: 'Guidance shows a stable launch attitude, target azimuth, and no unexpected trim input.'
                },
                {
                    id: 'abort-setup',
                    step: 'Arm abort actions for launch escape, engine shutdown, tower jettison, and parachute-safe command module recovery.',
                    triggerHint: 'During terminal count or before enabling failures.',
                    successCriteria: 'Abort action can separate the command module cleanly during pad or low-altitude failures.'
                },
                {
                    id: 'launch-commit',
                    step: 'Throttle to launch setting, release clamps if used, and ignite S-IC at T-0.',
                    triggerHint: 'Countdown reaches zero and all status lights are green.',
                    successCriteria: 'All first-stage engines are producing thrust and vertical speed is positive.'
                }
            ],
            cautionCriteria: [
                'Do not launch with control point set to a docking port or LM control point.',
                'Do not leave RCS or CSM engines active during ascent unless the scenario explicitly requires it.'
            ]
        },
        's-ic-ascent': {
            id: 's-ic-ascent',
            label: 'S-IC Ascent',
            body: 'Earth',
            vehicle: 'Saturn V S-IC',
            objective: 'Clear the pad, survive max-Q, and build the first downrange velocity without wasting gravity-turn energy.',
            triggerHints: [
                'Show immediately after liftoff once vertical speed is positive.',
                'Keep active until first-stage propellant depletion or planned S-IC cutoff.',
                'Refresh if dynamic pressure, roll attitude, or pitch rate exceed ascent limits.'
            ],
            successCriteria: [
                'Vehicle is through max-Q with no structural, engine, or attitude loss.',
                'Pitch program is established downrange and apoapsis is climbing steadily.',
                'S-IC separates cleanly and S-II ignition is confirmed.',
                'Typical Earth-scale handoff: altitude roughly 50000-70000 m with speed roughly 2200-2800 m/s.'
            ],
            checklist: [
                {
                    id: 'tower-clear',
                    step: 'Hold vertical until tower clear, then begin a gentle roll and pitch program toward the launch azimuth.',
                    triggerHint: 'Altitude exceeds the launch tower or pad safety height.',
                    successCriteria: 'Vehicle remains stable and pitch starts moving smoothly away from 90 degrees.'
                },
                {
                    id: 'early-gravity-turn',
                    step: 'Pitch a few degrees downrange before the lower atmosphere thickens, keeping the prograde marker close to the nose.',
                    triggerHint: 'Altitude is above roughly 500-1500 m or speed is safely above pad-clearing speed.',
                    successCriteria: 'Angle of attack remains low and horizontal velocity begins increasing.'
                },
                {
                    id: 'max-q',
                    step: 'Throttle or pitch conservatively through maximum dynamic pressure if the vehicle begins to flex, overheat, or lose control authority.',
                    triggerHint: 'Dynamic pressure peaks, aero effects intensify, or the speed indicator climbs rapidly in dense air.',
                    successCriteria: 'No parts fail and the vehicle remains near prograde through max-Q.'
                },
                {
                    id: 'tower-jettison',
                    step: 'Jettison the launch escape tower after the atmosphere and abort mode allow tower-free flight.',
                    triggerHint: 'Past max-Q, above the lower atmosphere, or after the scripted tower jettison cue.',
                    successCriteria: 'Tower separates without striking the command module or upper stack.'
                },
                {
                    id: 'first-stage-guidance',
                    step: 'Continue pitching toward a shallow ascent while keeping time to apoapsis increasing rather than collapsing.',
                    triggerHint: 'Velocity and altitude are both rising and S-IC fuel is below about half.',
                    successCriteria: 'Apoapsis growth is smooth and the trajectory is not excessively vertical.'
                },
                {
                    id: 's-ic-cutoff',
                    step: 'Prepare for S-IC cutoff, stage separation, and ullage or direct S-II ignition.',
                    triggerHint: 'S-IC propellant is nearly depleted or planned cutoff velocity is reached.',
                    successCriteria: 'S-IC engines shut down, separation motors clear the spent stage, and S-II engines light.'
                }
            ],
            cautionCriteria: [
                'Large pitch inputs below max-Q can flip a tall Apollo stack.',
                'Holding vertical too long creates a high apoapsis with poor orbital velocity.'
            ]
        },
        's-ii-ascent': {
            id: 's-ii-ascent',
            label: 'S-II Ascent',
            body: 'Earth',
            vehicle: 'Saturn V S-II',
            objective: 'Carry the stack out of the atmosphere and shape the trajectory for S-IVB orbital insertion.',
            triggerHints: [
                'Show after S-IC separation and S-II engine start.',
                'Keep active while the vehicle is still suborbital and the S-II is the active propulsion stage.',
                'Warn if time to apoapsis falls too low or if pitch remains too steep.'
            ],
            successCriteria: [
                'S-II burns stably with the vehicle near prograde and outside the densest atmosphere.',
                'Apoapsis reaches the planned parking orbit altitude band.',
                'S-II separates cleanly and S-IVB has enough propellant for orbital insertion plus TLI if modeled as one stage.',
                'Typical Earth-scale handoff: apoapsis roughly 170000-210000 m and periapsis still below the surface.'
            ],
            checklist: [
                {
                    id: 's-ii-start',
                    step: 'Confirm S-II ignition, positive acceleration, and clean clearance from the S-IC interstage.',
                    triggerHint: 'Immediately after first-stage separation.',
                    successCriteria: 'Acceleration is positive and no spent-stage contact occurs.'
                },
                {
                    id: 'pitch-shallow',
                    step: 'Ease pitch toward the horizon while keeping the prograde marker inside the control authority envelope.',
                    triggerHint: 'Altitude is above the lower atmosphere and apoapsis is climbing.',
                    successCriteria: 'Horizontal speed becomes the dominant velocity component.'
                },
                {
                    id: 'atmosphere-exit',
                    step: 'Switch attention from aerodynamic survival to orbital energy once drag losses are low.',
                    triggerHint: 'Atmospheric pressure is low or the vehicle reaches the local space boundary.',
                    successCriteria: 'Throttle and pitch are chosen to manage apoapsis timing rather than aero load.'
                },
                {
                    id: 'apoapsis-target',
                    step: 'Guide the burn so apoapsis approaches the parking orbit target without racing far ahead of the vehicle.',
                    triggerHint: 'Apoapsis enters the planned parking altitude band.',
                    successCriteria: 'Time to apoapsis remains manageable for S-IVB circularization.'
                },
                {
                    id: 's-ii-cutoff',
                    step: 'Cut off and separate S-II when its job is complete or propellant is depleted.',
                    triggerHint: 'S-II fuel is nearly depleted or the ascent guidance calls for staging.',
                    successCriteria: 'S-II separates cleanly and S-IVB ignition is available.'
                },
                {
                    id: 's-ivb-ready',
                    step: 'Recenter attitude control, verify S-IVB engine status, and target orbital prograde.',
                    triggerHint: 'After S-II staging and before lighting S-IVB.',
                    successCriteria: 'S-IVB points near prograde with stable attitude and no unwanted rotation.'
                }
            ],
            cautionCriteria: [
                'Pitching too flat before apoapsis is established can cause re-entry before circularization.',
                'Burning too steeply forces the S-IVB to spend too much delta-v correcting the orbit.'
            ]
        },
        's-ivb-ascent': {
            id: 's-ivb-ascent',
            label: 'S-IVB Orbital Insertion',
            body: 'Earth',
            vehicle: 'Saturn V S-IVB',
            objective: 'Use the S-IVB to finish circularization into a stable parking orbit while preserving the TLI plan.',
            triggerHints: [
                'Show after S-II separation and S-IVB ignition or coast-to-circularization setup.',
                'Keep active until the parking orbit is stable.',
                'Warn if periapsis remains inside the atmosphere after the S-IVB orbital burn.'
            ],
            successCriteria: [
                'Spacecraft is in a stable Earth parking orbit.',
                'Periapsis is above the local atmosphere with a safe margin.',
                'Inclination and LAN are close enough for the planned lunar injection window.',
                'S-IVB has remaining propellant or an alternate TLI stage is available.'
            ],
            checklist: [
                {
                    id: 'insertion-burn',
                    step: 'Burn near prograde as the vehicle approaches apoapsis, trimming pitch to hold the nose on the horizon.',
                    triggerHint: 'Time to apoapsis is inside the planned circularization lead time.',
                    successCriteria: 'Periapsis rises steadily toward the target parking orbit altitude.'
                },
                {
                    id: 'apoapsis-management',
                    step: 'Throttle or coast as needed so the burn finishes near apoapsis instead of far before or after it.',
                    triggerHint: 'Time to apoapsis is drifting quickly during the insertion burn.',
                    successCriteria: 'Orbit is close to circular and the burn does not create an excessive apoapsis.'
                },
                {
                    id: 'parking-orbit-cutoff',
                    step: 'Cut off S-IVB when periapsis is safely above the atmosphere and the orbit period matches the TLI planning window.',
                    triggerHint: 'Periapsis crosses the safe parking altitude target.',
                    successCriteria: 'Orbit is stable for at least one coast and no immediate re-entry warning remains.'
                },
                {
                    id: 'systems-stabilize',
                    step: 'Set attitude hold, stop unnecessary engine gimbaling, and confirm the stack is no longer under ascent acceleration.',
                    triggerHint: 'After insertion cutoff.',
                    successCriteria: 'Vehicle rates are low and the navball is in orbital mode.'
                },
                {
                    id: 'orbit-readback',
                    step: 'Record apoapsis, periapsis, inclination, remaining S-IVB propellant, and current time to the lunar node.',
                    triggerHint: 'Once the map view shows a stable orbit.',
                    successCriteria: 'Parking orbit data is available for TLI planning.'
                }
            ],
            cautionCriteria: [
                'Do not separate the CSM from the S-IVB before TLI unless using a nonstandard profile.',
                'A barely suborbital parking trajectory may look safe briefly but will decay into the atmosphere.'
            ]
        },
        'parking-orbit': {
            id: 'parking-orbit',
            label: 'Earth Parking Orbit',
            body: 'Earth',
            vehicle: 'CSM/LM on S-IVB',
            objective: 'Check out the spacecraft, align guidance, and plan the trans-lunar injection burn.',
            triggerHints: [
                'Show after stable Earth parking orbit insertion.',
                'Show while the player is coasting to the TLI node or lunar transfer angle.',
                'Refresh after any maneuver node edit, orbit trim, or time warp.'
            ],
            successCriteria: [
                'Parking orbit remains stable and outside the atmosphere.',
                'A TLI maneuver is planned with a lunar encounter or free-return corridor.',
                'CSM and LM systems are healthy enough for separation, docking, and coast.',
                'S-IVB or selected TLI stage has enough delta-v margin for the burn.'
            ],
            checklist: [
                {
                    id: 'orbit-health',
                    step: 'Verify apoapsis, periapsis, inclination, period, and time to the next injection opportunity.',
                    triggerHint: 'At the start of the first parking orbit coast.',
                    successCriteria: 'Orbit readouts are stable and match the mission planning range.'
                },
                {
                    id: 'spacecraft-checkout',
                    step: 'Check CSM power, RCS, SPS status, docking port state, LM attachment, and crew transfer configuration if modeled.',
                    triggerHint: 'Before creating or executing the TLI maneuver.',
                    successCriteria: 'CSM can control, translate, dock, and perform later SPS burns.'
                },
                {
                    id: 'tli-node',
                    step: 'Create the TLI maneuver at the correct ejection angle so the projected path reaches the Moon.',
                    triggerHint: 'Moon lead angle, map encounter geometry, or scripted TLI mark becomes available.',
                    successCriteria: 'Map view predicts lunar SOI entry, free-return behavior, or an acceptable perilune.'
                },
                {
                    id: 'burn-timing',
                    step: 'Compute burn duration and plan to start half the burn time before the node.',
                    triggerHint: 'After the TLI node has a final delta-v estimate.',
                    successCriteria: 'Countdown marker accounts for finite burn time and steering losses.'
                },
                {
                    id: 'attitude-tli',
                    step: 'Orient to the maneuver vector or prograde target and settle attitude rates before ignition.',
                    triggerHint: 'Inside the final minute before TLI burn start.',
                    successCriteria: 'Attitude error is small and the stack is not wobbling.'
                },
                {
                    id: 'commit-tli',
                    step: 'Commit to TLI only after confirming no active re-entry risk, no wrong control point, and no staging hazard.',
                    triggerHint: 'At final go/no-go before the burn.',
                    successCriteria: 'The mission can transition to TLI without reconfiguring the stack.'
                }
            ],
            cautionCriteria: [
                'A TLI node made from the wrong side of the planet can miss the Moon by a full orbit.',
                'Time warp can hide slow attitude drift; settle the stack before burn start.'
            ]
        },
        tli: {
            id: 'tli',
            label: 'Trans-Lunar Injection',
            body: 'Earth',
            vehicle: 'S-IVB with CSM/LM',
            objective: 'Burn from parking orbit onto a lunar transfer trajectory with a safe coast corridor.',
            triggerHints: [
                'Show at the planned TLI ignition time.',
                'Keep active until the burn is cut off and the map confirms a lunar transfer.',
                'Warn if the maneuver marker diverges from the burn attitude or if the predicted perilune moves out of range.'
            ],
            successCriteria: [
                'Projected trajectory enters the Moon sphere of influence or reaches the planned free-return path.',
                'Perilune altitude is high enough for correction and LOI setup.',
                'The S-IVB burn is complete without consuming CSM return reserves.',
                'Vehicle is stable and ready for CSM separation.'
            ],
            checklist: [
                {
                    id: 'ignite-s-ivb',
                    step: 'Ignite S-IVB on the maneuver vector, holding attitude tightly through the long burn.',
                    triggerHint: 'Burn countdown reaches planned start time.',
                    successCriteria: 'Delta-v begins counting down and projected apogee expands beyond Earth orbit.'
                },
                {
                    id: 'track-encounter',
                    step: 'Watch the map view for lunar encounter, perilune, and free-return cues as the burn progresses.',
                    triggerHint: 'Projected apoapsis approaches lunar distance.',
                    successCriteria: 'A lunar SOI patch or valid transfer corridor appears before cutoff.'
                },
                {
                    id: 'trim-cutoff',
                    step: 'Throttle down or pulse near the end of the burn to avoid overshooting the target perilune.',
                    triggerHint: 'Remaining maneuver delta-v is below fine-control threshold.',
                    successCriteria: 'Final trajectory reaches the Moon with correction-friendly error.'
                },
                {
                    id: 'post-burn-state',
                    step: 'Save the post-TLI state vector, remaining propellant, and estimated time to lunar SOI.',
                    triggerHint: 'Immediately after cutoff.',
                    successCriteria: 'Mission display shows transfer orbit data and no immediate escape or impact warning.'
                },
                {
                    id: 'separation-ready',
                    step: 'Prepare CSM separation by safing S-IVB thrust, confirming docking port control, and setting CSM RCS ready.',
                    triggerHint: 'After TLI cutoff and before CSM extraction maneuvers.',
                    successCriteria: 'CSM can separate without recontacting the S-IVB or LM adapter.'
                }
            ],
            cautionCriteria: [
                'Do not chase the maneuver node after the encounter appears if small attitude errors are producing large perilune swings.',
                'An overburn can turn a free return into a high-energy miss that requires large midcourse correction.'
            ]
        },
        'transposition-docking': {
            id: 'transposition-docking',
            label: 'Transposition and Docking',
            body: 'Earth-Moon transfer',
            vehicle: 'CSM and LM',
            objective: 'Separate the CSM, turn around, dock with the LM, and extract it from the S-IVB adapter.',
            triggerHints: [
                'Show after TLI cutoff once the stack is safely coasting.',
                'Keep active until the CSM and LM are docked and clear of the spent S-IVB.',
                'Warn if closure rate or alignment exceeds docking safety limits.'
            ],
            successCriteria: [
                'CSM is docked to the LM with the correct port orientation.',
                'Combined CSM/LM is extracted and drifting safely away from the S-IVB.',
                'Docking loads, relative velocity, and attitude rates remain within safe limits.',
                'The transfer trajectory remains acceptable after docking maneuvers.'
            ],
            checklist: [
                {
                    id: 'csm-separate',
                    step: 'Separate the CSM from the S-IVB/LM adapter and translate forward to a safe standoff distance.',
                    triggerHint: 'TLI burn is complete and the CSM is configured for independent control.',
                    successCriteria: 'CSM clears the adapter without collision and relative motion is controlled.'
                },
                {
                    id: 'turnaround',
                    step: 'Pitch or yaw 180 degrees to face the LM docking target.',
                    triggerHint: 'CSM is clear of the adapter and rotation authority is stable.',
                    successCriteria: 'CSM docking port is pointed at the LM docking port with low attitude rate.'
                },
                {
                    id: 'approach-lm',
                    step: 'Translate toward the LM along the docking axis using short RCS pulses.',
                    triggerHint: 'Docking ports are aligned and distance is closing slowly.',
                    successCriteria: 'Closure rate is low and lateral drift is near zero.'
                },
                {
                    id: 'soft-dock',
                    step: 'Contact the LM docking port gently and allow capture.',
                    triggerHint: 'Range is within final docking distance and alignment is inside tolerance.',
                    successCriteria: 'Docking capture occurs without bounce, spin, or port damage.'
                },
                {
                    id: 'extract-lm',
                    step: 'Separate LM adapter panels or decouplers and back the docked CSM/LM away from the S-IVB.',
                    triggerHint: 'Docking is confirmed and adapter release is armed.',
                    successCriteria: 'CSM/LM stack is free, stable, and clear of all spent-stage geometry.'
                },
                {
                    id: 's-ivb-disposal',
                    step: 'Command or verify S-IVB disposal so it will not recontact the spacecraft during coast.',
                    triggerHint: 'After LM extraction and safe separation distance.',
                    successCriteria: 'Spent stage trajectory diverges from the crewed stack.'
                }
            ],
            cautionCriteria: [
                'Docking at high time warp or high closure rate can damage ports or induce tumble.',
                'Do not point the active control reference from the LM until docking is complete unless the scenario requires it.'
            ]
        },
        'lunar-coast': {
            id: 'lunar-coast',
            label: 'Lunar Coast',
            body: 'Earth-Moon transfer',
            vehicle: 'CSM/LM',
            objective: 'Navigate the coast, perform small corrections, and arrive at the Moon ready for LOI.',
            triggerHints: [
                'Show after transposition, docking, and LM extraction are complete.',
                'Refresh at each midcourse correction opportunity and again before lunar SOI entry.',
                'Warn if predicted perilune is too low, too high, retrograde, or impact-bound.'
            ],
            successCriteria: [
                'Predicted lunar arrival has an LOI-friendly perilune altitude and inclination.',
                'Midcourse corrections are complete with minimal CSM propellant cost.',
                'CSM/LM systems remain powered, thermally stable, and under attitude control.',
                'LOI burn plan is loaded before lunar periapsis.'
            ],
            checklist: [
                {
                    id: 'state-vector-update',
                    step: 'Update the trajectory solution using map data, navigation sightings, or scripted state-vector refresh.',
                    triggerHint: 'Shortly after docking and after each major coast segment.',
                    successCriteria: 'Predicted Moon encounter and perilune values are current.'
                },
                {
                    id: 'mcc-plan',
                    step: 'Plan midcourse correction burns only as large as needed to tune perilune and return margin.',
                    triggerHint: 'Perilune target is outside the mission tolerance band.',
                    successCriteria: 'Correction delta-v is small and improves the LOI setup.'
                },
                {
                    id: 'mcc-execute',
                    step: 'Execute correction burns with SPS or RCS according to size, then recheck the encounter.',
                    triggerHint: 'At each planned MCC time.',
                    successCriteria: 'Post-burn trajectory preserves lunar arrival and Earth-return options.'
                },
                {
                    id: 'thermal-roll',
                    step: 'Maintain slow passive thermal control or equivalent attitude mode if the simulator models heating and power.',
                    triggerHint: 'During long coast segments without active burns.',
                    successCriteria: 'Power, heat, and attitude remain within nominal limits.'
                },
                {
                    id: 'loi-prep',
                    step: 'Configure SPS, ullage, crew seats, maneuver node, and retrograde attitude for lunar orbit insertion.',
                    triggerHint: 'Before entering lunar SOI or several hours before perilune.',
                    successCriteria: 'LOI burn time, duration, attitude, and expected captured orbit are known.'
                }
            ],
            cautionCriteria: [
                'Large midcourse burns late in the coast can erase return margin.',
                'Arriving with a very low perilune can leave too little time to stabilize before LOI.'
            ]
        },
        loi: {
            id: 'loi',
            label: 'Lunar Orbit Insertion',
            body: 'Moon',
            vehicle: 'CSM/LM',
            objective: 'Use the CSM SPS to capture into lunar orbit and circularize for landing operations.',
            triggerHints: [
                'Show after lunar SOI entry and before perilune.',
                'Keep active through LOI-1 capture and any LOI-2 circularization trim.',
                'Warn if SPS attitude, burn duration, or perilune altitude is outside limits.'
            ],
            successCriteria: [
                'Spacecraft is bound to the Moon after LOI-1.',
                'Final orbit is suitable for LM undock and landing site phasing.',
                'SPS propellant reserve remains sufficient for TEI plus contingency margin.',
                'CSM/LM stack is stable, powered, and in lunar orbital reference mode.'
            ],
            checklist: [
                {
                    id: 'loi-attitude',
                    step: 'Point retrograde at lunar perilune and settle attitude before ignition.',
                    triggerHint: 'Inside the final LOI attitude hold period.',
                    successCriteria: 'Retrograde error is small and attitude rates are damped.'
                },
                {
                    id: 'loi-ignition',
                    step: 'Ignite SPS at the planned time and hold retrograde through capture.',
                    triggerHint: 'LOI burn countdown reaches start time.',
                    successCriteria: 'Lunar apoapsis drops and the path becomes capture-bound.'
                },
                {
                    id: 'capture-confirm',
                    step: 'Confirm the trajectory changes from flyby or escape to a bound lunar orbit.',
                    triggerHint: 'During the final portion of LOI-1.',
                    successCriteria: 'Map view shows a closed lunar orbit with safe perilune.'
                },
                {
                    id: 'loi-cutoff',
                    step: 'Cut off at the target apoapsis and avoid overburning into a low impact orbit.',
                    triggerHint: 'Apoapsis reaches the planned initial lunar orbit value.',
                    successCriteria: 'Orbit is bound and does not intersect terrain.'
                },
                {
                    id: 'circularization-trim',
                    step: 'Perform LOI-2 or trim burns to reach the landing preparation orbit.',
                    triggerHint: 'After one or more lunar coast arcs, depending on the mission profile.',
                    successCriteria: 'Orbit altitude, inclination, and landing-site phasing are within tolerance.'
                },
                {
                    id: 'post-loi-checkout',
                    step: 'Verify SPS reserve, CSM consumables, LM readiness, and next landing opportunity.',
                    triggerHint: 'After the orbit is stable.',
                    successCriteria: 'Mission is go for LM activation and undock or go for lunar orbit operations.'
                }
            ],
            cautionCriteria: [
                'An underburn may leave the spacecraft on a lunar flyby with little time for recovery.',
                'An overburn at perilune can drive perilune into terrain before the next orbit.'
            ]
        },
        'lm-undock': {
            id: 'lm-undock',
            label: 'LM Undock and Descent Orbit Setup',
            body: 'Moon',
            vehicle: 'CSM and LM',
            objective: 'Activate the LM, separate from the CSM, and prepare the descent trajectory for PDI.',
            triggerHints: [
                'Show in stable lunar orbit after landing site phasing is acceptable.',
                'Keep active from LM activation through safe undock and descent orbit insertion if used.',
                'Warn if the LM control point, landing legs, gear, or descent engine are not configured.'
            ],
            successCriteria: [
                'LM is crewed, powered, controlled from the correct point, and independently maneuverable.',
                'CSM remains in a safe parking orbit with a clear rendezvous plan.',
                'LM is separated, inspected, and on a descent orbit or PDI-ready approach.',
                'Abort and rendezvous targets are loaded before descent commitment.'
            ],
            checklist: [
                {
                    id: 'lm-activation',
                    step: 'Power the LM, enable descent guidance, verify landing radar or altitude source, and check descent engine throttle.',
                    triggerHint: 'Before crew transfer or undock.',
                    successCriteria: 'LM can hold attitude and throttle the descent engine.'
                },
                {
                    id: 'crew-transfer',
                    step: 'Transfer landing crew to the LM and leave the command module pilot or CSM control ready in orbit.',
                    triggerHint: 'LM systems are alive and docking tunnel is open.',
                    successCriteria: 'LM and CSM crew assignments match the mission plan.'
                },
                {
                    id: 'undock-config',
                    step: 'Set LM as the active vessel or control point, arm RCS, retract or safe docking hardware, and set CSM as rendezvous target.',
                    triggerHint: 'Immediately before undocking.',
                    successCriteria: 'LM navball and target markers reflect the correct vehicle and target.'
                },
                {
                    id: 'separate-lm',
                    step: 'Undock and translate away with small RCS pulses while the CSM maintains a predictable attitude.',
                    triggerHint: 'Docking clamps release.',
                    successCriteria: 'Relative velocity is controlled and both spacecraft remain clear.'
                },
                {
                    id: 'inspection',
                    step: 'Pause at stationkeeping distance to inspect landing legs, descent engine, RCS balance, and CSM orbit.',
                    triggerHint: 'LM reaches safe separation distance.',
                    successCriteria: 'No visible collision damage, stuck gear, or missing landing system is detected.'
                },
                {
                    id: 'doi-or-pdi-setup',
                    step: 'Perform descent orbit insertion or set the direct PDI approach so perilune occurs near the landing site.',
                    triggerHint: 'CSM/LM phasing and landing site geometry are correct.',
                    successCriteria: 'LM reaches a PDI-ready perilune and the CSM remains recoverable for rendezvous.'
                }
            ],
            cautionCriteria: [
                'Undocking before setting the CSM as target makes rendezvous setup harder under time pressure.',
                'Forgetting to control from the LM can invert throttle and attitude expectations during descent.'
            ]
        },
        'pdi-descent': {
            id: 'pdi-descent',
            label: 'PDI and Powered Descent',
            body: 'Moon',
            vehicle: 'LM descent stage',
            objective: 'Brake from descent orbit, manage horizontal and vertical velocity, and land with reserve fuel.',
            triggerHints: [
                'Show at powered descent initiation or when the LM reaches descent perilune.',
                'Keep active until touchdown, engine shutdown, and vehicle safing.',
                'Warn if vertical speed, horizontal speed, slope, altitude, or fuel reserve is outside landing limits.'
            ],
            successCriteria: [
                'LM touches down upright at a safe vertical and horizontal speed.',
                'Descent engine is shut down and landing legs are loaded without bounce or tipover.',
                'Landing site is within acceptable mission range and has enough slope clearance.',
                'Fuel, power, and crew state are sufficient for surface stay and ascent.'
            ],
            checklist: [
                {
                    id: 'pdi-commit',
                    step: 'Ignite the descent engine at PDI and confirm throttle response, guidance mode, and abort availability.',
                    triggerHint: 'LM reaches planned PDI time near descent perilune.',
                    successCriteria: 'Engine produces thrust and descent trajectory begins reducing orbital energy.'
                },
                {
                    id: 'braking-phase',
                    step: 'Hold mostly retrograde to kill horizontal speed while preserving altitude margin.',
                    triggerHint: 'LM is high and fast with landing site still downrange.',
                    successCriteria: 'Horizontal speed drops steadily without excessive vertical sink.'
                },
                {
                    id: 'approach-phase',
                    step: 'Pitch up gradually so the landing site moves into view and vertical speed stays manageable.',
                    triggerHint: 'Altitude and velocity are low enough to transition from orbital braking to approach.',
                    successCriteria: 'LM is descending toward the site with controlled sink rate and visible terrain.'
                },
                {
                    id: 'landing-radar',
                    step: 'Confirm radar altitude or terrain altitude, then switch descent decisions from sea-level altitude to true height above ground.',
                    triggerHint: 'Terrain rises in view or radar altitude becomes valid.',
                    successCriteria: 'Guidance uses true surface clearance for final descent.'
                },
                {
                    id: 'hover-and-translate',
                    step: 'Use brief hover and translation to avoid boulders, steep slopes, crater rims, or high terrain.',
                    triggerHint: 'Final landing zone is unsafe or not aligned beneath the LM.',
                    successCriteria: 'LM reaches a safe touchdown point without exhausting hover fuel.'
                },
                {
                    id: 'final-descent',
                    step: 'Reduce vertical speed below the touchdown limit, null lateral drift, and keep the LM upright.',
                    triggerHint: 'Altitude is below final approach height.',
                    successCriteria: 'Vertical speed is roughly 2 m/s or less and horizontal speed is near zero at contact.'
                },
                {
                    id: 'touchdown-safing',
                    step: 'Cut the descent engine at touchdown, hold attitude until settled, and safe descent systems.',
                    triggerHint: 'Contact lights, gear compression, or landed state appears.',
                    successCriteria: 'LM remains upright, engine is off, and the surface phase can begin.'
                }
            ],
            cautionCriteria: [
                'A perfect target landing is less important than fuel margin and a stable touchdown.',
                'Hovering high above the surface burns fuel quickly and can leave no reserve for abort.'
            ]
        },
        surface: {
            id: 'surface',
            label: 'Lunar Surface',
            body: 'Moon',
            vehicle: 'LM on surface',
            objective: 'Safe the landed LM, complete the surface timeline, and prepare a precise ascent back to the CSM.',
            triggerHints: [
                'Show after touchdown and descent engine shutdown.',
                'Keep active through EVA, science, resource checks, and ascent planning.',
                'Warn if ascent stage resources, CSM phasing, or launch window are not ready.'
            ],
            successCriteria: [
                'Landing is logged and the LM is stable for the planned surface stay.',
                'Surface objectives are complete or explicitly skipped.',
                'Ascent stage, rendezvous target, and launch time are configured.',
                'CSM orbit and LM launch window support rendezvous.'
            ],
            checklist: [
                {
                    id: 'landed-state',
                    step: 'Confirm landed status, slope, landing leg load, final coordinates, and remaining descent fuel.',
                    triggerHint: 'Immediately after touchdown safing.',
                    successCriteria: 'LM is upright and not sliding, bouncing, or tipping.'
                },
                {
                    id: 'post-landing-safe',
                    step: 'Safe descent engine, disable unnecessary RCS, and stabilize power and thermal state.',
                    triggerHint: 'After the LM settles on the surface.',
                    successCriteria: 'No resource drains threaten the surface stay or ascent.'
                },
                {
                    id: 'surface-ops',
                    step: 'Run EVA, sample collection, experiments, flag placement, rover use, or mission-specific surface goals.',
                    triggerHint: 'LM is safe and crew can leave the vehicle.',
                    successCriteria: 'Required surface objectives are marked complete.'
                },
                {
                    id: 'ascent-stage-check',
                    step: 'Verify ascent fuel, engine, RCS, batteries, docking port, crew seats, and staging for ascent stage separation.',
                    triggerHint: 'Before closing the surface timeline.',
                    successCriteria: 'LM ascent stage can separate, launch, maneuver, and dock.'
                },
                {
                    id: 'rendezvous-plan',
                    step: 'Set the CSM as target and choose a launch time that places the LM into a chase orbit.',
                    triggerHint: 'CSM approaches the planned orbital phasing position.',
                    successCriteria: 'Launch guidance predicts an orbit close to the CSM plane and altitude.'
                },
                {
                    id: 'crew-ingress',
                    step: 'Return crew to the LM, stow samples, close hatches, and set control from the ascent stage.',
                    triggerHint: 'Final minutes before ascent launch.',
                    successCriteria: 'All returning crew and required cargo are aboard the ascent stage.'
                }
            ],
            cautionCriteria: [
                'Launching without target selection makes orbital rendezvous much harder.',
                'A long surface stay can drain power or life-support resources if time warp is not monitored.'
            ]
        },
        'lm-ascent': {
            id: 'lm-ascent',
            label: 'LM Ascent',
            body: 'Moon',
            vehicle: 'LM ascent stage',
            objective: 'Launch from the surface into a chase orbit that supports rendezvous with the CSM.',
            triggerHints: [
                'Show when the ascent stage is armed and the launch window opens.',
                'Keep active until the LM is in a stable lunar orbit with the CSM targeted.',
                'Warn if launch heading, control point, or staging still references the descent stage.'
            ],
            successCriteria: [
                'Ascent stage reaches stable lunar orbit without terrain impact.',
                'Orbital plane, apoapsis, and periapsis support a near-term CSM rendezvous.',
                'LM has enough RCS and main propellant for phasing, terminal approach, and docking.',
                'CSM remains selected as the target.'
            ],
            checklist: [
                {
                    id: 'stage-separation',
                    step: 'Separate the ascent stage cleanly from the descent stage and ignite the ascent engine.',
                    triggerHint: 'Launch command is given from the lunar surface.',
                    successCriteria: 'Ascent stage clears the descent stage with positive vertical speed.'
                },
                {
                    id: 'ascent-pitch',
                    step: 'Pitch downrange on the planned heading while avoiding terrain and excessive vertical climb.',
                    triggerHint: 'The ascent stage is clear of the landing site.',
                    successCriteria: 'Horizontal speed builds and flight path stays above local terrain.'
                },
                {
                    id: 'plane-control',
                    step: 'Steer to match the CSM orbital plane as early as practical.',
                    triggerHint: 'Target relative inclination is visible.',
                    successCriteria: 'Relative inclination trends toward zero without large fuel penalty.'
                },
                {
                    id: 'orbit-insertion',
                    step: 'Circularize or shape the orbit near the CSM altitude, leaving phasing room for rendezvous.',
                    triggerHint: 'Apoapsis reaches the planned rendezvous orbit altitude.',
                    successCriteria: 'Perilune is safely above terrain and the LM is not on an escape or impact path.'
                },
                {
                    id: 'post-ascent-targeting',
                    step: 'Review closest approach markers, relative speed, phase angle, and next maneuver opportunity.',
                    triggerHint: 'LM orbit is stable.',
                    successCriteria: 'A rendezvous plan exists within available propellant and life-support limits.'
                }
            ],
            cautionCriteria: [
                'A vertical launch wastes ascent propellant and can miss the CSM phasing window.',
                'Orbiting too low gives little time to recover from targeting mistakes.'
            ]
        },
        rendezvous: {
            id: 'rendezvous',
            label: 'Lunar Rendezvous and Docking',
            body: 'Moon',
            vehicle: 'LM ascent stage and CSM',
            objective: 'Phase, intercept, brake, and dock the LM with the CSM before returning the crew.',
            triggerHints: [
                'Show once the LM ascent stage is in lunar orbit with the CSM targeted.',
                'Keep active through phasing, terminal intercept, docking, crew transfer, and LM jettison.',
                'Warn if closest approach distance, relative inclination, or terminal speed is outside docking limits.'
            ],
            successCriteria: [
                'LM docks with the CSM at safe closure speed and alignment.',
                'Crew and surface cargo transfer to the CSM.',
                'LM ascent stage is jettisoned or parked per mission plan.',
                'CSM remains in a TEI-capable lunar orbit with adequate SPS propellant.'
            ],
            checklist: [
                {
                    id: 'phasing-burn',
                    step: 'Use small prograde or retrograde burns to create a close approach with the CSM.',
                    triggerHint: 'Initial LM orbit is stable and closest approach data is available.',
                    successCriteria: 'Closest approach distance falls into terminal rendezvous range.'
                },
                {
                    id: 'plane-trim',
                    step: 'Correct relative inclination at an ascending or descending node if needed.',
                    triggerHint: 'Relative inclination is large enough to spoil intercept.',
                    successCriteria: 'Plane error is small before terminal phase initiation.'
                },
                {
                    id: 'terminal-initiation',
                    step: 'Burn toward the target or along the planned intercept vector to begin terminal approach.',
                    triggerHint: 'Phasing places the LM near the correct range and timing.',
                    successCriteria: 'Range is closing and relative velocity remains controllable.'
                },
                {
                    id: 'braking',
                    step: 'Burn target retrograde to reduce closure speed as range decreases.',
                    triggerHint: 'Relative speed exceeds safe approach speed for current range.',
                    successCriteria: 'Closure rate is low enough for manual stationkeeping.'
                },
                {
                    id: 'stationkeeping',
                    step: 'Hold near the CSM, align docking ports, and switch control references as needed.',
                    triggerHint: 'LM reaches close visual range.',
                    successCriteria: 'Relative position is stable with low drift and low rotation.'
                },
                {
                    id: 'dock-and-transfer',
                    step: 'Dock gently, transfer crew and samples, then safe or jettison the LM ascent stage.',
                    triggerHint: 'Docking alignment and closure speed are inside tolerance.',
                    successCriteria: 'Crew is aboard the CSM and the LM is no longer required for return.'
                }
            ],
            cautionCriteria: [
                'Chasing the target directly from long range can create a high-speed flyby.',
                'Using the CSM SPS for routine rendezvous corrections can consume TEI margin.'
            ]
        },
        tei: {
            id: 'tei',
            label: 'Trans-Earth Injection',
            body: 'Moon',
            vehicle: 'CSM',
            objective: 'Depart lunar orbit on an Earth-return trajectory with a survivable entry corridor.',
            triggerHints: [
                'Show after rendezvous cleanup or after lunar orbit mission objectives are complete.',
                'Keep active through TEI burn and post-burn Earth-return verification.',
                'Warn if SPS reserve, burn attitude, or projected Earth periapsis is outside return limits.'
            ],
            successCriteria: [
                'CSM leaves lunar orbit on an Earth-intercept trajectory.',
                'Projected Earth periapsis or entry interface lies inside the recovery corridor.',
                'SPS reserve remains available for at least one entry corridor trim if possible.',
                'Service module, command module, crew, and recovery systems are configured for coast home.'
            ],
            checklist: [
                {
                    id: 'tei-window',
                    step: 'Choose a TEI opportunity that sends the CSM from lunar orbit toward Earth with acceptable arrival timing.',
                    triggerHint: 'Lunar surface crew is back aboard or lunar orbit objectives are complete.',
                    successCriteria: 'Maneuver prediction intersects Earth atmosphere or planned entry interface.'
                },
                {
                    id: 'sps-config',
                    step: 'Configure SPS, power, guidance, and attitude control for the return burn.',
                    triggerHint: 'Before final TEI attitude maneuver.',
                    successCriteria: 'CSM can complete the burn without LM or ascent-stage dependencies.'
                },
                {
                    id: 'tei-attitude',
                    step: 'Point to the TEI maneuver vector, usually prograde in lunar orbit at the planned departure point.',
                    triggerHint: 'Inside final TEI setup time.',
                    successCriteria: 'Attitude error is low and the burn vector is stable.'
                },
                {
                    id: 'tei-burn',
                    step: 'Ignite SPS and burn until the lunar orbit opens into an Earth-return path.',
                    triggerHint: 'TEI countdown reaches planned ignition.',
                    successCriteria: 'Trajectory exits lunar SOI and Earth periapsis appears in the target corridor.'
                },
                {
                    id: 'tei-trim',
                    step: 'Fine tune the burn or add a small correction so the return path does not skip out or impact too steeply.',
                    triggerHint: 'Projected Earth periapsis is visible after TEI cutoff.',
                    successCriteria: 'Entry corridor is reachable with small remaining correction delta-v.'
                },
                {
                    id: 'return-coast-config',
                    step: 'Set up passive thermal control, entry power reserves, and service module consumables for the coast home.',
                    triggerHint: 'After TEI trajectory confirmation.',
                    successCriteria: 'CSM is stable for trans-Earth coast and entry preparation.'
                }
            ],
            cautionCriteria: [
                'A TEI underburn can leave the CSM captured by the Moon or on a poor Earth intercept.',
                'A very low Earth periapsis may be unrecoverable even if the map shows an encounter.'
            ]
        },
        'entry-splashdown': {
            id: 'entry-splashdown',
            label: 'Entry and Splashdown',
            body: 'Earth',
            vehicle: 'Command module',
            objective: 'Trim the entry corridor, separate the service module, survive re-entry, and recover under parachutes.',
            triggerHints: [
                'Show when the CSM is on trans-Earth coast and Earth periapsis or entry interface is known.',
                'Refresh before final corridor correction, service module separation, entry interface, drogue deploy, main deploy, and splashdown.',
                'Warn if heat shield orientation, periapsis, parachute state, or landing zone is unsafe.'
            ],
            successCriteria: [
                'Command module enters heat-shield-first within the safe corridor.',
                'Service module is separated before atmospheric interface.',
                'Peak heating and g-load remain survivable.',
                'Drogue and main parachutes deploy in safe speed and altitude ranges.',
                'Command module splashes down or lands safely with crew alive.'
            ],
            checklist: [
                {
                    id: 'corridor-check',
                    step: 'Check projected Earth periapsis, entry angle, landing zone, and available correction delta-v.',
                    triggerHint: 'During trans-Earth coast after the final navigation update.',
                    successCriteria: 'Predicted entry is neither a skip-out nor an overly steep impact.'
                },
                {
                    id: 'entry-correction',
                    step: 'Perform a small corridor correction if the entry interface is outside the target band.',
                    triggerHint: 'Periapsis or entry angle is outside mission tolerance.',
                    successCriteria: 'Projected path reaches the recovery corridor with minimal residual error.'
                },
                {
                    id: 'cm-config',
                    step: 'Power the command module for entry, secure crew, arm parachutes, and verify heat shield integrity.',
                    triggerHint: 'Before service module separation.',
                    successCriteria: 'Command module can control attitude and deploy recovery systems independently.'
                },
                {
                    id: 'sm-separation',
                    step: 'Separate the service module and orient the command module heat shield retrograde.',
                    triggerHint: 'Entry interface is approaching and service module is no longer required.',
                    successCriteria: 'Service module drifts clear and heat shield points into the velocity vector.'
                },
                {
                    id: 'entry-control',
                    step: 'Hold entry attitude through plasma heating, using lift or bank only if the simulator models it.',
                    triggerHint: 'Atmospheric heating begins or altitude crosses entry interface.',
                    successCriteria: 'Command module remains stable and survives peak heating.'
                },
                {
                    id: 'drogue-deploy',
                    step: 'Deploy drogues when speed and altitude are inside safe limits.',
                    triggerHint: 'Dynamic pressure is low enough and the command module has slowed from hypersonic flight.',
                    successCriteria: 'Drogues deploy without tearing off and stabilize descent.'
                },
                {
                    id: 'main-deploy',
                    step: 'Deploy main parachutes at the planned altitude and confirm full canopy inflation.',
                    triggerHint: 'Altitude and speed enter the main parachute deployment envelope.',
                    successCriteria: 'Descent rate falls to a safe splashdown or landing value.'
                },
                {
                    id: 'splashdown',
                    step: 'Touch down, cut parachutes if needed, safe systems, and mark recovery complete.',
                    triggerHint: 'Altitude reaches zero or water contact is detected.',
                    successCriteria: 'Crew survives and the mission is complete.'
                }
            ],
            cautionCriteria: [
                'Do not stage parachutes with the service module still attached unless the craft is specifically built for it.',
                'A command module that is not retrograde at entry can burn up even on a perfect corridor.'
            ]
        }
    }
};
