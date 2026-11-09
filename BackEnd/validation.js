export class ValidationError extends Error {}
const fail = message => { throw new ValidationError(message); };
export function text(value, label, max = 500, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) fail(`Please enter a valid ${label.toLowerCase()}.`);
  return clean;
}
export const validEmail = email => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
export function calendarDate(value, label) {
  const date = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`Please enter a valid ${label.toLowerCase()}.`);
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date) fail(`Please enter a valid ${label.toLowerCase()}.`);
  return date;
}
function todayInAlberta(now) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = name => parts.find(p=>p.type===name).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function time(value,label) {
  const result = text(value,label,5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) fail(`Please enter a valid ${label.toLowerCase()}.`);
  return result;
}
function flag(value,label) {
  if (value == null) return false;
  if (typeof value !== 'boolean') fail(`${label} must be true or false.`);
  return value;
}
export function validateBooking(body,now=new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Please provide a booking request.');
  const b={type:body.type==='concierge'?'concierge':'booking'};
  b.name=text(body.name,'Name',120); b.phone=text(body.phone,'Phone',40);
  if (!/^(?:1)?\d{10}$/.test(b.phone.replace(/\D/g,''))) fail('Please enter a Canadian/US phone number with area code.');
  b.email=text(body.email,'Email',254);
  if (!validEmail(b.email)) fail('Please enter a valid email address.');
  b.date=calendarDate(body.date,'Pickup date');
  if (b.date<todayInAlberta(now)) fail('Please choose today or a future pickup date.');
  if (b.type==='concierge') { b.details=text(body.details,'Details',5000,false); return b; }
  b.pickup=text(body.pickup,'Pickup address'); b.dropoff=text(body.dropoff,'Destination'); b.time=time(body.time,'Pickup time');
  const passengers=typeof body.passengers==='string' && /^\d+$/.test(body.passengers)?Number(body.passengers):body.passengers;
  if (!Number.isInteger(passengers)||passengers<1||passengers>14) fail('Passengers must be a whole number between 1 and 14.');
  b.passengers=passengers; b.serviceType=text(body.serviceType,'Service',100,false); b.notes=text(body.notes,'Notes',10000,false);
  if (body.customerNotes !== undefined) b.customerNotes=text(body.customerNotes,'Customer notes',5000,false);
  b.flightNumber=text(body.flightNumber,'Flight number',40,false);
  b.requestedVehicle=text(body.requestedVehicle,'Vehicle preference',100,false);
  if (body.luggage !== undefined && body.luggage !== '') {
    const bags=typeof body.luggage==='string' && /^\d+$/.test(body.luggage)?Number(body.luggage):body.luggage;
    if (!Number.isInteger(bags)||bags<0||bags>20) fail('Luggage must be a whole number between 0 and 20.');
    b.luggage=bags;
  }
  b.returnTrip=flag(body.returnTrip,'Return trip'); b.alcoholService=flag(body.alcoholService??body.AlcoholService,'Alcohol service'); b.nonAlcoholicService=flag(body.nonAlcoholicService,'Non-alcoholic service');
  if (b.returnTrip) {
    const r=body.returnJourney;
    if (!r||typeof r!=='object'||Array.isArray(r)) fail('Please complete your return journey.');
    b.returnJourney={pickup:text(r.pickup,'Return pickup'),dropoff:text(r.dropoff,'Return destination'),date:calendarDate(r.date,'Return date'),time:time(r.time,'Return pickup time')};
    if (`${b.returnJourney.date}T${b.returnJourney.time}`<=`${b.date}T${b.time}`) fail('Return pickup must be after outbound pickup.');
  }
  if (b.alcoholService) b.serviceRefreshmentPreferences=text(body.serviceRefreshmentPreferences,'Liquor preferences',1000);
  if (b.nonAlcoholicService) b.refreshmentPreferences=text(body.refreshmentPreferences,'Non-alcoholic drink preferences',1000);
  return b;
}
