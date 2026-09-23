/**
 * Apollo vehicle data. Stages burn in order; staging drops stage 0.
 *
 * CSM: the S-IVB (real J-2 numbers) flies TLI with the whole stack, then the
 * service module's SPS does the rest; the command module alone rides entry.
 * The SPS tank is ~30% over the real 18.4 t so a hand-flown mission keeps a
 * few hundred m/s of margin for honest mistakes.
 *
 * LM: stretched DPS/APS (real: 45 kN / 16 kN). The real vehicle lands only
 * on near-optimal guidance — authentic, but a miserable game.
 */

export interface StageSpec {
  /** Engine name shown in the HUD. */
  name: string;
  dryMass: number; // kg
  fuelMass: number; // kg
  thrust: number; // N (0 = no main engine)
  isp: number; // s
}

export interface VehicleSpec {
  label: string;
  stages: StageSpec[];
  rcsThrust: number; // N per translation axis
  rcsFuelMass: number; // kg
  rcsIsp: number; // s
  angularAccel: number; // rad/s² of manual rotation authority
}

export const VEHICLES = {
  csm: {
    label: 'CSM',
    stages: [
      { name: 'S-IVB', dryMass: 11_000, fuelMass: 106_000, thrust: 1_000_000, isp: 421 },
      { name: 'SPS', dryMass: 6_200, fuelMass: 24_000, thrust: 91_000, isp: 314 },
      { name: 'CM', dryMass: 5_800, fuelMass: 0, thrust: 0, isp: 1 },
    ],
    rcsThrust: 890,
    rcsFuelMass: 500,
    rcsIsp: 290,
    angularAccel: 0.9,
  },
  lm: {
    label: 'LM',
    stages: [
      { name: 'DPS', dryMass: 2_200, fuelMass: 7_800, thrust: 75_000, isp: 311 },
      { name: 'APS', dryMass: 2_500, fuelMass: 3_000, thrust: 24_000, isp: 311 },
    ],
    rcsThrust: 1_780,
    rcsFuelMass: 280,
    rcsIsp: 290,
    angularAccel: 1.4, // the LM is twitchy by design
  },
} satisfies Record<string, VehicleSpec>;

export type VehicleId = keyof typeof VEHICLES;

/** Command module entry aerodynamics (Apollo CM, trimmed heat-shield first). */
export const CM_AERO = {
  cdA: 1.3 * 12.0, // m²
  liftToDrag: 0.3,
  /** Parachutes: drogues then three mains. */
  drogue: { altitude: 7_300, maxSpeed: 250, cdA: 1.2 * 2 * 20 },
  mains: { altitude: 3_000, cdA: 0.9 * 3 * 450 },
  /** Seconds for a reefed canopy to reach full area. */
  inflation: 10,
};
