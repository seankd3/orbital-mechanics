"use strict";

window.APOLLO_FAILURES = {
  version: 1,
  schema: {
    id: "Stable failure identifier for save files and event logs.",
    severity: "info | caution | warning | critical",
    phases: "Mission phases where the failure can be considered.",
    trigger: "Human-readable condition plus structured metadata for later event logic.",
    alert: "Player-facing text to show when the failure is raised.",
    recoveryActions: "Available actions or objectives that can clear or mitigate the failure."
  },
  severityLevels: {
    info: {
      label: "Advisory",
      missionImpact: "Temporary distraction or minor performance penalty."
    },
    caution: {
      label: "Caution",
      missionImpact: "Requires timely correction to preserve mission margins."
    },
    warning: {
      label: "Warning",
      missionImpact: "Threatens a major objective if not corrected quickly."
    },
    critical: {
      label: "Critical",
      missionImpact: "Threatens crew survival or mission loss."
    }
  },
  failures: [
    {
      id: "burn-overburn",
      title: "Overburn",
      severity: "warning",
      systems: ["guidance", "propulsion", "trajectory"],
      phases: ["tli", "loi", "tei", "course-correction", "rendezvous"],
      trigger: {
        description: "Planned burn is exceeded enough to push the spacecraft outside the acceptable delta-v corridor.",
        eventLogic: {
          watch: ["burn.actualDeltaV", "burn.targetDeltaV", "trajectory.corridorError"],
          condition: "actualDeltaV > targetDeltaV + toleranceDeltaV",
          suggestedThresholds: {
            cautionDeltaVErrorMps: 2,
            warningDeltaVErrorMps: 8,
            criticalCorridorErrorKm: 25
          },
          debounceSeconds: 1,
          clearCondition: "A corrective burn returns corridorError below the active mission limit."
        }
      },
      alert: {
        headline: "OVERBURN DETECTED",
        body: "Velocity is high for the planned maneuver. Update guidance and prepare a corrective burn."
      },
      recoveryActions: [
        "Recompute the trajectory solution.",
        "Perform a short retrograde trim burn.",
        "Delay the next planned burn until the state vector is updated.",
        "Accept a degraded orbit only if the mission rules allow it."
      ]
    },
    {
      id: "burn-underburn",
      title: "Underburn",
      severity: "warning",
      systems: ["guidance", "propulsion", "trajectory"],
      phases: ["tli", "loi", "tei", "course-correction", "rendezvous"],
      trigger: {
        description: "Planned burn ends below the target impulse, leaving the spacecraft short of the required trajectory.",
        eventLogic: {
          watch: ["burn.actualDeltaV", "burn.targetDeltaV", "burn.shutdownReason", "trajectory.periapsisKm"],
          condition: "actualDeltaV < targetDeltaV - toleranceDeltaV",
          suggestedThresholds: {
            cautionDeltaVErrorMps: -2,
            warningDeltaVErrorMps: -8,
            criticalPeriapsisKm: 80
          },
          debounceSeconds: 1,
          clearCondition: "A completion or trim burn restores the target orbit or transfer corridor."
        }
      },
      alert: {
        headline: "UNDERBURN DETECTED",
        body: "Velocity is low for the planned maneuver. Confirm engine status and complete the burn plan."
      },
      recoveryActions: [
        "Check engine availability and restart constraints.",
        "Use remaining SPS or RCS capability for a trim burn.",
        "Recalculate the next maneuver against current fuel margins.",
        "Abort the objective if the resulting orbit is below safe limits."
      ]
    },
    {
      id: "propellant-low-service-module",
      title: "Low Service Module Propellant",
      severity: "caution",
      systems: ["propulsion", "mission-planning"],
      phases: ["translunar-coast", "lunar-orbit", "transearth-coast", "rendezvous"],
      trigger: {
        description: "Remaining SPS or RCS propellant falls below the reserve needed for planned maneuvers and contingency control.",
        eventLogic: {
          watch: ["propellant.spsPercent", "propellant.rcsPercent", "mission.requiredReservePercent"],
          condition: "spsPercent < requiredReservePercent || rcsPercent < requiredReservePercent",
          suggestedThresholds: {
            cautionReservePercent: 18,
            warningReservePercent: 10,
            criticalReservePercent: 5
          },
          debounceSeconds: 5,
          clearCondition: "Mission plan is revised so available propellant exceeds required reserve."
        }
      },
      alert: {
        headline: "PROPELLANT RESERVE LOW",
        body: "Propellant margins are below the flight plan reserve. Reduce maneuvering and revise the burn schedule."
      },
      recoveryActions: [
        "Cancel nonessential attitude maneuvers.",
        "Use minimum-impulse trim burns.",
        "Select a lower-cost return or rendezvous profile.",
        "Declare an abort if reserves cannot cover mandatory burns."
      ]
    },
    {
      id: "entry-corridor-shallow",
      title: "Entry Corridor Too Shallow",
      severity: "critical",
      systems: ["guidance", "thermal", "reentry"],
      phases: ["transearth-coast", "entry-interface"],
      trigger: {
        description: "Predicted entry angle is too shallow, risking skip-out or a landing far outside recovery range.",
        eventLogic: {
          watch: ["entry.predictedFlightPathAngleDeg", "entry.targetMinAngleDeg", "entry.landingRangeErrorKm"],
          condition: "predictedFlightPathAngleDeg > targetMinAngleDeg",
          suggestedThresholds: {
            cautionAngleHighDeg: -5.3,
            warningAngleHighDeg: -5.0,
            criticalLandingRangeErrorKm: 250
          },
          debounceSeconds: 2,
          clearCondition: "Midcourse correction returns the predicted angle inside the entry corridor."
        }
      },
      alert: {
        headline: "ENTRY ANGLE SHALLOW",
        body: "The command module may skip out of the atmosphere. Correct the entry corridor before interface."
      },
      recoveryActions: [
        "Run a final midcourse correction.",
        "Bias the correction toward a steeper entry angle.",
        "Update landing zone prediction after the burn.",
        "Prepare contingency recovery if range error remains high."
      ]
    },
    {
      id: "entry-corridor-steep",
      title: "Entry Corridor Too Steep",
      severity: "critical",
      systems: ["guidance", "thermal", "crew-safety", "reentry"],
      phases: ["transearth-coast", "entry-interface"],
      trigger: {
        description: "Predicted entry angle is too steep, risking excessive heating and g-loads.",
        eventLogic: {
          watch: ["entry.predictedFlightPathAngleDeg", "entry.targetMaxAngleDeg", "entry.peakG"],
          condition: "predictedFlightPathAngleDeg < targetMaxAngleDeg",
          suggestedThresholds: {
            cautionAngleLowDeg: -7.1,
            warningAngleLowDeg: -7.4,
            criticalPeakG: 12
          },
          debounceSeconds: 2,
          clearCondition: "Midcourse correction returns the predicted angle inside the entry corridor."
        }
      },
      alert: {
        headline: "ENTRY ANGLE STEEP",
        body: "Predicted heating and g-loads exceed limits. Correct the corridor before entry interface."
      },
      recoveryActions: [
        "Run a final midcourse correction.",
        "Bias the correction toward a shallower entry angle.",
        "Verify command module attitude before separation.",
        "Commit to manual entry monitoring if guidance remains uncertain."
      ]
    },
    {
      id: "lm-descent-fuel-critical",
      title: "LM Descent Fuel Critical",
      severity: "critical",
      systems: ["lunar-module", "propulsion", "landing"],
      phases: ["powered-descent", "terminal-descent"],
      trigger: {
        description: "LM descent fuel drops below the landing reserve while altitude or vertical speed still requires powered control.",
        eventLogic: {
          watch: ["lm.descentFuelPercent", "lm.altitudeMeters", "lm.verticalSpeedMps", "lm.abortStageAvailable"],
          condition: "descentFuelPercent < landingReservePercent && altitudeMeters > safeTouchdownAltitudeMeters",
          suggestedThresholds: {
            cautionFuelPercent: 8,
            warningFuelPercent: 5,
            criticalFuelPercent: 2,
            safeTouchdownAltitudeMeters: 15
          },
          debounceSeconds: 1,
          clearCondition: "LM touches down safely or aborts to ascent stage before fuel depletion."
        }
      },
      alert: {
        headline: "DESCENT FUEL CRITICAL",
        body: "LM descent fuel is nearly depleted. Land immediately or abort the descent."
      },
      recoveryActions: [
        "Throttle down only if vertical speed remains safe.",
        "Target the nearest level landing zone.",
        "Abort to ascent stage if landing cannot be completed in time.",
        "After touchdown, shut down descent engine immediately."
      ]
    },
    {
      id: "docking-miss",
      title: "Docking Miss",
      severity: "warning",
      systems: ["rendezvous", "rcs", "docking"],
      phases: ["transposition-docking-extraction", "lunar-orbit-rendezvous"],
      trigger: {
        description: "Closing rate, alignment, or lateral offset exceeds docking limits at contact range.",
        eventLogic: {
          watch: ["docking.rangeMeters", "docking.closingRateMps", "docking.alignmentDeg", "docking.lateralOffsetMeters"],
          condition: "rangeMeters < contactRangeMeters && (closingRateMps > maxClosingRateMps || alignmentDeg > maxAlignmentDeg || lateralOffsetMeters > maxOffsetMeters)",
          suggestedThresholds: {
            contactRangeMeters: 2,
            maxClosingRateMps: 0.3,
            maxAlignmentDeg: 5,
            maxOffsetMeters: 0.5
          },
          debounceSeconds: 0,
          clearCondition: "Spacecraft backs out to a stable hold point and re-enters docking limits."
        }
      },
      alert: {
        headline: "DOCKING MISS",
        body: "Docking limits were exceeded. Back out, stabilize, and begin another approach."
      },
      recoveryActions: [
        "Fire RCS translation away from the target.",
        "Hold at the next rendezvous station-keeping point.",
        "Null relative rates before reapproach.",
        "Realign the docking probe and retry at a lower closing rate."
      ]
    },
    {
      id: "sps-failure",
      title: "SPS Engine Failure",
      severity: "critical",
      systems: ["service-module", "sps", "abort"],
      phases: ["loi", "tei", "major-course-correction"],
      trigger: {
        description: "The service propulsion system fails to ignite, shuts down early, or produces thrust below mission rule limits.",
        eventLogic: {
          watch: ["sps.commanded", "sps.ignited", "sps.chamberPressurePercent", "sps.thrustPercent", "burn.elapsedSeconds"],
          condition: "sps.commanded && (!sps.ignited || chamberPressurePercent < minChamberPressurePercent || thrustPercent < minThrustPercent)",
          suggestedThresholds: {
            minChamberPressurePercent: 85,
            minThrustPercent: 90,
            maxIgnitionDelaySeconds: 3
          },
          debounceSeconds: 2,
          clearCondition: "Engine performance returns above limits or an alternate abort plan is selected."
        }
      },
      alert: {
        headline: "SPS FAILURE",
        body: "Service propulsion is not delivering commanded thrust. Evaluate abort options and backup propulsion."
      },
      recoveryActions: [
        "Shut down the SPS if chamber pressure is unstable.",
        "Recompute trajectory using available RCS or LM propulsion.",
        "Use free-return or lifeboat procedures when applicable.",
        "Prioritize crew return over lunar orbit or landing objectives."
      ]
    },
    {
      id: "apollo-13-service-module-rupture",
      title: "Service Module Cryo Failure",
      severity: "critical",
      systems: ["service-module", "power", "life-support", "abort"],
      phases: ["translunar-coast"],
      trigger: {
        description: "A cryogenic tank fault causes cascading oxygen, power, and propulsion degradation similar to an Apollo 13 emergency.",
        eventLogic: {
          watch: ["serviceModule.oxygenTankPressurePsi", "power.fuelCellOutputPercent", "serviceModule.busVoltage", "crewConsumables.co2LevelMmHg"],
          condition: "oxygenTankPressurePsi drops rapidly && fuelCellOutputPercent < minFuelCellOutputPercent",
          suggestedThresholds: {
            oxygenPressureDropPsiPerMinute: 75,
            minFuelCellOutputPercent: 60,
            warningBusVoltage: 26,
            criticalCo2MmHg: 15
          },
          debounceSeconds: 10,
          clearCondition: "Command module is powered down, LM lifeboat resources are stable, and a return trajectory is established."
        }
      },
      alert: {
        headline: "SERVICE MODULE EMERGENCY",
        body: "Oxygen and power are failing. Power down the command module and transfer survival loads to the LM."
      },
      recoveryActions: [
        "Power down nonessential command module systems.",
        "Activate LM lifeboat power and life-support procedures.",
        "Plot a free-return or direct-abort trajectory.",
        "Conserve water, battery power, oxygen, and CO2 scrubbing capacity."
      ]
    },
    {
      id: "communications-blackout",
      title: "Communications Loss",
      severity: "caution",
      systems: ["communications", "navigation"],
      phases: ["translunar-coast", "lunar-far-side", "entry-interface", "surface-operations"],
      trigger: {
        description: "Signal strength or antenna pointing falls below the threshold required for ground updates.",
        eventLogic: {
          watch: ["comms.signalStrengthPercent", "comms.antennaPointingErrorDeg", "comms.expectedBlackout", "guidance.needsGroundUpdate"],
          condition: "!expectedBlackout && (signalStrengthPercent < minSignalStrengthPercent || antennaPointingErrorDeg > maxPointingErrorDeg)",
          suggestedThresholds: {
            minSignalStrengthPercent: 25,
            maxPointingErrorDeg: 12,
            warningLossSeconds: 45
          },
          debounceSeconds: 5,
          clearCondition: "Signal strength and antenna pointing recover, or the spacecraft exits a planned blackout period."
        }
      },
      alert: {
        headline: "COMMUNICATIONS LOSS",
        body: "Ground link is unavailable. Maintain attitude and continue with onboard guidance until signal returns."
      },
      recoveryActions: [
        "Switch to backup antenna or high-gain reacquisition mode.",
        "Hold attitude for predicted reacquisition.",
        "Defer noncritical burns until the state vector is verified.",
        "Use onboard checklist timing if ground updates remain unavailable."
      ]
    },
    {
      id: "dsky-program-alarm",
      title: "DSKY Program Alarm",
      severity: "warning",
      systems: ["guidance-computer", "dsky", "crew-interface"],
      phases: ["powered-descent", "rendezvous", "major-burn"],
      trigger: {
        description: "The guidance computer reports a program alarm or executive overload while a time-critical task is active.",
        eventLogic: {
          watch: ["dsky.alarmCode", "dsky.executiveLoadPercent", "guidance.activeProgram", "guidance.taskCriticality"],
          condition: "alarmCode is active || executiveLoadPercent > maxExecutiveLoadPercent",
          suggestedThresholds: {
            maxExecutiveLoadPercent: 90,
            cautionAlarmCodes: ["1201"],
            warningAlarmCodes: ["1202", "1107"],
            criticalTaskCriticality: "landing"
          },
          debounceSeconds: 0,
          clearCondition: "Alarm is acknowledged and guidance continues producing valid navigation outputs."
        }
      },
      alert: {
        headline: "DSKY PROGRAM ALARM",
        body: "Guidance computer alarm is active. Acknowledge, verify navigation data, and continue only if guidance remains stable."
      },
      recoveryActions: [
        "Acknowledge the alarm.",
        "Verify attitude, altitude, and velocity displays.",
        "Shed nonessential computer tasks if the mission model supports it.",
        "Abort the active maneuver if navigation outputs become invalid."
      ]
    },
    {
      id: "dsky-input-error",
      title: "DSKY Input Error",
      severity: "info",
      systems: ["dsky", "crew-interface"],
      phases: ["preburn", "rendezvous", "surface-operations", "entry-prep"],
      trigger: {
        description: "A crew-entered verb, noun, or program value is invalid for the current guidance mode.",
        eventLogic: {
          watch: ["dsky.pendingVerb", "dsky.pendingNoun", "guidance.activeProgram", "dsky.inputAccepted"],
          condition: "inputAccepted == false",
          suggestedThresholds: {
            maxInvalidInputsBeforeCaution: 3
          },
          debounceSeconds: 0,
          clearCondition: "A valid input is entered or the pending DSKY entry is cleared."
        }
      },
      alert: {
        headline: "DSKY INPUT REJECTED",
        body: "The guidance computer rejected the entry. Clear the input and verify the current program."
      },
      recoveryActions: [
        "Clear the DSKY entry.",
        "Confirm the active program, verb, and noun.",
        "Re-enter the command with the correct checklist value.",
        "Pause noncritical actions until the display returns to a valid state."
      ]
    }
  ]
};
