import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://connect-shader.off-brand.workers.dev/?factory=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const tw = document.querySelector('canvas.lab-canvas-twizzler');
  const out = document.querySelector('canvas.lab-canvas-output');
  const readNonClear = (c) => {
    if (!c) return null;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { err: 'no2d', w: c.width, h: c.height, hidden: c.hidden };
    // output may be webgl - try read anyway
    let data;
    try { data = ctx.getImageData(0,0,Math.min(c.width,64),Math.min(c.height,64)).data; } catch(e) { return { err: String(e), w:c.width,h:c.height,hidden:c.hidden }; }
    let non=0, orange=0;
    for (let i=0;i<data.length;i+=4){
      if (data[i+3]>10){ non++; if(data[i]>180 && data[i+1]<160 && data[i+2]<100) orange++; }
    }
    return { w:c.width,h:c.height,hidden:c.hidden, sampleNonZero:non, sampleOrange:orange, display:getComputedStyle(c).display, opacity:getComputedStyle(c).opacity, z:getComputedStyle(c).zIndex };
  };
  // for webgl output, draw to temp
  const probeGl = (c) => {
    if (!c) return null;
    const t = document.createElement('canvas');
    t.width = 64; t.height = 64;
    const tctx = t.getContext('2d');
    tctx.drawImage(c, 0, 0, 64, 64);
    const data = tctx.getImageData(0,0,64,64).data;
    let non=0, orange=0, alphaSum=0;
    for (let i=0;i<data.length;i+=4){
      alphaSum += data[i+3];
      if (data[i+3]>10){ non++; if(data[i]>180 && data[i+1]<160 && data[i+2]<100) orange++; }
    }
    return { w:c.width,h:c.height, sampleNonZero:non, sampleOrange:orange, avgAlpha: alphaSum/(64*64) };
  };
  const labels = [...document.querySelectorAll('.leva-c-kWgxhW, [class*="title"], label, div')].map(e=>e.textContent?.trim()).filter(Boolean).slice(0,0);
  const text = document.body.innerText;
  return {
    hasTwizzlerGeneral: text.includes('Twizzler General') || text.includes('General'),
    hasTwizzlerSection: /Twizzler/.test(text),
    cameraSnippet: (text.match(/Distance[\s\S]{0,80}/)||[])[0],
    connectCam: (text.match(/connectCamera|Rotate X|Distance[\s\S]{0,40}/)||[]).slice(0,3),
    presetLine: (text.match(/Connect[^\n]*/)||[])[0],
    twizzler: readNonClear(tw),
    output: probeGl(out),
    twizzlerHtml: tw ? { hidden: tw.hidden, width: tw.width, height: tw.height } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '.tmp/twizzler-check2.png', fullPage: false });
await browser.close();
