import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.js';
import {validateBooking} from '../validation.js';

const base={name:'Test Guest',phone:'8259739800',email:'guest@example.test',pickup:'Edmonton Airport',dropoff:'Rogers Place, Edmonton',date:'2099-12-20',time:'18:00',passengers:'2',serviceType:'Airport transfer',notes:'Test only'};
const journey={pickup:base.dropoff,dropoff:base.pickup,date:base.date,time:'23:00'};
async function fixture(t,options={}) {
  const dataDir=await mkdtemp(path.join(tmpdir(),'executive-driving-test-'));
  const messages=[];
  const app=createApp({env:{BOOKING_EMAIL_TO:'team@example.test',SMTP_USER:'sender@example.test',TICKETMASTER_KEY:'test',GOOGLE_PLACES_KEY:'test',...options.env},dataDir,mailer:options.mailer || {sendMail:async message=>messages.push(message)},fetcher:options.fetcher});
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true});});
  return {dataDir,messages,origin,post:async(body,headers={})=>fetch(`${origin}/book`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})};
}
test('all eight combinations of return, liquor and non-alcoholic requests reach both emails',async t=>{
  const f=await fixture(t);
  for(let mask=0;mask<8;mask++) {
    const b={...base,notes:`Combination ${mask}`,returnTrip:!!(mask&1),alcoholService:!!(mask&2),nonAlcoholicService:!!(mask&4)};
    if(b.returnTrip)b.returnJourney=journey;
    if(b.alcoholService)b.serviceRefreshmentPreferences='Preferred liquor and ice';
    if(b.nonAlcoholicService)b.refreshmentPreferences='Sparkling water';
    const response=await f.post(b);assert.equal(response.status,200,await response.clone().text());
    assert.equal((await response.json()).ok,true);
    for(const email of f.messages.slice(-2)) {
      if(b.returnTrip)assert.match(email.html,/return trip/i);
      if(b.alcoholService)assert.match(email.html,/Preferred liquor and ice/);
      if(b.nonAlcoholicService)assert.match(email.html,/Sparkling water/);
    }
  }
  assert.equal(f.messages.length,16);
  assert.equal((await readdir(path.join(f.dataDir,'bookings'))).length,8);
  assert.ok(f.messages.every(message=>message.attachments?.some(item=>item.cid==='executive-logo')));
  assert.ok(f.messages.filter(message=>message.to===base.email).every(message=>message.subject.startsWith('Request received | Executive Driving | ED-')));
});
test('server rejects malformed contacts, dates, times, counts and conditional details',()=>{
  for(const change of [{email:'bad'},{phone:'123'},{date:'2099-02-31'},{date:'2000-01-01'},{time:'banana'},{passengers:0},{passengers:1.5},{passengers:{}},{returnTrip:true},{returnTrip:true,returnJourney:{...journey,time:'17:00'}},{alcoholService:true},{nonAlcoholicService:true},{alcoholService:'false'},{name:'   '},{pickup:{}}]) assert.throws(()=>validateBooking({...base,...change}));
});
test('retry after mail failure keeps saved request and idempotency prevents duplicates',async t=>{
  let fail=true;const messages=[];
  const f=await fixture(t,{mailer:{sendMail:async message=>{if(fail)throw Error('SMTP unavailable');messages.push(message);}}});
  const headers={'Idempotency-Key':'booking_retry_123456789'};
  let response=await f.post(base,headers);assert.equal(response.status,503);assert.match((await response.json()).error,/saved/);
  const files=await readdir(path.join(f.dataDir,'bookings'));assert.equal(files.length,1);
  assert.equal(JSON.parse(await readFile(path.join(f.dataDir,'bookings',files[0]))).status,'delivery_failed');
  fail=false;response=await f.post(base,headers);assert.equal(response.status,200);
  const reference=(await response.json()).reference;
  response=await f.post(base,headers);assert.equal((await response.json()).reference,reference);assert.equal(messages.length,2);
  response=await f.post({...base,notes:'Changed'},headers);assert.equal(response.status,409);
});
test('client care form works without a return-trip checkbox; HTML is escaped',async t=>{
  const f=await fixture(t);
  const response=await f.post({...base,type:'concierge',name:'<img src=x>',details:'<script>alert(1)</script>'});
  assert.equal(response.status,200);assert.equal(f.messages.length,1);
  assert.ok(!f.messages[0].html.includes('<script>'));assert.match(f.messages[0].html,/&lt;img/);
});
test('removed chatbot, maintenance and proxy routes cannot be called',async t=>{
  const f=await fixture(t);
  for(const [route,method] of [['/chat','POST'],['/kb/reset','POST'],['/kb','GET'],['/api/tm-image?url=http://127.0.0.1','GET']])assert.equal((await fetch(f.origin+route,{method})).status,404);
});
test('origin restrictions, JSON limits and booking throttling',async t=>{
  const f=await fixture(t);
  assert.equal((await f.post(base,{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await f.post({...base,notes:'x'.repeat(40000)})).status,413);
  for(let i=0;i<10;i++)assert.equal((await f.post({})).status,400);
  assert.equal((await f.post({})).status,429);
});
test('events preserve categories, fetch both nightlife cities, cache calls and reject provider errors',async t=>{
  const calls=[];
  const f=await fixture(t,{fetcher:async(url,options)=>{
    calls.push(String(url));
    if(String(url).includes('ticketmaster')){const city=new URL(url).searchParams.get('city');return {ok:true,json:async()=>({_embedded:{events:[{id:city,name:'Show',classifications:[{segment:{name:'Music'},genre:{name:'Rock'}}],dates:{start:{localDate:'2099-12-20',localTime:'19:00:00'}}}]}})};}
    return {ok:true,json:async()=>({places:[{id:JSON.parse(options.body).locationRestriction.circle.center.latitude,displayName:{text:'Venue'},formattedAddress:'Main Street'}]})};
  }});
  let response=await fetch(f.origin+'/api/events/ticketmaster?city=all');let data=await response.json();assert.equal(data.events.length,2);assert.equal(data.events[0].classification,'Music');
  await fetch(f.origin+'/api/events/ticketmaster?city=all');assert.equal(calls.length,2);
  data=await (await fetch(f.origin+'/api/events/nightlife?city=all')).json();assert.deepEqual(data.events.map(e=>e.city),['Edmonton','Grande Prairie']);
  assert.equal((await fetch(f.origin+'/api/events/ticketmaster?city[]=x')).status,400);
  const broken=await fixture(t,{fetcher:async()=>({ok:false})});assert.equal((await fetch(broken.origin+'/api/events/ticketmaster')).status,502);
});
test('subscription success represents a saved record',async t=>{
  const f=await fixture(t);const response=await fetch(f.origin+'/api/notify/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:base.email,categories:['concert'],city:'all'})});
  assert.equal(response.status,200);assert.equal((await readdir(path.join(f.dataDir,'subscriptions'))).length,1);
});

test('nightlife supports the existing Render Google Maps environment variable',async t=>{
  const f=await fixture(t,{env:{GOOGLE_PLACES_KEY:'',GOOGLE_MAPS_API_KEY:'legacy-test-key'},fetcher:async(_url,options)=>{
    assert.equal(options.headers['X-Goog-Api-Key'],'legacy-test-key');
    return {ok:true,json:async()=>({places:[]})};
  }});
  const response=await fetch(f.origin+'/api/events/nightlife?city=Edmonton');
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).events,[]);
});
