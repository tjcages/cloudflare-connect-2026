/** Exact Shadertoy formula → PNG for ground truth */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
mkdirSync('/opt/cursor/artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 400 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#000">
<canvas id="c" width="1600" height="400"></canvas>
<script>
const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const W=1600,H=400;
const img=ctx.createImageData(W,H);
const data=img.data;
const pi=Math.PI;
const n=40;
const iTime=0; // static
const m = (Math.floor(0.5*iTime)%10)+1;
for (let py=0; py<H; py++) {
  for (let px=0; px<W; px++) {
    const uvx = (px - 0.5*W) / H;
    const uvy = (py - 0.5*H) / H; // canvas y down → flip for GL-like up
    const uvyUp = -uvy;
    let s=0;
    for (let i=0; i<n; i++) {
      const t = 0.2*iTime + 2*pi*i/n;
      let y = Math.sin(t + 11*uvx) - 4*uvx*Math.cos(t*0.5);
      const k = 1/H;
      const d = -Math.abs(uvyUp - 0.25*y) + k;
      const edge = Math.max(0, Math.min(1, (d+k)/(2*k)));
      s = Math.max(s, edge*edge*(3-2*edge)); // smoothstep-ish
    }
    // CF-ish orange by x
    const xt = px/W;
    const r = Math.round(255*(0.95 - xt*0.15));
    const g = Math.round(255*(0.55 - xt*0.35));
    const b = Math.round(255*(0.25 - xt*0.1));
    const o = (py*W+px)*4;
    data[o]=Math.round(r*s); data[o+1]=Math.round(g*s); data[o+2]=Math.round(b*s); data[o+3]=255;
  }
}
ctx.putImageData(img,0,0);
// also white bg version
ctx.globalCompositeOperation='destination-over';
ctx.fillStyle='#fff';
ctx.fillRect(0,0,W,H);
</script></body></html>`);
await page.waitForTimeout(100);
// redraw white-bg properly
await page.evaluate(() => {
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');
  const W=1600,H=400;
  const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H;
  const tctx=tmp.getContext('2d');
  const img=tctx.createImageData(W,H);
  const data=img.data;
  const pi=Math.PI, n=40, iTime=0;
  for (let py=0; py<H; py++) {
    for (let px=0; px<W; px++) {
      const uvx=(px-0.5*W)/H;
      const uvyUp=-(py-0.5*H)/H;
      let s=0;
      for (let i=0;i<n;i++){
        const t=0.2*iTime+2*pi*i/n;
        const y=Math.sin(t+11*uvx)-4*uvx*Math.cos(t*0.5);
        const k=1/H;
        const d=-Math.abs(uvyUp-0.25*y)+k;
        const e=Math.max(0,Math.min(1,(d+k)/(2*k)));
        s=Math.max(s,e*e*(3-2*e));
      }
      const xt=px/W;
      const r=Math.round(232*(0.55+0.45*xt));
      const g=Math.round(72*(0.4+0.3*(1-xt)));
      const b=Math.round(28);
      const o=(py*W+px)*4;
      // white bg composite: mix white with color by s
      data[o]=Math.round(255*(1-s)+r*s);
      data[o+1]=Math.round(255*(1-s)+g*s);
      data[o+2]=Math.round(255*(1-s)+b*s);
      data[o+3]=255;
    }
  }
  tctx.putImageData(img,0,0);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.drawImage(tmp,0,0);
});
await page.locator('#c').screenshot({ path: '/opt/cursor/artifacts/SHADERTOY-ref-exact.png', type: 'png' });
await browser.close();
console.log('wrote SHADERTOY-ref-exact.png');
