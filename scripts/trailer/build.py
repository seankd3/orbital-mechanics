"""Assemble the trailer: shot frames in timeline order (tail shots keep their last
frames), the typography overlay on top, and the soundtrack.

    python build.py timeline.json mix.wav out.mp4 [--preview]
"""
import json, os, shutil, subprocess, sys
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(sys.argv[1]))
MIX, OUT = sys.argv[2], sys.argv[3]
preview = '--preview' in sys.argv
fps = T['fps']
total = round(T['total'] * fps)

seq = os.path.join(HERE, 'seq')
shutil.rmtree(seq, ignore_errors=True)
os.makedirs(seq)
black = os.path.join(HERE, 'black.jpg')
if not os.path.exists(black):
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x030506:s=1920x1080', '-frames:v', '1', '-q:v', '2', black], check=True)

# Tail shots keep their last frames; O drops its very last (the LM is cast off at capture).
tails = {'K': 0, 'O': 1}
k = 0
report = []
for s in T['shots']:
    a, b = round(s['start'] * fps), round((s['start'] + s['dur']) * fps)
    n = b - a
    if s.get('black'):
        files = [black] * n
    else:
        d = os.path.join(HERE, 'frames', s['id'])
        have = sorted(f for f in os.listdir(d) if f.endswith('.jpg')) if os.path.isdir(d) else []
        if not have:
            files = [black] * n
            report.append(f"{s['id']}: MISSING")
        else:
            cut = len(have) - tails[s['id']] if s['id'] in tails else None
            pick = have[:cut][-n:] if cut is not None else have[:n]
            if len(pick) < n:
                report.append(f"{s['id']}: short by {n - len(pick)} frames (held)")
                pick = pick + [pick[-1]] * (n - len(pick))
            files = [os.path.join(d, f) for f in pick]
    for f in files:
        os.symlink(f, os.path.join(seq, f'{k:06d}.jpg'))
        k += 1
assert k == total, (k, total)
print('\n'.join(report) or 'all shots present')

vf = '[0][1]overlay=format=auto,format=yuv420p' + (',scale=960:540' if preview else '') + '[v]'
cmd = [FF, '-v', 'error', '-y',
       '-framerate', str(fps), '-i', os.path.join(seq, '%06d.jpg'),
       '-framerate', str(fps), '-i', os.path.join(HERE, 'overlay', '%06d.png'),
       '-i', MIX,
       '-filter_complex', vf + ';[2]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]',
       '-map', '[v]', '-map', '[a]',
       '-c:v', 'libx264', '-preset', 'veryfast' if preview else 'slow', '-crf', '23' if preview else '15',
       '-tune', 'film', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(fps),
       '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-t', str(T['total']), OUT]
subprocess.run(cmd, check=True)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
