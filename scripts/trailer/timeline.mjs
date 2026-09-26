// The trailer, second by second: shots (what the recorder films), voice lines
// (cut from NASA's Apollo 11 highlight reel, by reel seconds), and cards.
// One source of truth for the recorder (overlays) and the audio mix.

const shot = (id, start, end, extra = {}) => ({ id, start, dur: +(end - start).toFixed(3), ...extra });

export const TIMELINE = {
  fps: 30,
  total: 147,
  shots: [
    shot('A', 0, 14.4, { fadeIn: 2.5 }), //            Earth orbit: pull back to the whole planet
    shot('black1', 14.4, 17.0, { black: true }), //    ...zero. All engines running.
    shot('title', 17.0, 21.6, { black: true }), //      ORBITAL
    shot('B', 21.6, 27.3, { hud: true }), //                           TLI burn (HUD)
    shot('C', 27.3, 32.6), //                           the plan to the Moon (map)
    shot('D', 32.6, 36.8), //                           translunar coast (map time-lapse)
    shot('E', 36.8, 42.4), //                           LOI behind the Moon
    shot('F', 42.4, 45.9), //                           undock
    shot('G', 45.9, 49.6), //                           PDI
    shot('H', 49.6, 53.9, { hud: true }), //                           1202 (HUD)
    shot('J', 53.9, 59.4, { hud: true }), //                           high gate: boulders, redesignate (HUD)
    shot('I', 59.4, 62.6, { hud: true }), //                           1201 (HUD)
    shot('K', 62.6, 69.45), //                          P66, to contact
    shot('black2', 69.45, 72.0, { black: true }), //   Contact light.
    shot('L', 72.0, 86.2, { fadeIn: 1.4 }), //          The Eagle has landed
    shot('M', 86.2, 95.4), //                           One small step
    shot('N', 95.4, 104.2), //                          ascent
    shot('O', 104.2, 108.8), //                         docking
    shot('P', 108.8, 116.6), //                         Earthrise, TEI
    shot('Q', 116.6, 121.0), //                         entry
    shot('R', 121.0, 126.4), //                         chutes
    shot('S', 126.4, 139.0, { fadeOut: 1.2 }), //       pull back to the whole Earth
    shot('end', 139.0, 147.0, { black: true }), //      end card
  ],

  // who: callsign. segs: [reelStart, reelEnd] spliced back to back from `at`.
  voice: [
    { at: 0.9, segs: [[109.7, 112.75]], who: 'LAUNCH CONTROL', text: 'T-MINUS 15 SECONDS, GUIDANCE IS INTERNAL.' },
    { at: 4.4, segs: [[113.4, 119.05]], who: 'LAUNCH CONTROL', text: '12, 11, 10, 9 — IGNITION SEQUENCE START.' },
    { at: 10.2, segs: [[121.25, 127.45]], who: 'LAUNCH CONTROL', text: '4, 3, 2, 1, ZERO. ALL ENGINES RUNNING.' },
    { at: 16.9, segs: [[127.85, 130.45]], who: 'LAUNCH CONTROL', text: 'LIFTOFF. WE HAVE A LIFTOFF.', quiet: true },
    { at: 22.0, segs: [[201.95, 207.35]], who: 'HOUSTON', text: 'APOLLO 11, THIS IS HOUSTON. YOU ARE GO FOR TLI.' },
    { at: 27.6, segs: [[285.45, 289.9]], who: 'APOLLO 11', text: 'HOUSTON, APOLLO 11. THAT SATURN GAVE US A MAGNIFICENT RIDE.' },
    { at: 37.3, segs: [[659.85, 664.3]], who: 'HOUSTON', text: "ALL YOUR SYSTEMS ARE LOOKING GOOD GOING AROUND THE CORNER. WE'LL SEE YOU ON THE OTHER SIDE." },
    { at: 46.0, segs: [[988.3, 991.75]], who: 'HOUSTON', text: "EAGLE, HOUSTON. IF YOU READ, YOU'RE GO FOR POWERED DESCENT." },
    { at: 51.2, segs: [[1147.45, 1150.2]], who: 'HOUSTON', text: 'ROGER. 1202. WE COPY IT.' },
    { at: 57.4, segs: [[1131.6, 1133.4]], who: 'HOUSTON', text: "EAGLE, LOOKING GREAT. YOU'RE GO." },
    { at: 59.8, segs: [[1116.3, 1119.95]], who: 'HOUSTON', text: "WE'RE GO. SAME TYPE. WE'RE GO." },
    { at: 62.8, segs: [[1272.8, 1274.35]], who: 'HOUSTON', text: '60 SECONDS.' },
    { at: 64.4, segs: [[1288.25, 1291.4]], who: 'EAGLE', text: '40 FEET, DOWN 2½. PICKING UP SOME DUST.' },
    { at: 67.8, segs: [[1302.55, 1303.45]], who: 'HOUSTON', text: '30 SECONDS.' },
    { at: 69.3, segs: [[1311.3, 1312.6]], who: 'EAGLE', text: 'CONTACT LIGHT.' },
    { at: 72.6, segs: [[1331.35, 1337.95]], who: 'EAGLE', text: 'HOUSTON… TRANQUILITY BASE HERE. THE EAGLE HAS LANDED.' },
    { at: 79.5, segs: [[1338.3, 1345.0]], who: 'HOUSTON', text: "ROGER, TRANQUILITY. WE COPY YOU ON THE GROUND. YOU GOT A BUNCH OF GUYS ABOUT TO TURN BLUE. WE'RE BREATHING AGAIN. THANKS A LOT." },
    { at: 86.6, segs: [[1641.85, 1650.2]], who: 'NEIL ARMSTRONG', text: "THAT'S ONE SMALL STEP FOR MAN, ONE GIANT LEAP FOR MANKIND." },
    { at: 95.8, segs: [[2149.45, 2153.85]], who: 'EAGLE', text: '5, ABORT STAGE, ENGINE ARM ASCENT… PROCEED.' },
    { at: 100.6, segs: [[2160.1, 2160.75], [2166.8, 2168.4], [2175.05, 2176.65]], gap: 0.25, who: 'EAGLE', text: 'BEAUTIFUL. VERY SMOOTH… VERY QUIET RIDE.' },
    { at: 109.4, segs: [[2357.0, 2359.45]], who: 'HOUSTON', text: 'APOLLO 11, HOUSTON. HOW DID IT GO? OVER.' },
    { at: 112.1, segs: [[2364.05, 2366.55]], who: 'APOLLO 11', text: 'TIME TO OPEN UP THE LRL DOORS, CHARLIE.' },
    { at: 114.7, segs: [[2366.6, 2368.5]], who: 'HOUSTON', text: 'ROGER. WE GOT YOU COMING HOME.' },
    { at: 121.3, segs: [[2876.7, 2881.6]], who: 'RECOVERY', text: 'HORNET NOW REPORTS A VISUAL CONTACT. VISUAL CONTACT FROM THE RECOVERY SHIP.' },
    { at: 127.0, segs: [[2997.15, 3001.65]], who: 'MISSION CONTROL · THE BIG BOARD', text: 'I BELIEVE THAT THIS NATION SHOULD COMMIT ITSELF TO ACHIEVING THE GOAL, BEFORE THIS DECADE IS OUT,' },
    { at: 131.5, segs: [[3001.65, 3006.7]], who: 'MISSION CONTROL · THE BIG BOARD', text: 'OF LANDING A MAN ON THE MOON AND RETURNING HIM SAFELY TO THE EARTH.' },
    { at: 137.0, segs: [[3007.05, 3008.85]], who: 'MISSION CONTROL', text: 'THAT HAS BEEN ACCOMPLISHED.' },
  ],

  cards: [
    { kind: 'title', at: 17.0, dur: 4.6, fin: 0.05, fout: 1.0,
      html: '<div class="big">ORBITAL</div><div class="rule"></div><div class="sub">FLY APOLLO 11</div>' },
    { kind: 'slate', at: 21.9, dur: 4.8, n: '01', text: 'TRANS-LUNAR INJECTION' },
    { kind: 'feature', at: 27.7, dur: 4.5, text: 'EVERY BURN SOLVED · EVERY PATH EXACT' },
    { kind: 'feature', at: 32.9, dur: 3.6, text: '384,000 KILOMETERS · THREE DAYS' },
    { kind: 'slate', at: 37.1, dur: 5.0, n: '03', text: 'LUNAR ORBIT INSERTION' },
    { kind: 'feature', at: 42.7, dur: 3.0, text: 'THE EAGLE HAS WINGS' },
    { kind: 'slate', at: 46.2, dur: 3.2, n: '05', text: 'POWERED DESCENT' },
    { kind: 'slate', at: 95.7, dur: 4.6, n: '06', text: 'LUNAR ASCENT' },
    { kind: 'slate', at: 104.5, dur: 4.0, n: '07', text: 'RENDEZVOUS & DOCKING' },
    { kind: 'slate', at: 109.1, dur: 4.2, n: '08', text: 'TRANS-EARTH INJECTION' },
    { kind: 'slate', at: 116.9, dur: 3.8, n: '09', text: 'ENTRY & SPLASHDOWN' },
    { kind: 'title', at: 139.0, dur: 8.0, fin: 1.2, fout: 1.6,
      html: '<div class="big">ORBITAL</div><div class="rule"></div><div class="sub">FLY APOLLO 11</div>' +
        '<div class="small">FROM EARTH ORBIT TO THE SEA OF TRANQUILITY — AND HOME</div>' +
        '<div class="url">SEANKENNETHDOHERTY.COM/PLAY/ORBITAL-MECHANICS</div>' +
        '<div class="credit">Mission audio: NASA Johnson Space Center, Apollo 11 air-to-ground (public domain). No NASA endorsement implied.</div>' },
  ],
};

// Where each voice line ends on the trailer clock (segments spliced with `gap`).
for (const v of TIMELINE.voice) {
  v.len = v.segs.reduce((s, [a, b]) => s + (b - a), 0) + (v.segs.length - 1) * (v.gap ?? 0);
}
