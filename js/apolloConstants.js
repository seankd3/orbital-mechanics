"use strict";

/**
 * Shared Apollo-era reference constants.
 *
 * Values are practical approximations for simulation/gameplay work, not a
 * flight-certified source. Distances, altitudes, radii, and lengths are meters;
 * masses are kilograms; thrust is newtons; delta-v values are meters per second.
 */
window.APOLLO_CONSTANTS = {
  version: 1,
  assumptions: [
    "SI units are used unless a field name says otherwise.",
    "Vehicle values represent practical Apollo/Saturn V planning numbers.",
    "Delta-v bands are intentionally rounded to leave room for mission profile tuning."
  ],
  units: {
    distance: "m",
    altitude: "m",
    radius: "m",
    mass: "kg",
    thrust: "N",
    deltaV: "m/s",
    time: "s",
    angle: "deg"
  },

  earth: {
    label: "Earth",
    radiusM: 6371000,
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    muM3S2: 3.986004418e14,
    massKg: 5.9722e24,
    surfaceGravityMps2: 9.80665,
    rotationPeriodS: 86164,
    escapeVelocitySurfaceMps: 11186,
    atmosphere: {
      practicalTopM: 100000,
      entryInterfaceM: 122000,
      scaleHeightM: 8500,
      seaLevelPressurePa: 101325
    },
    orbitReference: {
      lowOrbitMinM: 160000,
      apolloParkingOrbitM: 185000,
      lowOrbitCircularVelocityMps: 7790
    }
  },

  moon: {
    label: "Moon",
    radiusM: 1737400,
    meanRadiusM: 1737400,
    muM3S2: 4.9048695e12,
    massKg: 7.342e22,
    surfaceGravityMps2: 1.62,
    meanDistanceFromEarthM: 384400000,
    siderealOrbitPeriodS: 2360591,
    escapeVelocitySurfaceMps: 2380,
    orbitReference: {
      lowOrbitMinM: 15000,
      apolloLunarOrbitM: 110000,
      circularVelocityAt110KmMps: 1600
    }
  },

  soiRadii: {
    // Patched-conic sphere-of-influence values used for handoff logic.
    earthAroundSunM: 924000000,
    moonAroundEarthM: 66100000
  },

  saturnV: {
    label: "Saturn V",
    heightM: 110.6,
    diameterM: 10.1,
    liftoffMassKg: 2970000,
    liftoffThrustN: 34500000,
    payloadToLeoKg: 118000,
    payloadToTliKg: 48600,
    stages: {
      sIc: {
        label: "S-IC first stage",
        engine: "F-1",
        engineCount: 5,
        dryMassKg: 131000,
        propellantMassKg: 2145000,
        thrustVacuumN: 34500000,
        burnTimeS: 168,
        approximateDeltaVMps: 2600
      },
      sIi: {
        label: "S-II second stage",
        engine: "J-2",
        engineCount: 5,
        dryMassKg: 36000,
        propellantMassKg: 456000,
        thrustVacuumN: 5140000,
        burnTimeS: 360,
        approximateDeltaVMps: 4200
      },
      sIvb: {
        label: "S-IVB third stage",
        engine: "J-2",
        engineCount: 1,
        dryMassKg: 13200,
        propellantMassKg: 109000,
        thrustVacuumN: 1033000,
        firstBurnTimeS: 150,
        tliBurnTimeS: 350,
        approximateTliDeltaVMps: 3150
      }
    }
  },

  csm: {
    label: "Command/Service Module",
    loadedMassKg: 30300,
    commandModule: {
      label: "Command Module",
      reentryMassKg: 5500,
      diameterM: 3.91,
      heightM: 3.48,
      crewCapacity: 3
    },
    serviceModule: {
      label: "Service Module",
      dryMassKg: 5200,
      propellantMassKg: 18400,
      lengthM: 7.56,
      diameterM: 3.91
    },
    sps: {
      label: "Service Propulsion System",
      thrustN: 91000,
      specificImpulseS: 314,
      restartable: true,
      practicalDeltaVMps: 2800
    },
    rcs: {
      quadCount: 4,
      thrustersPerQuad: 4,
      thrustPerThrusterN: 445,
      practicalAttitudeDeltaVMps: 100
    }
  },

  lm: {
    label: "Lunar Module",
    loadedMassKg: 14700,
    heightM: 7.0,
    diagonalGearSpanM: 9.4,
    crewCapacity: 2,
    descentStage: {
      dryMassKg: 2200,
      propellantMassKg: 8200,
      engineThrustMinN: 4700,
      engineThrustMaxN: 45000,
      specificImpulseS: 311,
      practicalDeltaVMps: 2500
    },
    ascentStage: {
      dryMassKg: 2200,
      propellantMassKg: 2350,
      engineThrustN: 15600,
      specificImpulseS: 311,
      practicalDeltaVMps: 1900
    },
    rcs: {
      quadCount: 4,
      thrustersPerQuad: 4,
      thrustPerThrusterN: 445
    }
  },

  missionDeltaVBands: {
    // Ranges describe useful gameplay planning corridors around nominal burns.
    earthLaunchToParkingOrbit: {
      label: "Launch to Earth parking orbit",
      minMps: 9200,
      nominalMps: 9400,
      maxMps: 9700
    },
    transLunarInjection: {
      label: "Trans-lunar injection",
      minMps: 3050,
      nominalMps: 3150,
      maxMps: 3250
    },
    midcourseCorrection: {
      label: "Midcourse correction",
      minMps: 2,
      nominalMps: 25,
      maxMps: 80
    },
    lunarOrbitInsertion1: {
      label: "Lunar orbit insertion 1",
      minMps: 820,
      nominalMps: 900,
      maxMps: 980
    },
    lunarOrbitInsertion2: {
      label: "Lunar orbit circularization",
      minMps: 40,
      nominalMps: 75,
      maxMps: 120
    },
    descentOrbitInsertion: {
      label: "Descent orbit insertion",
      minMps: 20,
      nominalMps: 70,
      maxMps: 100
    },
    poweredDescent: {
      label: "LM powered descent",
      minMps: 1750,
      nominalMps: 1900,
      maxMps: 2100
    },
    lunarAscent: {
      label: "LM lunar ascent",
      minMps: 1700,
      nominalMps: 1850,
      maxMps: 1950
    },
    rendezvousTrim: {
      label: "Rendezvous and docking trim",
      minMps: 5,
      nominalMps: 25,
      maxMps: 75
    },
    transEarthInjection: {
      label: "Trans-Earth injection",
      minMps: 850,
      nominalMps: 1000,
      maxMps: 1100
    },
    entryCorridorTrim: {
      label: "Entry corridor trim",
      minMps: 1,
      nominalMps: 10,
      maxMps: 40
    }
  },

  displayThresholds: {
    distance: {
      showMetersBelowM: 10000,
      showKilometersBelowM: 10000000,
      showEarthRadiiAboveM: 20000000,
      showLunarDistanceAboveM: 100000000
    },
    velocity: {
      showCmPerSecondBelowMps: 0.1,
      showMetersPerSecondBelowMps: 1000,
      showKilometersPerSecondAtOrAboveMps: 1000
    },
    burnAccuracy: {
      excellentErrorMps: 1,
      cautionErrorMps: 5,
      warningErrorMps: 15,
      abortReviewErrorMps: 50
    },
    orbit: {
      periapsisCollisionMarginM: 10000,
      lowEarthOrbitMaxAltitudeM: 2000000,
      lowLunarOrbitMaxAltitudeM: 300000
    },
    ui: {
      fuelCautionPercent: 20,
      fuelWarningPercent: 10,
      fuelCriticalPercent: 5,
      timeWarpNearBurnS: 300,
      timeWarpNearSoiS: 1800
    }
  },

  commonMissionAltitudes: {
    earth: {
      parkingOrbitLowM: 160000,
      parkingOrbitNominalM: 185000,
      parkingOrbitHighM: 200000,
      entryInterfaceM: 122000,
      drogueChuteDeployM: 7300,
      mainChuteDeployM: 3000,
      splashdownM: 0
    },
    moon: {
      lunarOrbitLowM: 90000,
      lunarOrbitNominalM: 110000,
      lunarOrbitHighM: 120000,
      descentOrbitPeriluneM: 15000,
      poweredDescentStartM: 15000,
      landingRadarAcquireM: 12000,
      surfaceM: 0
    },
    transfer: {
      freeReturnFlybyAltitudeM: 250000,
      closeApproachPlanningAltitudeM: 110000,
      earthMoonMeanCenterDistanceM: 384400000
    }
  }
};
