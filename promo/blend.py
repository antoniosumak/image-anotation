import sys, subprocess, numpy as np
from PIL import Image
src, out, ff = sys.argv[1], sys.argv[2], sys.argv[3]
import os
files = sorted(os.listdir(src)); assert len(files) % 4 == 0
p = subprocess.Popen([ff, '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1440x1440', '-r', '60', '-i', '-',
                      '-c:v', 'libx264', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'yuv444p', out], stdin=subprocess.PIPE)
for i in range(0, len(files), 4):
    acc = sum(np.asarray(Image.open(os.path.join(src, f)).convert('RGB'), dtype=np.float32) for f in files[i:i + 4])
    p.stdin.write((acc / 4 + 0.5).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
print(len(files) // 4, 'frames')
