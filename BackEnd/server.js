import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { renderBookingEmail, renderCustomerConfirmationEmail, renderConciergeEmail } from './emails.js';
import { validateBooking, ValidationError, text, validEmail } from './validation.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({path:path.join(directory,'.env')});
const digest = value => createHash('sha256').update(value).digest('hex');
function rateLimit(limit, windowMs = 60000) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of clients) if (entry.until <= now) clients.delete(key);
    const key = req.ip;
    const entry = clients.get(key) || {count:0,until:now + windowMs};
    clients.set(key, entry);
    if (++entry.count > limit) { res.set('Retry-After',String(Math.ceil((entry.until-now)/1000))); return res.status(429).json({ok:false,error:'Too many requests. Please try again shortly.'}); }
    next();
  };
}
async function writeRecord(file, record) {
  await fs.mkdir(path.dirname(file), {recursive:true,mode:0o700});
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(record,null,2), {mode:0o600});
  await fs.rename(temporary,file);
}
async function readRecord(file) {
  try { return JSON.parse(await fs.readFile(file,'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function bookingNotes(b) {
  const additions = [b.serviceType && `Service: ${b.serviceType}`,
    b.returnJourney && `RETURN JOURNEY\nPickup: ${b.returnJourney.pickup}\nDestination: ${b.returnJourney.dropoff}\nDate: ${b.returnJourney.date}\nPickup time: ${b.returnJourney.time}`,
    b.alcoholService && `LIQUOR SERVICE REQUEST\n${b.serviceRefreshmentPreferences}`,
    b.nonAlcoholicService && `NON-ALCOHOLIC REFRESHMENTS\n${b.refreshmentPreferences}`];
  // Older clients already include structured extras in notes.
  return [b.notes,...additions.filter(section=>section && !b.notes.includes(section))].filter(Boolean).join('\n\n');
}

export function createApp({env = process.env, mailer, dataDir, fetcher = fetch, bookingLimit = 10} = {}) {
  const app = express();
  const storage = dataDir || env.DATA_DIR || path.join(directory,'data');
  const transport = mailer || nodemailer.createTransport({host:env.SMTP_HOST || 'smtp.office365.com',port:Number(env.SMTP_PORT || 587),secure:env.SMTP_PORT === '465',requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},tls:{minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
  const origins = new Set((env.ALLOWED_ORIGINS || 'https://executivedriving.ca,https://www.executivedriving.ca,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080').split(',').map(s=>s.trim()).filter(Boolean));
  app.disable('x-powered-by');
  if (/^\d+$/.test(env.TRUST_PROXY_HOPS || '')) app.set('trust proxy',Number(env.TRUST_PROXY_HOPS));
  app.use(cors({origin:(origin,done)=>done(null,!origin || origins.has(origin)),methods:['GET','POST','OPTIONS']}));
  app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');if (req.headers.origin && !origins.has(req.headers.origin)) return res.status(403).json({ok:false,error:'Origin is not allowed.'});next();});
  app.use(rateLimit(120));
  app.use(express.json({limit:'32kb',strict:true}));
  app.get('/health', (_req,res)=>res.json({ok:true}));
  const inflight = new Set();
  app.post('/book', rateLimit(bookingLimit), async (req,res,next)=>{
    let key, ownsKey = false;
    try {
      const b = validateBooking(req.body);
      if (!env.BOOKING_EMAIL_TO || !(env.BOOKING_EMAIL_FROM || env.SMTP_USER)) return res.status(503).json({ok:false,error:'Booking is temporarily unavailable. Please call 825-973-9800.'});
      const supplied = req.get('Idempotency-Key');
      if (supplied && !/^[a-zA-Z0-9_-]{16,100}$/.test(supplied)) throw new ValidationError('Invalid request identifier.');
      const fingerprint = digest(JSON.stringify(b));
      key = supplied ? digest(supplied) : fingerprint;
      if (inflight.has(key)) return res.status(409).json({ok:false,error:'This request is already being submitted. Please wait.'});
      inflight.add(key); ownsKey = true;
      const file = path.join(storage,'bookings',`${key}.json`);
      let record = await readRecord(file);
      if (record && record.fingerprint !== fingerprint) return res.status(409).json({ok:false,error:'Request details changed. Please submit again.'});
      if (record?.status === 'sent') return res.json({ok:true,reference:record.id,customerEmailSent:record.customerEmailSent || false});
      record ||= {id:randomUUID(),createdAt:new Date().toISOString(),fingerprint,booking:b,status:'pending'};
      await writeRecord(file,record);
      const from = env.BOOKING_EMAIL_FROM || env.SMTP_USER;
      const notes = bookingNotes(b);
      const emailDetails = {...b,notes,reference:record.id,createdAt:record.createdAt};
      const attachments = [{filename:'executive-driving.png',path:path.join(directory,'assets','logo-email-dark.png'),cid:'executive-logo'}];
      try {
        await transport.sendMail({to:env.BOOKING_EMAIL_TO,from,replyTo:b.email,subject:b.type === 'concierge' ? `Client Care Request — ${b.name}` : `New ride request | ${b.name} | ${b.date}`,html:b.type === 'concierge' ? renderConciergeEmail(emailDetails) : renderBookingEmail(emailDetails),attachments});
      } catch {
        record.status = 'delivery_failed'; await writeRecord(file,record);
        return res.status(503).json({ok:false,reference:record.id,error:'Your details were saved, but delivery to our team failed. Please retry or call 825-973-9800 with reference '+record.id+'.'});
      }
      record.status = 'sent'; record.sentAt = new Date().toISOString();
      await writeRecord(file,record);
      let customerEmailSent = false;
      if (b.type !== 'concierge') {
        try { await transport.sendMail({to:b.email,from,subject:`Request received | Executive Driving | ED-${record.id.replace(/-/g,'').slice(0,8).toUpperCase()}`,html:renderCustomerConfirmationEmail(emailDetails),replyTo:env.BOOKING_EMAIL_TO,attachments});customerEmailSent = true; }
        catch { /* Team delivery succeeded. Avoid prompting a duplicate request. */ }
      }
      record.customerEmailSent = customerEmailSent; await writeRecord(file,record);
      res.json({ok:true,reference:record.id,customerEmailSent});
    } catch (error) { next(error); }
    finally { if (ownsKey) inflight.delete(key); }
  });

  async function getJSON(url, options = {}) {
    const response = await fetcher(url,{...options,signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Upstream service unavailable');
    const data = await response.json();
    if (data.error || data.errors || data.fault) throw new Error('Upstream service rejected request');
    return data;
  }
  const citiesFor = value => {
    if (value == null || value === 'all') return ['Edmonton','Grande Prairie'];
    if (typeof value !== 'string') throw new ValidationError('Invalid city.');
    const cities = {edmonton:'Edmonton',gp:'Grande Prairie','grande prairie':'Grande Prairie'};
    if (!Object.hasOwn(cities,value.toLowerCase())) throw new ValidationError('Invalid city.');
    return [cities[value.toLowerCase()]];
  };
  const cache = new Map();
  async function cached(key,load) {
    let entry = cache.get(key);
    if (!entry || entry.until < Date.now()) {
      entry = {until:Date.now()+300000,value:Promise.resolve().then(load)};
      cache.set(key,entry);
      entry.value.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
    }
    return entry.value;
  }
  app.get('/api/events/ticketmaster', async(req,res,next)=>{
    try {
      if (!env.TICKETMASTER_KEY) return res.status(503).json({error:'Events are temporarily unavailable.'});
      const cities = citiesFor(req.query.city);
      const events = await cached(`tm:${cities.join(',')}`,async()=>{
        const batches = await Promise.all(cities.map(async city=>{
          const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
          url.search = new URLSearchParams({apikey:env.TICKETMASTER_KEY,city,size:'100',sort:'date,asc'}).toString();
          const data = await getJSON(url);
          return (data._embedded?.events || []).map(e=>({id:e.id,name:e.name,date:e.dates?.start?.localDate,time:e.dates?.start?.localTime,timeZone:e.dates?.timezone || 'America/Edmonton',venue:e._embedded?.venues?.[0]?.name,address:e._embedded?.venues?.[0]?.address?.line1,city:e._embedded?.venues?.[0]?.city?.name,classification:e.classifications?.[0]?.segment?.name,genre:e.classifications?.[0]?.genre?.name,images:e.images || []}));
        }));
        return [...new Map(batches.flat().map(e=>[e.id,e])).values()];
      });
      res.json({ok:true,cities,count:events.length,events});
    } catch(error) {next(error);}
  });
  app.get('/api/events/nightlife',async(req,res,next)=>{
    try {
      const placesKey = env.GOOGLE_PLACES_KEY || env.GOOGLE_MAPS_API_KEY;
      if (!placesKey) return res.status(503).json({error:'Nightlife listings are temporarily unavailable.'});
      const cities = citiesFor(req.query.city);
      const events = await cached(`night:${cities.join(',')}`,async()=>{
        const coordinates = {'Edmonton':{latitude:53.5461,longitude:-113.4938},'Grande Prairie':{latitude:55.1707,longitude:-118.7947}};
        return (await Promise.all(cities.map(async city=>{
          const data = await getJSON('https://places.googleapis.com/v1/places:searchNearby',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':placesKey,'X-Goog-FieldMask':'places.displayName,places.formattedAddress,places.id'},body:JSON.stringify({locationRestriction:{circle:{center:coordinates[city],radius:8000}},includedTypes:['bar'],rankPreference:'POPULARITY',maxResultCount:20})});
          return (data.places || []).map(p=>({id:p.id,name:p.displayName?.text || 'Unnamed venue',venue:p.formattedAddress,city,date:null,time:null,type:'nightlife'}));
        }))).flat();
      });
      res.json({events});
    } catch(error) {next(error);}
  });
  app.post('/api/notify/subscribe',rateLimit(10),async(req,res,next)=>{
    try {
      const email = text(req.body?.email,'Email',254).toLowerCase();
      if (!validEmail(email)) throw new ValidationError('Please enter a valid email.');
      const categories = req.body.categories;
      if (!Array.isArray(categories) || !categories.length || categories.length > 5 || categories.some(c=>!['concert','sports','nightlife','arts','family'].includes(c))) throw new ValidationError('Please select valid categories.');
      const city = text(req.body.city ?? 'all','City',500);
      await writeRecord(path.join(storage,'subscriptions',`${digest(email)}.json`),{email,categories:[...new Set(categories)],city,updatedAt:new Date().toISOString()});
      res.json({success:true,message:'Your notification preferences were saved.'});
    } catch(error) {next(error);}
  });
  // Chatbot, knowledge maintenance tools and unrestricted URL proxy removed.
  app.use((error,_req,res,_next)=>{
    const status = error instanceof ValidationError || error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 502;
    res.status(status).json({ok:false,error:status === 400 ? (error instanceof ValidationError ? error.message : 'Invalid JSON request.') : status === 413 ? 'Request is too large.' : 'Unable to complete the request. Please try again or call 825-973-9800.'});
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port,()=>console.log(`Executive Driving server listening on port ${port}`));
}
