# Trailer

A 2½-minute trailer for the game, made from the game itself: every shot is
flown live through the dev hook (`window.__game`) and recorded frame by frame,
with the real Apollo 11 air-to-ground loops under a synthesized score.

- `timeline.mjs` is the edit: shots (start, length), voice lines (seconds into
  NASA's highlight reel, see `../mission-audio/`), and the title cards.
- `shots.js` flies and frames each shot (`SHOTS`), and holds `PROBES`, which
  take stills to try camera angles.
- `lib.js` is injected into the page: flight helpers and the typography.
- `run.mjs` records the shots (clean frames, or the game's HUD where the shot
  wants it) to `frames/<id>/`. `overlay.mjs` renders the titles, slates and
  subtitles as transparent frames. `mix.py` makes the soundtrack, and
  `build.py` puts it all together.

```sh
npm run dev                                # the game, on :5175
cd scripts/trailer
curl -L -o jbmono.woff2 https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2
curl -L -o highlights.mp3 https://archive.org/download/Apollo11AudioHighlights/Apollo11Highlights.mp3
python -m venv venv && ./venv/bin/pip install numpy scipy imageio-ffmpeg

./record.sh                                # all shots; ~1 h in software GL
node export.mjs                            # timeline.json for the Python side
node overlay.mjs
./venv/bin/python mix.py timeline.json highlights.mp3 mix.wav
./venv/bin/python build.py timeline.json mix.wav trailer.mp4   # --preview for 540p
```

`node run.mjs record K` re-records one shot, and `node run.mjs probe kfield`
saves probe stills to `probe/`. `./sheet.sh K` makes a contact sheet of a
shot. `J → I → K` and `R → S` are each one continuous flight, so record them
together and in that order. The docking (O) and the final descent (K) are
*tail* shots: they fly until capture or contact, and the edit keeps their last
seconds. Set `PLAYWRIGHT=/path/to/playwright/index.mjs` if Playwright isn't
installed in the project.

Mission audio: NASA Johnson Space Center, Apollo 11 air-to-ground (public
domain). No NASA endorsement implied.
