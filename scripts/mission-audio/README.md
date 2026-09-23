# Mission audio

The voice clips in `public/audio/apollo11/` are cut from NASA's **Apollo 11
Audio Highlights** reel ("Digitized, cataloged and archived by the Houston Audio
Control Room, at the NASA Johnson Space Center"), published on the Internet
Archive as [`Apollo11AudioHighlights`](https://archive.org/details/Apollo11AudioHighlights)
under the [Public Domain Mark](http://creativecommons.org/publicdomain/mark/1.0/).
Using it implies no endorsement by NASA.

`clips.json` lists each clip as one or more `[start, end]` seconds into
`Apollo11Highlights.mp3`. The segments are spliced to drop dead air.
`cut.py` makes the clips reproducibly. It band-limits each clip to the
air-to-ground loop (250–3600 Hz), normalizes loudness to −18 LUFS, and writes
22 kHz mono MP3 at 48 kbps. It then re-transcribes every clip with Whisper, so
you can check each one says what it should.

```sh
python -m venv venv && ./venv/bin/pip install faster-whisper imageio-ffmpeg
curl -L -o highlights.mp3 https://archive.org/download/Apollo11AudioHighlights/Apollo11Highlights.mp3
./venv/bin/python cut.py highlights.mp3 ../../public/audio/apollo11 clips.json
```

The cut points came from word-level Whisper timestamps (`small.en`) around
each moment. The reel is an edited highlight reel, so a few famous lines are
missing, such as the crew's first "program alarm". The game uses the lines
that are there.
