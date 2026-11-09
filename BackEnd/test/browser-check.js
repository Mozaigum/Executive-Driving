import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const frontend=path.join(root,'FrontEnd');
const output=path.join(root,'output/repair-checks');await mkdir(output,{recursive:true});
const storage=await mkdtemp(path.join(tmpdir(),'xd-browser-'));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4'};
const staticServer=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(frontend,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(frontend+path.sep)) {res.writeHead(403).end();return;}
    const contents=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target).toLowerCase()]||'application/octet-stream'});res.end(contents);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
const site=`http://127.0.0.1:${staticServer.address().port}`;
const messages=[];let failMail=false;
const api=createApp({bookingLimit:100,dataDir:storage,env:{ALLOWED_ORIGINS:site,BOOKING_EMAIL_TO:'team@example.test',SMTP_USER:'sender@example.test'},mailer:{sendMail:async message=>{if(failMail)throw Error('Test failure');messages.push(message);}}}).listen(0,'127.0.0.1');
await new Promise(resolve=>api.once('listening',resolve));
const apiURL=`http://127.0.0.1:${api.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try {
  for(const mobile of [false,true]) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},timezoneId:'America/New_York',isMobile:mobile,hasTouch:mobile});
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith('http://localhost:3001') || url.startsWith('https://executive-driving-backend-')) {
        const u=new URL(url);if(u.pathname==='/book' && route.request().method()==='POST')await new Promise(resolve=>setTimeout(resolve,500));return route.fulfill({response:await route.fetch({url:apiURL+u.pathname+u.search})});
      }
      if(url.startsWith(site))return route.continue();
      return route.abort();
    });
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',async dialog=>{errors.push('Unexpected dialog: '+dialog.message());await dialog.dismiss();});
    const fill=async()=>{
      await page.goto(site+'/booking.html',{waitUntil:'networkidle'});
      await page.getByRole('combobox',{name:'Service',exact:true}).click();
      await page.getByRole('option',{name:'Airport transfer',exact:true}).click();
      const data={name:'Browser Test',phone:'8259739800',email:'browser@example.test',pickup:'Edmonton Airport',dropoff:'Rogers Place, Edmonton',date:'2099-12-20',time:'18:00',passengers:'2'};
      for(const [name,value] of Object.entries(data))await page.locator(`#booking-form [name="${name}"]`).fill(value);
    };
    for(let mask=0;mask<8;mask++) {
      await fill();
      if(mask&1){await page.locator('label').filter({has:page.locator('#returnTrip')}).click();await page.locator('[name="returnTime"]').fill('23:00');}
      if(mask&2){await page.locator('label').filter({has:page.locator('#alcoholService')}).click();await page.locator('#serviceRefreshmentPreferences').fill('Preferred liquor with ice');}
      if(mask&4){await page.locator('label').filter({has:page.locator('#nonAlcoholicService')}).click();await page.locator('#refreshmentPreferences').fill('Sparkling water');}
      await page.locator('[name="notes"]').fill(`Browser ${mobile?'mobile':'desktop'} combination ${mask}`);
      if(mask===7){await page.locator('#returnTripFields').screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-return.png`)});await page.locator('.alcohol-field').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-drinks.png`)});}
      const before=messages.length;
      const response=page.waitForResponse(r=>r.url().endsWith('/book')&&r.request().method()==='POST');
      await page.locator('#booking-form [type="submit"]').click();
      assert.equal(await page.locator('#booking-form [type="submit"]').isDisabled(),true);
      assert.match(await page.locator('#booking-form [type="submit"]').textContent(),/Sending/);
      assert.equal(await page.locator('.submission-progress').isVisible(),true);
      if(mask===0)await page.locator('.booking-actions').screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-loading.png`)});
      const reply=await response;assert.equal(reply.status(),200);
      await page.waitForURL('**/thank-you.html#received');
      await page.locator('#receiptTitle').filter({hasText:'Request received'}).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('.site-footer').count(),1);
      assert.equal(await page.locator('#site-header').count(),1);
      assert.ok(await page.locator('#receiptReference').textContent());
      if(mask===7) {await page.screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-thank-you.png`),fullPage:true,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
      assert.equal(messages.length,before+2);
      if(mask&1)assert.match(messages.at(-2).html,/return trip/i);
      if(mask&2)assert.match(messages.at(-2).html,/Preferred liquor with ice/);
      if(mask&4)assert.match(messages.at(-2).html,/Sparkling water/);
      results.push(`${mobile?'mobile':'desktop'} combination ${mask}: submitted`);
    }
    await fill();
    const beforeInvalidPhone=messages.length;
    await page.locator('[name="phone"]').fill('123');
    await page.locator('#booking-form [type="submit"]').click();
    assert.match(await page.locator('[name="phone"]').evaluate(el=>el.validationMessage),/10-digit/);
    assert.equal(messages.length,beforeInvalidPhone);
    await page.locator('[name="phone"]').fill('8259739800');
    await page.locator('label').filter({has:page.locator('#returnTrip')}).click();
    await page.locator('[name="returnTime"]').fill('17:00');
    await page.locator('#booking-form [type="submit"]').click();
    assert.match(await page.locator('[name="returnTime"]').evaluate(el=>el.validationMessage),/after/);
    await page.locator('label').filter({has:page.locator('#returnTrip')}).click();
    await page.locator('label').filter({has:page.locator('#alcoholService')}).click();
    await page.locator('#booking-form [type="submit"]').click();
    assert.ok(await page.locator('#serviceRefreshmentPreferences').evaluate(el=>!el.validity.valid));
    await page.locator('label').filter({has:page.locator('#alcoholService')}).click();
    failMail=true;
    let response=page.waitForResponse(r=>r.url().endsWith('/book')&&r.request().method()==='POST');await page.locator('#booking-form [type="submit"]').click();assert.equal((await response).status(),503);
    await page.getByRole('status').filter({hasText:'delivery to our team failed'}).waitFor();
    assert.equal(await page.locator('[name="name"]').inputValue(),'Browser Test');
    failMail=false;
    response=page.waitForResponse(r=>r.url().endsWith('/book')&&r.request().method()==='POST');await page.locator('#booking-form [type="submit"]').click();assert.equal((await response).status(),200);
    await page.waitForURL('**/thank-you.html#received');
    results.push(`${mobile?'mobile':'desktop'} invalid return, missing liquor, toggles off and delivery retry: passed`);
    for(const name of ['index','events','fleet','team']) {await page.goto(`${site}/${name}.html`,{waitUntil:'networkidle'});assert.equal(await page.locator('.xd-chat').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow`);}
    // Client care used to crash because it referenced a nonexistent return checkbox.
    await page.goto(site+'/index.html',{waitUntil:'networkidle'});
    for(const [name,value] of Object.entries({name:'Client Care Test',phone:'8259739800',email:'care@example.test',date:'2099-12-20',details:'Care request'}))await page.locator(`#client-form [name="${name}"]`).fill(value);
    const careResponse=page.waitForResponse(r=>r.url().endsWith('/book')&&r.request().method()==='POST');await page.locator('#client-form [type="submit"]').click();assert.equal((await careResponse).status(),200);
    await page.waitForURL('**/thank-you.html#received');
    assert.match(await page.locator('#receiptMessage').textContent(),/enquiry/);
    assert.equal(await page.locator('#receiptSummary').isVisible(),false);
    await page.evaluate(()=>sessionStorage.removeItem('xd-request-receipt'));
    await page.goto(site+'/thank-you.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('#receivedContent').isVisible(),false);
    assert.match(await page.locator('#receiptTitle').textContent(),/plan your journey/);
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log(results.join('\n'));console.log('PASS: Chrome desktop/mobile forms, real HTTP backend, captured emails, validation, retry, client care and page smoke checks.');
} finally {await browser.close();await new Promise(resolve=>api.close(resolve));await new Promise(resolve=>staticServer.close(resolve));await rm(storage,{recursive:true,force:true});}
