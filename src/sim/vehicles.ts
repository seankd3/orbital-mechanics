/**
 * Apollo vehicle data. CSM is game-sized (no Saturn V staging, so its tank
 * covers the TLI/LOI/TEI arc); the LM uses real-flavored Apollo numbers —
 * they balance perfectly at lunar scale (DPS ≈ 2,340 m/s vs ~2,100 needed
 * to land, APS ≈ 2,050 vs ~1,900 to reach orbit).
 */

export interface StageSpec {
  name: string; // engine name shown in the HUD
  dryMass: number; // kg
  fuelMass: number; // kg
  thrust: number; // N
  isp: number; // s
}

export interface VehicleSpec {
  label: string;
  stages: StageSpec[]; // burn order; staging drops stage 0
  rcsThrust: number; // N
  rcsFuelMass: number; // kg
  rcsIsp: number; // s
  angularAccel: number; // rad/s²
}

export const G0 = 9.80665;

export const VEHICLES = {
  csm: {
    label: 'CSM',
    stages: [
      // S-IVB third stage (real J-2 numbers): flies TLI with the full stack,
      // then gets jettisoned — the reason Apollo didn't need a monster SPS.
      { name: 'S-IVB', dryMass: 11_000, fuelMass: 106_000, thrust: 1_000_000, isp: 421 },
      { name: 'SPS', dryMass: 12_000, fuelMass: 24_000, thrust: 91_000, isp: 314 },
    ],
    rcsThrust: 890,
    rcsFuelMass: 500,
    rcsIsp: 290,
    angularAccel: 0.9,
  },
  lm: {
    label: 'LM',
    stages: [
      // Stretched vs the real LM (8,200 kg / 45 kN): the real descent stage
      // only lands on near-optimal guidance — authentic, but a miserable game.
      // More tank and thrust keep honest piloting survivable (≈2,560 m/s ΔV,
      // lunar TWR ≈ 2.8 at ignition).
      { name: 'DPS', dryMass: 2_200, fuelMass: 9_400, thrust: 75_000, isp: 311 },
      // Same treatment as the DPS: the real APS (2,400 kg / 16 kN) leaves zero
      // margin for a hand-flown ascent (≈2,250 m/s ΔV here).
      { name: 'APS', dryMass: 2_500, fuelMass: 3_000, thrust: 24_000, isp: 311 },
    ],
    rcsThrust: 440,
    rcsFuelMass: 250,
    rcsIsp: 290,
    angularAccel: 1.4, // the LM is twitchy by design
  },
} satisfies Record<string, VehicleSpec>;

export type VehicleId = keyof typeof VEHICLES;
