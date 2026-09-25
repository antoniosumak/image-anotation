// node render.mjs <worker> <workers> [fps] [sub]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
const FF = fs.readFileSync('ff.env', 'utf8').trim().split('=')[1];
const [w, W] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? 1)];
const FPS = Number(process.argv[4] ?? 60), SUB = Number(process.argv[5] ?? 4), T = 16;
const N = FPS * T;
const a = Math.floor((N * w) / W), b = Math.floor((N * (w + 1)) / W);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
await page.goto('file://' + process.cwd() + '/promo.html');
await page.waitForFunction(() => window.READY && window.seek);
const cdp = await page.context().newCDPSession(page);
const DISK = process.env.DISK === '1';
fs.mkdirSync(`sub_${w}`, { recursive: true });
const ff = DISK ? null : spawn(FF, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-',
  '-vf', `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`,
  '-r', String(FPS), '-c:v', 'libx264', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'yuv444p', `seg_${w}.mkv`], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = a; f < b; f++) {
  for (let j = 0; j < SUB; j++) {
    const t = f / FPS + (j - (SUB - 1) / 2) / (FPS * SUB);
    await page.evaluate(t => window.seek(t), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    if (DISK) fs.writeFileSync(`sub_${w}/${String((f - a) * SUB + j).padStart(6, '0')}.png`, Buffer.from(data, 'base64'));
    else if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  if ((f - a) % 60 === 0) console.log(`w${w} frame ${f}/${b} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
await browser.close();
console.log(`w${w} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
