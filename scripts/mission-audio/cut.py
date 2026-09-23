# Cut clips (one or more spliced segments each) from the reel: band-limit like the
# air-to-ground loop, normalize loudness, small mono MP3 — then re-transcribe to verify.
import json, os, subprocess, sys
import imageio_ffmpeg
from faster_whisper import WhisperModel
FF = imageio_ffmpeg.get_ffmpeg_exe()
src, outdir, spec = sys.argv[1], sys.argv[2], json.loads(open(sys.argv[3]).read())
model = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=4)
os.makedirs(outdir, exist_ok=True)
for cid, segs in spec.items():
    lo, hi = min(s[0] for s in segs), max(s[1] for s in segs)
    parts = [f'[0]atrim=start={a - lo:.2f}:end={b - lo:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={b - a - 0.06:.2f}:d=0.06[p{i}]'
             for i, (a, b) in enumerate(segs)]
    joined = ''.join(f'[p{i}]' for i in range(len(segs)))
    total = sum(b - a for a, b in segs)
    graph = ';'.join(parts) + f';{joined}concat=n={len(segs)}:v=0:a=1,highpass=f=250,lowpass=f=3600,loudnorm=I=-18:TP=-2:LRA=9,afade=t=out:st={max(0, total - 0.1):.2f}:d=0.1[out]'
    out = f'{outdir}/{cid}.mp3'
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f'{lo:.2f}', '-to', f'{hi:.2f}', '-i', src, '-filter_complex', graph,
                    '-map', '[out]', '-ac', '1', '-ar', '22050', '-b:a', '48k', out], check=True)
    words = ' '.join(s.text.strip() for s in model.transcribe(out, vad_filter=False, beam_size=5, condition_on_previous_text=False,
                     initial_prompt='Apollo 11. Houston, Eagle, Tranquility Base.')[0])
    print(f'{cid:20s} {total:5.1f}s {os.path.getsize(out) // 1024:3d} KB | {words}', flush=True)
