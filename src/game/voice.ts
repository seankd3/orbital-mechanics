import type { Simulation, Tone } from '../sim/simulation';

/**
 * The real Apollo 11 air-to-ground, clip by clip (public/audio/apollo11/,
 * cut from NASA's public-domain highlight reel; see scripts/mission-audio).
 * Each caption is what was actually said, and it shows as the subtitle.
 */
export const VOICE = {
  'go-for-tli': 'APOLLO 11, THIS IS HOUSTON. YOU ARE GO FOR TLI.',
  'magnificent-ride': 'HOUSTON, APOLLO 11 — THAT SATURN GAVE US A MAGNIFICENT RIDE.',
  'go-for-loi': '11, THIS IS HOUSTON. YOU ARE GO FOR LOI. — ROGER, GO FOR LOI.',
  'other-side': "ALL YOUR SYSTEMS ARE LOOKING GOOD GOING AROUND THE CORNER. WE'LL SEE YOU ON THE OTHER SIDE.",
  'go-for-pdi': "EAGLE, HOUSTON. IF YOU READ, YOU'RE GO FOR POWERED DESCENT.",
  'alarm-1202': 'ROGER, 1202. WE COPY IT.',
  'alarm-1202-again': 'SAME ALARM, AND IT APPEARS TO COME UP WHEN WE HAVE A 16 68 UP.',
  'alarm-1201': "WE'RE GO. SAME TYPE. WE'RE GO.",
  'sixty-seconds': '60 SECONDS.',
  'thirty-seconds': '30 SECONDS.',
  'contact-light': 'CONTACT LIGHT. — OKAY, ENGINE STOP.',
  'eagle-has-landed': 'TRANQUILITY BASE HERE. THE EAGLE HAS LANDED. — ROGER, TRANQUILITY, WE COPY YOU ON THE GROUND.',
  'small-step': "THAT'S ONE SMALL STEP FOR MAN, ONE GIANT LEAP FOR MANKIND.",
  'cleared-for-takeoff': "…AND YOU'RE CLEARED FOR TAKEOFF. — ROGER, UNDERSTAND. WE'RE NUMBER ONE ON THE RUNWAY.",
  'ascent-countdown': '9, 8, 7, 6, 5 — ABORT STAGE, ENGINE ARM ASCENT, PROCEED.',
  'smooth-ride': 'BEAUTIFUL. 26, 36 FEET PER SECOND UP. VERY SMOOTH. VERY QUIET RIDE.',
  'coming-home': 'APOLLO 11, HOUSTON. HOW DID IT GO? — ROGER, WE GOT YOU COMING HOME.',
  'visual-contact': 'THE HORNET NOW REPORTS A VISUAL CONTACT. VISUAL CONTACT FROM THE RECOVERY SHIP.',
  cigars: 'AND THE FLAGS ARE WAVING AND THE CIGARS ARE BEING LIT UP, CLEAR ACROSS.',
  'big-board': "…OF LANDING A MAN ON THE MOON AND RETURNING HIM SAFELY TO THE EARTH. — THAT HAS BEEN ACCOMPLISHED.",
} as const;

export type Voice = keyof typeof VOICE;

/** Put a real mission line on the loop, captioned. */
export function say(sim: Simulation, voice: Voice, tone: Tone = 'info'): void {
  sim.emit(`“${VOICE[voice]}”`, tone, voice);
}
