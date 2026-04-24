"use strict";

window.APOLLO_LESSONS = {
  version: 1,
  schema: {
    id: "Stable lesson identifier for tutorial progress and save files.",
    title: "Player-facing lesson title.",
    track: "Grouping used by a flight school or mission-training menu.",
    summary: "Short description of the skill being taught.",
    objectives: "Ordered learning goals shown to the player.",
    successChecks: "Descriptive completion checks for future mission logic or instructor UI.",
    hints: "Contextual hint text that can be displayed during the lesson."
  },
  tracks: [
    {
      id: "orbital-flight-school",
      label: "Orbital Flight School",
      description: "Core KSP-like orbit handling: reading the map, using attitude markers, and planning burns."
    },
    {
      id: "apollo-mission-school",
      label: "Apollo Mission School",
      description: "Apollo sequence training from Saturn V ascent through lunar landing, rendezvous, and entry."
    }
  ],
  lessons: [
    {
      id: "orbit-basics",
      title: "Orbit Basics",
      track: "orbital-flight-school",
      order: 10,
      estimatedMinutes: 8,
      scenario: "low-earth-orbit-intro",
      summary: "Teach apoapsis, periapsis, orbital velocity, map view reading, and why an orbit is sideways freefall.",
      objectives: [
        "Identify apoapsis, periapsis, current altitude, orbital speed, and time to next apsis.",
        "Explain that raising one side of an orbit requires a burn on the opposite side.",
        "Coast to apoapsis and observe how altitude and velocity change around the orbit.",
        "Use map view to predict whether the spacecraft is suborbital, elliptical, circular, or escaping."
      ],
      successChecks: [
        {
          id: "reads-apsides",
          description: "Player correctly identifies apoapsis and periapsis markers and can tell which side of the orbit is higher."
        },
        {
          id: "maintains-safe-orbit",
          description: "Spacecraft remains in a stable Earth orbit with periapsis above the atmosphere for a full coast segment."
        },
        {
          id: "understands-opposite-side",
          description: "Player chooses the opposite side of the orbit when asked where to burn to raise a target apsis."
        }
      ],
      hints: [
        {
          id: "sideways-speed",
          text: "Orbit is not about hovering. You are falling around Earth because your sideways speed keeps moving the ground out from under you."
        },
        {
          id: "apsis-pair",
          text: "A burn near periapsis mostly changes apoapsis. A burn near apoapsis mostly changes periapsis."
        },
        {
          id: "watch-time-to-apsis",
          text: "Time to apoapsis and time to periapsis are often better burn cues than altitude alone."
        }
      ]
    },
    {
      id: "prograde-retrograde",
      title: "Prograde and Retrograde",
      track: "orbital-flight-school",
      order: 20,
      estimatedMinutes: 7,
      scenario: "attitude-marker-practice",
      summary: "Introduce velocity-relative attitude control and how prograde and retrograde burns reshape an orbit.",
      objectives: [
        "Find the prograde and retrograde markers on the navball.",
        "Point prograde and perform a short burn to raise the opposite side of the orbit.",
        "Point retrograde and perform a short burn to lower the opposite side of the orbit.",
        "Compare the burn result with the map prediction after each maneuver."
      ],
      successChecks: [
        {
          id: "holds-prograde",
          description: "Player aligns near the prograde marker and holds attitude long enough to complete a controlled burn."
        },
        {
          id: "holds-retrograde",
          description: "Player aligns near the retrograde marker and completes a controlled slowing burn."
        },
        {
          id: "predicts-apsis-change",
          description: "After each burn, player can describe which apsis moved and whether it rose or fell."
        }
      ],
      hints: [
        {
          id: "prograde-adds-speed",
          text: "Prograde means with your current motion. Burning prograde adds orbital speed and raises the far side of the orbit."
        },
        {
          id: "retrograde-removes-speed",
          text: "Retrograde means against your current motion. Burning retrograde removes orbital speed and lowers the far side of the orbit."
        },
        {
          id: "small-burns",
          text: "Use short taps at first. It is easier to add another small burn than to undo a large one."
        }
      ]
    },
    {
      id: "circularization",
      title: "Circularization",
      track: "orbital-flight-school",
      order: 30,
      estimatedMinutes: 9,
      scenario: "earth-parking-orbit",
      summary: "Practice turning an elliptical orbit into a near-circular parking orbit by burning at an apsis.",
      objectives: [
        "Coast to apoapsis when periapsis is low, or to periapsis when apoapsis is low.",
        "Start the burn slightly before the apsis so the maneuver is centered on it.",
        "Use prograde or retrograde thrust to bring apoapsis and periapsis close together.",
        "Stop the burn when the orbit is close enough for mission operations."
      ],
      successChecks: [
        {
          id: "burn-centered",
          description: "Circularization burn is started before the apsis and ends after it, keeping the main impulse centered on the marker."
        },
        {
          id: "near-circular-orbit",
          description: "Apoapsis and periapsis finish within a small altitude band of each other and remain above atmospheric drag."
        },
        {
          id: "controlled-cutoff",
          description: "Player throttles down or cuts off before overshooting into a strongly elliptical orbit."
        }
      ],
      hints: [
        {
          id: "burn-at-apsis",
          text: "Circularization works best at an apsis because that is where one side of the orbit is easiest to adjust."
        },
        {
          id: "split-the-burn",
          text: "For longer burns, start before the timer reaches zero so half the burn happens before the apsis and half after."
        },
        {
          id: "watch-both-numbers",
          text: "Do not stare at only one marker. Circularization is the moment when both apoapsis and periapsis matter."
        }
      ]
    },
    {
      id: "maneuver-nodes",
      title: "Maneuver Nodes",
      track: "orbital-flight-school",
      order: 40,
      estimatedMinutes: 10,
      scenario: "node-editor-training",
      summary: "Teach planning a burn before committing propellant, including node handles, timing, and execution.",
      objectives: [
        "Create a maneuver node on the current orbit.",
        "Adjust prograde, retrograde, radial, and normal components and observe the predicted path.",
        "Move the node around the orbit to see how timing changes the result.",
        "Execute the planned burn using the burn timer and target attitude."
      ],
      successChecks: [
        {
          id: "creates-node",
          description: "Player creates a node at a useful point on the orbit rather than burning immediately without a plan."
        },
        {
          id: "uses-prediction",
          description: "Player adjusts the node until the predicted orbit satisfies the lesson target before ignition."
        },
        {
          id: "executes-node",
          description: "Actual post-burn orbit closely matches the planned trajectory shown by the node."
        }
      ],
      hints: [
        {
          id: "node-is-pencil",
          text: "A maneuver node is a pencil mark on the map. Move it and pull handles until the future path looks right."
        },
        {
          id: "timing-matters",
          text: "The same delta-v can do very different things when placed at another point in the orbit."
        },
        {
          id: "burn-half-early",
          text: "If the node burn lasts one minute, begin about thirty seconds before the node timer reaches zero."
        }
      ]
    },
    {
      id: "saturn-v-staging",
      title: "Saturn V Staging",
      track: "apollo-mission-school",
      order: 50,
      estimatedMinutes: 11,
      scenario: "saturn-v-ascent",
      summary: "Train the launch profile, gravity turn, and stage sequence from liftoff to Earth parking orbit.",
      objectives: [
        "Launch vertically, clear the tower, and begin a smooth downrange pitch program.",
        "Ride prograde through the gravity turn while avoiding abrupt attitude changes.",
        "Stage S-IC, S-II, and S-IVB when each stage reaches its cutoff condition.",
        "Use the S-IVB to complete insertion into a safe Earth parking orbit."
      ],
      successChecks: [
        {
          id: "clean-liftoff",
          description: "Vehicle clears the pad and begins downrange pitch without loss of control."
        },
        {
          id: "timely-staging",
          description: "Each Saturn V stage is separated only after its work is complete and the next stage is stable for ignition."
        },
        {
          id: "parking-orbit-achieved",
          description: "S-IVB insertion leaves the spacecraft in a stable parking orbit suitable for systems checks and TLI planning."
        }
      ],
      hints: [
        {
          id: "gravity-turn",
          text: "A good ascent bends gradually. Let the rocket lean into prograde instead of forcing a sharp turn."
        },
        {
          id: "stage-when-ready",
          text: "Staging is not only a button press. Confirm thrust, attitude, and velocity before trusting the next stack."
        },
        {
          id: "orbit-before-moon",
          text: "Apollo reaches parking orbit first. Do not chase the Moon until the Earth orbit is stable."
        }
      ]
    },
    {
      id: "trans-lunar-injection",
      title: "Trans-Lunar Injection",
      track: "apollo-mission-school",
      order: 60,
      estimatedMinutes: 12,
      scenario: "tli-window",
      summary: "Teach the S-IVB departure burn that sends the spacecraft from Earth parking orbit onto a lunar transfer.",
      objectives: [
        "Wait for the correct TLI window in Earth parking orbit.",
        "Place or select a prograde maneuver that reaches the Moon's orbital distance.",
        "Burn with the S-IVB until the predicted path enters the lunar transfer corridor.",
        "Separate, turn around, dock with the LM when required, and verify the coast trajectory."
      ],
      successChecks: [
        {
          id: "window-selected",
          description: "Player waits for a transfer geometry that allows a reasonable prograde TLI burn."
        },
        {
          id: "lunar-transfer",
          description: "Post-burn trajectory reaches the Moon's region with a safe predicted perilune or free-return path."
        },
        {
          id: "post-tli-configured",
          description: "Spacecraft is separated from the launch stage and configured for trans-lunar coast operations."
        }
      ],
      hints: [
        {
          id: "burn-prograde-earth",
          text: "TLI is mostly a big prograde burn from Earth orbit. The hard part is timing it so the Moon is there when you arrive."
        },
        {
          id: "watch-perilune",
          text: "After the burn starts, watch the predicted lunar closest approach. Small cutoff errors grow over three days."
        },
        {
          id: "free-return",
          text: "A free-return style path is forgiving: if the engine fails later, the Moon can bend the trajectory back toward Earth."
        }
      ]
    },
    {
      id: "lunar-orbit-insertion",
      title: "Lunar Orbit Insertion",
      track: "apollo-mission-school",
      order: 70,
      estimatedMinutes: 10,
      scenario: "loi-capture",
      summary: "Practice the retrograde burn behind the Moon that captures the CSM and LM into lunar orbit.",
      objectives: [
        "Monitor lunar sphere-of-influence entry and predicted perilune.",
        "Point retrograde near perilune for the LOI burn.",
        "Burn long enough to change from a flyby path into a bound lunar orbit.",
        "Trim the initial capture orbit toward the mission's target altitude."
      ],
      successChecks: [
        {
          id: "perilune-burn",
          description: "LOI burn is performed near lunar perilune rather than too early in the coast."
        },
        {
          id: "captured-at-moon",
          description: "Trajectory changes from lunar flyby or escape to a bound orbit around the Moon."
        },
        {
          id: "safe-lunar-orbit",
          description: "Final lunar periapsis clears terrain and apoapsis remains within the planned operations range."
        }
      ],
      hints: [
        {
          id: "retrograde-to-capture",
          text: "At the Moon, retrograde is the capture direction. You are removing enough speed that lunar gravity can keep you."
        },
        {
          id: "burn-too-short",
          text: "If apoapsis still shows escape, the burn is short. Continue or plan an immediate trim if propellant allows."
        },
        {
          id: "terrain-margin",
          text: "The Moon has no atmosphere to slow you, but low perilune still needs terrain clearance."
        }
      ]
    },
    {
      id: "lm-landing",
      title: "LM Landing",
      track: "apollo-mission-school",
      order: 80,
      estimatedMinutes: 14,
      scenario: "powered-descent",
      summary: "Train undocking, descent orbit insertion, powered descent, hover trim, and touchdown discipline.",
      objectives: [
        "Separate the LM from the CSM and verify independent attitude and throttle control.",
        "Perform descent orbit insertion to lower perilune near the landing site.",
        "Start powered descent and reduce horizontal velocity while managing vertical speed.",
        "Pitch toward a safe landing area, throttle for a gentle touchdown, and shut down the descent engine."
      ],
      successChecks: [
        {
          id: "lm-separated",
          description: "LM is safely separated and under control before beginning descent operations."
        },
        {
          id: "descent-controlled",
          description: "During powered descent, horizontal speed, vertical speed, altitude, and fuel trend toward a safe landing solution."
        },
        {
          id: "safe-touchdown",
          description: "LM touches down upright within the landing zone at low vertical and horizontal speed with usable fuel margin."
        }
      ],
      hints: [
        {
          id: "kill-horizontal",
          text: "Early descent is about removing horizontal speed. Late descent is about keeping vertical speed gentle."
        },
        {
          id: "fuel-clock",
          text: "LM fuel is a clock. If the landing zone looks bad, decide quickly whether to translate, continue, or abort."
        },
        {
          id: "touchdown-shutdown",
          text: "Once contact is confirmed, shut down the descent engine. Do not waste fuel or bounce the LM with lingering thrust."
        }
      ]
    },
    {
      id: "rendezvous",
      title: "Rendezvous and Docking",
      track: "apollo-mission-school",
      order: 90,
      estimatedMinutes: 13,
      scenario: "lm-ascent-rendezvous",
      summary: "Teach phasing, intercept setup, relative velocity matching, and final docking after LM ascent.",
      objectives: [
        "Launch the LM ascent stage into the CSM orbital plane.",
        "Use phasing burns to create a close intercept with the CSM.",
        "At closest approach, burn retrograde relative to the target to reduce closing speed.",
        "Translate slowly for final docking while maintaining alignment and low relative velocity."
      ],
      successChecks: [
        {
          id: "intercept-created",
          description: "Player creates a predicted close approach with the CSM using phasing rather than direct chasing."
        },
        {
          id: "relative-speed-matched",
          description: "Closing speed is reduced near intercept so both spacecraft share nearly the same orbit."
        },
        {
          id: "docking-complete",
          description: "Docking occurs with low relative speed, acceptable alignment, and no collision or excessive propellant use."
        }
      ],
      hints: [
        {
          id: "do-not-chase",
          text: "Rendezvous is not pointing at the target and thrusting. Change your orbit so time and gravity bring you together."
        },
        {
          id: "match-velocity",
          text: "At closest approach, kill relative velocity first. After that, the target should appear almost parked nearby."
        },
        {
          id: "slow-final",
          text: "Final docking is a walking-speed problem. If the target grows fast in the window, slow down."
        }
      ]
    },
    {
      id: "entry-corridor",
      title: "Entry Corridor",
      track: "apollo-mission-school",
      order: 100,
      estimatedMinutes: 10,
      scenario: "earth-entry",
      summary: "Teach the narrow return corridor that avoids both atmospheric skip-out and destructive steep entry.",
      objectives: [
        "Read predicted entry interface altitude, flight-path angle, landing range, and peak g-load.",
        "Use a final midcourse correction to place the command module inside the entry corridor.",
        "Separate the service module and hold the correct command module entry attitude.",
        "Ride through blackout and verify splashdown remains within the recovery area."
      ],
      successChecks: [
        {
          id: "corridor-targeted",
          description: "Predicted entry angle is neither too shallow to skip out nor too steep for safe heating and g-load limits."
        },
        {
          id: "entry-configured",
          description: "Command module is separated, heat shield is oriented correctly, and guidance is ready before entry interface."
        },
        {
          id: "safe-splashdown",
          description: "Entry completes without skip-out or overload and the landing point remains within the recovery corridor."
        }
      ],
      hints: [
        {
          id: "corridor-is-narrow",
          text: "Too shallow can skip off the atmosphere. Too steep can overload the crew and heat shield. Aim for the corridor, not just Earth."
        },
        {
          id: "small-corrections",
          text: "Late entry corrections should be small and deliberate. A tiny velocity change can move the landing point a long way."
        },
        {
          id: "blunt-end-first",
          text: "The command module survives because the heat shield faces forward. Entry attitude matters as much as the trajectory."
        }
      ]
    }
  ]
};
