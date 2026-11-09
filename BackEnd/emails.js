const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=value=>esc(value).replace(/\r?\n/g,'<br>');
const espresso='#231f20',coffee='#666868',gold='#be1e2d',paper='#ffffff';
const mono="'Courier New',Courier,monospace";
function starLine() {
  return `<table role="presentation" aria-hidden="true" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:19px 0 12px;table-layout:fixed;"><tr>${Array.from({length:28},()=>`<td align="center" style="padding:0;font-family:Georgia,serif;font-size:12px;line-height:1;color:#000000;">*</td>`).join('')}</tr></table>`;
}
function displayDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value||'To be confirmed';
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date)?new Intl.DateTimeFormat('en-CA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):value;
}
function displayTime(value) {
  const m=/^(\d{2}):(\d{2})/.exec(value||'');
  if(!m)return value||'To be confirmed';
  const h=Number(m[1]);return `${h%12||12}:${m[2]} ${h>=12?'PM':'AM'}`;
}
function reference(value) {return value?`ED-${String(value).replace(/[^a-z0-9]/gi,'').slice(0,8).toUpperCase()}`:'';}
function details(items) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;font-family:${mono};">${items.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<tr><td width="31%" valign="top" style="width:31%;padding:5px 8px 5px 0;color:${coffee};font-size:11px;line-height:1.6;text-transform:uppercase;">${esc(k)}</td><td valign="top" style="padding:5px 0;font-size:12px;line-height:1.6;color:${espresso};overflow-wrap:anywhere;word-break:break-word;">${lines(v)}</td></tr>`).join('')}</table>`;
}
function block(label,content) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:19px;"><tr><td style="padding-top:15px;"><p style="margin:0 0 9px;font-family:${mono};font-size:11px;line-height:1.5;font-weight:bold;letter-spacing:0.6px;color:${espresso};">${esc(label)}</p>${content}</td></tr></table>`;
}
function trip(b,returning=false) {
  const r=returning?b.returnJourney:b;
  if(!r)return details([['Journey','Return requested; details to be confirmed']]);
  return details([['Date',displayDate(r.date)],['Time',`${displayTime(r.time)} / Alberta time`],['From',r.pickup],['To',r.dropoff]]);
}
function journey(b) {
  const qty=b.passengers??'—';
  let body=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin-top:23px;font-family:${mono};"><tr><td style="padding:8px 0;font-size:10px;letter-spacing:1px;">SERVICE DESCRIPTION</td><td width="90" align="right" style="width:90px;padding:8px 0;font-size:10px;letter-spacing:1px;">PASSENGERS</td></tr><tr><td style="padding:14px 0 8px;font-size:13px;font-weight:bold;line-height:1.6;">${esc(b.serviceType||'Private chauffeur service')}</td><td align="right" valign="top" style="padding:14px 0 8px;font-size:13px;">${esc(qty)}</td></tr></table>`;
  body+=`<p style="margin:4px 0 7px;font-family:${mono};font-size:10px;color:${coffee};letter-spacing:1px;">OUTBOUND TRIP</p>`+trip(b);
  const travel=[['Luggage',typeof b.luggage==='boolean'?(b.luggage?'Yes':'No'):b.luggage!==undefined&&b.luggage!==''?`${b.luggage} bag(s)`:null],['Flight',b.flightNumber],['Vehicle',b.requestedVehicle]];
  if(travel.some(([,v])=>v!==null&&v!==undefined&&v!==''))body+=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:7px;"><tr><td style="padding-top:6px;">${details(travel)}</td></tr></table>`;
  if(b.returnTrip)body+=block('RETURN TRIP',trip(b,true));
  const extras=[];
  if(b.alcoholService)extras.push(['Liquor service',b.serviceRefreshmentPreferences||'Requested; preferences to be confirmed']);
  if(b.nonAlcoholicService)extras.push(['Soft drinks',b.refreshmentPreferences||'Requested; preferences to be confirmed']);
  if(extras.length)body+=block('REQUESTED EXTRAS',details(extras));
  const notes=b.customerNotes??b.notes;
  if(notes?.trim())body+=block('CUSTOMER NOTES',`<p style="margin:0;font-family:${mono};font-size:12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">${lines(notes.trim())}</p>`);
  return body;
}
function frame(b,{heading='Quote request',copy='CUSTOMER COPY',body,team=false}) {
  const ref=reference(b.reference);
  const issued=b.createdAt&&Number.isFinite(+new Date(b.createdAt))?new Intl.DateTimeFormat('en-CA',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Edmonton'}).format(new Date(b.createdAt)):'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quote request received | Executive Driving</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:${espresso};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">Your quote request has been received. We will follow up with availability and pricing.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff;"><tr><td align="center" style="padding:30px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${paper};">

<tr><td style="padding:27px 24px 23px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;"><tr><td valign="middle" style="text-align:left;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;letter-spacing:0;line-height:1.4;">${esc(heading)}</h1><p style="margin:5px 0 0;font-family:${mono};font-size:9px;letter-spacing:0.5px;line-height:1.5;color:${coffee};">${esc(copy)}</p></td><td width="46%" align="right" valign="middle" style="width:46%;text-align:right;"><img src="cid:executive-logo" alt="Executive Driving" width="116" style="display:block;width:116px;max-width:100%;height:auto;border:0;margin-left:auto;"></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px;font-family:${mono};"><tr><td valign="top" style="font-size:10px;line-height:1.8;">${ref?`REF. ${esc(ref)}`:'EXECUTIVE DRIVING'}</td><td align="right" valign="top" style="font-size:10px;line-height:1.8;">${esc(issued)}</td></tr><tr><td colspan="2" style="padding-top:5px;font-size:10px;line-height:1.7;color:${coffee};">STATUS &nbsp; ${team?'REQUIRES FOLLOW-UP':'Awaiting quote'}</td></tr></table>
${body}
${starLine()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:23px;"><tr><td align="center" style="padding-top:19px;"><p style="margin:0 0 9px;font-family:${mono};font-size:10px;font-weight:bold;letter-spacing:1px;line-height:1.6;">${team?'EXECUTIVE DRIVING / OPERATIONS':'THANK YOU FOR YOUR REQUEST'}</p><p style="margin:0;font-family:${mono};font-size:10px;line-height:1.9;color:${coffee};"><a href="tel:+18259739800" style="color:${espresso};text-decoration:none;">825-973-9800</a><br><a href="mailto:info@executivedriving.ca" style="color:${espresso};text-decoration:none;">info@executivedriving.ca</a><br>executivedriving.ca</p></td></tr></table>
</td></tr></table>
<p style="margin:12px 0 0;font-family:${mono};font-size:9px;line-height:1.6;color:#777777;">${team?'INTERNAL COPY · PLEASE HANDLE CUSTOMER DETAILS WITH CARE':'PLEASE RETAIN FOR YOUR RECORDS'}</p>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
export function renderCustomerConfirmationEmail(b) {
  const customer=details([['Requested by',b.name],['Email',b.email],['Phone',b.phone]]);
  const total=starLine()+`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:23px;font-family:${mono};"><tr><td style="padding:14px 0;font-size:15px;font-weight:bold;line-height:1.5;">QUOTE TOTAL</td><td align="right" style="padding:14px 0;font-size:13px;line-height:1.5;">To be provided</td></tr></table><p style="margin:8px 0 0;font-family:${mono};font-size:10px;line-height:1.7;color:${coffee};">No payment is requested. Pricing and requested extras are subject to written confirmation.</p>`;
  const closing=`<p style="margin:20px 0 0;font-family:${mono};font-size:11px;line-height:1.8;">Our team will confirm availability, the vehicle and total price in a written quote. This slip acknowledges your request; your ride is not yet confirmed.</p><p style="margin:10px 0 0;font-family:${mono};font-size:11px;line-height:1.8;">For changes, reply to this email and include your reference.</p>`;
  return frame(b,{body:`<div style="margin-top:16px;">${customer}</div>`+journey(b)+total+closing});
}
export function renderBookingEmail(b) {
  const staffRows = items => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">${items.filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([label,value])=>`<tr><td width="31%" valign="top" style="width:31%;padding:11px 12px 11px 0;border-top:1px solid #eeece4;color:#77796e;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;">${esc(label)}</td><td valign="top" style="padding:11px 0;border-top:1px solid #eeece4;color:#292c25;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">${lines(value)}</td></tr>`).join('')}</table>`;
  const staffSection = (title, content) => `<h2 style="margin:28px 0 15px;color:#292c25;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;font-weight:bold;">${esc(title)}</h2>${content}`;
  const luggage = typeof b.luggage==='boolean' ? (b.luggage?'Yes':'No') : b.luggage!==undefined&&b.luggage!=='' ? `${b.luggage} bag(s)` : null;
  let content = staffSection('Customer',staffRows([['Name',b.name],['Email',b.email],['Phone',b.phone]]));
  content += staffSection('Trip details',staffRows([
    ['Service',b.serviceType],['Pickup',b.pickup],['Destination',b.dropoff],
    ['Pickup date & time',`${displayDate(b.date)} · ${displayTime(b.time)} · Alberta time`],
    ['Passengers',b.passengers],['Luggage',luggage],['Flight',b.flightNumber],['Vehicle preference',b.requestedVehicle],
    ['Return trip',b.returnTrip?'Included in this request':null]
  ]));
  if(b.returnTrip&&b.returnJourney) {
    const r=b.returnJourney;
    content += staffSection('Return trip',staffRows([['Pickup',r.pickup],['Destination',r.dropoff],['Pickup date & time',`${displayDate(r.date)} · ${displayTime(r.time)} · Alberta time`]]));
  }
  const extras=[];
  if(b.alcoholService)extras.push(['Liquor service',b.serviceRefreshmentPreferences||'Requested; preferences to be confirmed']);
  if(b.nonAlcoholicService)extras.push(['Non-alcoholic drinks',b.refreshmentPreferences||'Requested; preferences to be confirmed']);
  if(extras.length)content+=staffSection('Requested extras',staffRows(extras));
  const notes=b.customerNotes??b.notes;
  if(notes?.trim())content+=staffSection('Customer notes',`<p style="margin:0;font-size:13px;line-height:1.8;color:#62665d;overflow-wrap:anywhere;word-break:break-word;">${lines(notes.trim())}</p>`);
  if(b.escalationNote)content+=staffSection('Team follow-up',`<p style="margin:0;font-size:13px;line-height:1.8;color:#62665d;">${lines(b.escalationNote)}</p>`);
  const ref=reference(b.reference);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New ride request | Executive Driving</title></head>
<body style="margin:0;padding:0;background:#f4f2eb;color:#292c25;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">New ride request from ${esc(b.name)}. Review the customer, trip and requested extras.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f2eb;"><tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#fffefa;border:1px solid #deddd4;border-radius:9px;"><tr><td style="padding:28px 25px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;"><tr><td valign="middle"><h1 style="margin:0;font-size:17px;line-height:1.5;font-weight:600;color:#292c25;">New ride request</h1></td><td width="42%" align="right" valign="middle" style="width:42%;"><img src="cid:executive-logo" alt="Executive Driving" width="116" style="display:block;width:116px;max-width:100%;height:auto;border:0;margin-left:auto;"></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:25px;border-bottom:1px solid #e6e3da;"><tr><td style="padding-bottom:21px;color:#73766d;font-size:12px;line-height:1.7;">Request reference</td><td align="right" style="padding-bottom:21px;color:#292c25;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.7;">${esc(ref||'Website request')}</td></tr></table>
<p style="margin:21px 0 0;font-size:13px;line-height:1.8;color:#62665d;">A new ride request has been received${b.name?` from ${esc(b.name)}`:''}.</p>
${content}
<h2 style="margin:28px 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;color:#292c25;">Next step</h2>
<p style="margin:0;font-size:13px;line-height:1.8;color:#62665d;">Review availability and requested extras, then reply to this email to contact the customer with the proposed vehicle and a full written quote. This is a request; the ride is not yet confirmed.</p>
<p style="margin:26px 0 0;padding-top:19px;border-top:1px solid #e6e3da;font-size:11px;line-height:1.8;color:#77796e;">Executive Driving · Team copy<br>Please handle customer details with care.</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
export function renderConciergeEmail(b) {
  return frame(b,{heading:'Service enquiry',copy:'OPERATIONS COPY',team:true,body:block('CUSTOMER',details([['Name',b.name],['Email',b.email],['Phone',b.phone],['Service date',displayDate(b.date)]]))+(b.details?block('CUSTOMER MESSAGE',`<p style="margin:0;font-family:${mono};font-size:12px;line-height:1.8;overflow-wrap:anywhere;">${lines(b.details)}</p>`):'')});
}
