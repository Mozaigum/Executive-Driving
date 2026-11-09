import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Render the existing dark vector logo for broad email-client support.
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:700,height:450},deviceScaleFactor:2});
  const source=(await readFile(new URL('../../FrontEnd/images/logo.svg',import.meta.url),'utf8'));
  await page.setContent(`<style>body{margin:0;background:transparent}svg{display:block}</style>${source}`);
  await page.locator('svg').evaluate(svg=>{
    const box=svg.getBBox();
    svg.setAttribute('viewBox',`${box.x-3} ${box.y-3} ${box.width+6} ${box.height+6}`);
    svg.setAttribute('width','180');
    svg.setAttribute('height',String(180*(box.height+6)/(box.width+6)));
  });
  await page.locator('svg').screenshot({path:fileURLToPath(new URL('../assets/logo-email-dark.png',import.meta.url)),omitBackground:true});
  await writeFile(new URL('../assets/logo-email-dark.svg',import.meta.url),await page.locator('svg').evaluate(svg=>svg.outerHTML));
  console.log('Prepared email logo from the existing company vector.');
} finally {await browser.close();}
