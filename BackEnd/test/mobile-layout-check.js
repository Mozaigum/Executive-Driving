import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'output/mobile-layout');await mkdir(output,{recursive:true});
const origin=process.env.PREVIEW_ORIGIN || 'http://localhost:5500';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const width of [320,360,390,430,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    for(const file of ['booking','index','events']) {
      await page.goto(`${origin}/${file}.html`,{waitUntil:'networkidle'});
      const form=page.locator(file==='booking'?'#booking-form':'#client-form');
      assert.equal(await page.evaluate(()=>document.activeElement.matches('input, textarea, select')),false,`${file}/${width}: no automatic field focus`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${file}/${width}: no horizontal overflow`);
      if(width<=960) {
        const navigationSize=()=>page.locator('#site-header').evaluate(header=>({height:header.getBoundingClientRect().height,logoHeight:header.querySelector('.logo-img').getBoundingClientRect().height}));
        const initial=await navigationSize();
        await page.evaluate(()=>scrollTo({top:180,behavior:'instant'}));
        await page.waitForTimeout(350);
        assert.deepEqual(await navigationSize(),initial,`${file}/${width}: mobile header and logo stay the same size on scroll`);
        assert.ok(Math.abs(await page.locator('#site-header').evaluate(header=>header.getBoundingClientRect().top))<1,`${file}/${width}: header stays at the top`);
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      }
      if(file==='events') {
        const toggle=page.locator('#customEventToggle');
        const activate=locator=>width<768?locator.tap():locator.click();
        for(let attempt=0;attempt<2;attempt++) {
          await activate(toggle);
          assert.equal(await page.locator('#customEventPanel').isVisible(),true);
          assert.equal(await page.evaluate(()=>document.activeElement.matches('input, textarea, select')),false,`${width}: opening custom event never focuses an editable field`);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          await activate(page.locator('#customEventName'));
          assert.equal(await page.locator('#customEventName').evaluate(input=>document.activeElement===input),true,`${width}: selecting the field allows typing`);
          await activate(page.locator('#closeCustomEvent'));
          assert.equal(await page.locator('#customEventPanel').isHidden(),true);
        }
        await activate(page.locator('#openFilters'));
        if(width<768)assert.equal(await page.evaluate(()=>document.activeElement.matches('input, textarea, select')),false,`${width}: opening filters does not open the keyboard`);
        await activate(toggle);
        assert.equal(await page.locator('#eventFilters').getAttribute('aria-hidden'),'true');
        assert.equal(await page.evaluate(()=>document.activeElement.matches('input, textarea, select')),false,`${width}: switching from filters keeps the keyboard closed`);
        if(width===390)await page.locator('#customEventPanel').screenshot({path:path.join(output,'custom-event-390.png')});
        await activate(page.locator('#closeCustomEvent'));
        console.log(`events ${width}px: custom-event focus, reopen, field tap and filters PASS`);
      }
      const inputs=await form.locator('input:not([type="checkbox"]):not([type="radio"])').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{const box=node.getBoundingClientRect();const parent=node.parentElement.getBoundingClientRect();return {name:node.name,x:box.x,y:box.y,width:box.width,height:box.height,parentWidth:parent.width};}));
      for(const input of inputs) {assert.ok(Math.abs(input.height-48)<1,`${file}/${width}/${input.name}: equal 48px input height`);assert.ok(Math.abs(input.width-input.parentWidth)<1,`${file}/${width}/${input.name}: full field width`);}
      const name=inputs.find(input=>input.name==='name'),phone=inputs.find(input=>input.name==='phone');
      assert.ok(Math.abs(name.y-phone.y)<1,`${file}/${width}: name and phone aligned`);
      assert.ok(Math.abs(name.width-phone.width)<1,`${file}/${width}: equal contact widths`);
      if(width<=680) {
        const email=inputs.find(input=>input.name==='email'),date=inputs.find(input=>input.name==='date');
        assert.ok(Math.abs((email.y-phone.y)-92)<1,`${file}/${width}: consistent contact-to-email spacing`);
        if(file==='booking') {
          const fullNames=['email','pickup','dropoff','date','time'];
          for(let index=1;index<fullNames.length;index++)assert.ok(Math.abs(inputs.find(input=>input.name===fullNames[index]).y-inputs.find(input=>input.name===fullNames[index-1]).y-92)<1,`${file}/${width}: consistent field spacing`);
          const passengers=inputs.find(input=>input.name==='passengers'),luggage=inputs.find(input=>input.name==='luggage');assert.ok(Math.abs(passengers.y-luggage.y)<1);assert.ok(Math.abs(passengers.width-luggage.width)<1);
        } else assert.ok(Math.abs(date.y-email.y-92)<1,`${file}/${width}: consistent Client Care spacing`);
      }
      if(file==='booking') {
        for(const id of ['returnTrip','alcoholService','nonAlcoholicService'])await page.locator('label').filter({has:page.locator('#'+id)}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${file}/${width}: expanded options do not overflow`);
        for(const panel of await form.locator('.refreshment-fields').evaluateAll(nodes=>nodes.map(node=>{
          const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,right:r.right,bottom:r.bottom};};
          return {id:node.id,panel:box(node),legend:box(node.querySelector('legend')),field:box(node.querySelector('.field')),textarea:box(node.querySelector('textarea'))};
        }))) {
          assert.ok(Math.abs(panel.field.x-panel.legend.x)<1,`${width}/${panel.id}: drink field aligns with its heading`);
          assert.ok(Math.abs(panel.field.width-panel.legend.width)<1,`${width}/${panel.id}: drink field fills the panel content width`);
          assert.ok(panel.field.y>=panel.legend.bottom+7,`${width}/${panel.id}: drink field stays below its heading`);
          assert.ok(panel.textarea.x>=panel.panel.x && panel.textarea.right<=panel.panel.right,`${width}/${panel.id}: textarea stays inside the panel`);
        }
        for(const input of await form.locator('#returnTripFields input').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {height:r.height,width:r.width,parentWidth:node.parentElement.getBoundingClientRect().width};}))) {assert.ok(Math.abs(input.height-48)<1);assert.ok(Math.abs(input.width-input.parentWidth)<1);}
      }
      if(width===390 || width===1440) {
        await form.locator('[name="name"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(650);
        await page.screenshot({path:path.join(output,`${file}-${width}-contact.png`)});
        if(file==='booking') {await page.locator('#returnTripFields').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`return-${width}.png`)});}
      }
      console.log(`${file} ${width}px: input sizes, spacing, alignment and focus PASS`);
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser.close();}
