import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderCustomerConfirmationEmail,renderBookingEmail,renderConciergeEmail} from '../emails.js';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'output/email-preview');
await mkdir(output,{recursive:true});
const sample={reference:'72c4a8b1-ff81-4477-8f49-615ef79fa229',createdAt:'2026-11-08T18:30:00Z',name:'Alex Morgan',email:'alex@example.com',phone:'825-555-0142',serviceType:'Airport transfer',pickup:'Edmonton International Airport (YEG)\nArrivals — passenger pickup',dropoff:'Fairmont Hotel Macdonald\n10065 100 Street NW, Edmonton',date:'2026-11-20',time:'16:30',passengers:2,luggage:3,flightNumber:'AC 173',returnTrip:true,returnJourney:{pickup:'Fairmont Hotel Macdonald, Edmonton',dropoff:'Edmonton International Airport (YEG)',date:'2026-11-23',time:'08:00'},alcoholService:true,serviceRefreshmentPreferences:'Champagne for two; please confirm available options.',nonAlcoholicService:true,refreshmentPreferences:'Still water and sparkling water.',customerNotes:'Please meet us at arrivals. One passenger will need a little extra time with luggage.'};
const logoData='data:image/png;base64,'+(await readFile(new URL('../assets/logo-email-dark.png',import.meta.url))).toString('base64');
const originalLogoData='data:image/png;base64,'+(await readFile(new URL('../assets/logo-email.png',import.meta.url))).toString('base64');
const examples={customer:renderCustomerConfirmationEmail(sample),team:renderBookingEmail(sample),enquiry:renderConciergeEmail({...sample,details:'Please advise on transport options for a corporate dinner for six guests.'})};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const [name,html] of Object.entries(examples)) {
    const file=path.join(output,`${name}.html`);await writeFile(file,html.replaceAll('cid:executive-logo',name==='team'?originalLogoData:logoData));
    const page=await browser.newPage({viewport:{width:800,height:1000},deviceScaleFactor:1});
    const captureThemes=async size=>{
      await page.emulateMedia({colorScheme:'light'});
      const light=await page.screenshot({path:path.join(output,`${name}-${size}.png`),fullPage:true});
      await page.emulateMedia({colorScheme:'dark'});
      const dark=await page.screenshot({path:path.join(output,`${name}-${size}-dark.png`),fullPage:true});
      assert.deepEqual(dark,light,`${name}/${size}: browser dark preference preserves the light design`);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
      await page.emulateMedia({colorScheme:'light'});
    };
    await page.goto(pathToFileURL(file).href);await captureThemes('desktop');
    if(name==='customer'||name==='team') {
      await page.setViewportSize({width:390,height:844});
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile email overflow');
      await captureThemes('mobile');
    }
    await page.close();
  }
  console.log('Rendered actual email templates; light/dark browser previews match on desktop and mobile. Actual mail-app forced colour conversion is not emulated. No emails sent.');
} finally {await browser.close();}
