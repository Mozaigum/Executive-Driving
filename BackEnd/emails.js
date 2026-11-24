const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=value=>esc(value).replace(/\r?\n/g,'<br>');
const espresso='#231f20',coffee='#666868',gold='#be1e2d',paper='#ffffff';
const mono="'Courier New',Courier,monospace";
// Request the light design; email apps that force recolouring may ignore this.
const lightModeHead=`<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<style>
:root { color-scheme:light only; supported-color-schemes:light; }
@media (prefers-color-scheme:dark) {
  .email-page, .email-paper { background-color:#ffffff !important; }
  .email-ink { color:#231f20 !important; }
  .email-dark { background-color:#0a0b0d !important; }
}
[data-ogsb] .email-paper { background-color:#ffffff !important; }
[data-ogsc] .email-ink { color:#231f20 !important; }
[data-ogsb] .email-dark { background-color:#0a0b0d !important; }
</style>`;
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${lightModeHead}<title>Quote request received | Executive Driving</title></head>
<body class="email-page email-ink" bgcolor="#ffffff" style="margin:0;padding:0;background:#ffffff;color:${espresso};font-family:Arial,Helvetica,sans-serif;color-scheme:light only;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">${team?`New request from ${esc(b.name)}. Review the customer, trip and requested extras.`:'Your quote request has been received. We will follow up with availability and pricing.'}</div>
<table role="presentation" class="email-paper" bgcolor="#ffffff" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);"><tr><td align="center" style="padding:30px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" class="email-paper" bgcolor="#ffffff" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${paper};">

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
function quoteTotal() {
  return starLine()+`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:23px;font-family:${mono};"><tr><td style="padding:14px 0;font-size:15px;font-weight:bold;line-height:1.5;">QUOTE TOTAL</td><td align="right" style="padding:14px 0;font-size:13px;line-height:1.5;">To be provided</td></tr></table><p style="margin:8px 0 0;font-family:${mono};font-size:10px;line-height:1.7;color:${coffee};">No payment is requested. Pricing and requested extras are subject to written confirmation.</p>`;
}
export function renderCustomerConfirmationEmail(b) {
  const customer=details([['Requested by',b.name],['Email',b.email],['Phone',b.phone]]);
  const total=quoteTotal();
  const closing=`<p style="margin:20px 0 0;font-family:${mono};font-size:11px;line-height:1.8;">Our team will confirm availability, the vehicle and total price in a written quote. This slip acknowledges your request; your ride is not yet confirmed.</p><p style="margin:10px 0 0;font-family:${mono};font-size:11px;line-height:1.8;">For changes, reply to this email and include your reference.</p>`;
  return frame(b,{body:`<div style="margin-top:16px;">${customer}</div>`+journey(b)+total+closing});
}
function ownerFrame(b,heading,content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(heading)} | Executive Driving</title>
<style>
:root { color-scheme:light dark; supported-color-schemes:light dark; }
.owner-page { margin:0; padding:20px 12px; background:#f3f4f5; color:#171717; font-family:Inter,Arial,Helvetica,sans-serif; -webkit-text-size-adjust:100%; }
.owner-card { width:100%; max-width:640px; margin:0 auto; border:1px solid #dedede; border-radius:10px; overflow:hidden; background:#fff; }
.owner-header { background:#0a0b0d; padding:22px; text-align:center; }
.owner-body { padding:24px; font-size:16px; line-height:1.65; color:#171717; }
.owner-body table { font:inherit; color:inherit; }
.owner-body h1 { margin:0 0 22px; font-size:24px; line-height:1.35; }
.owner-body a { color:#1769aa !important; }
.owner-divider { border:0; border-top:1px solid #dedede; margin:24px 0; }
.owner-muted { color:#606060; font-size:13px; }
.owner-footer { background:#0a0b0d; padding:16px; color:#d0d0d0; text-align:center; font-size:12px; }
@media (prefers-color-scheme:dark) {
 .owner-page { background:#111111 !important; color:#f1f1f1 !important; }
 .owner-card,.owner-body { background:#171717 !important; color:#f1f1f1 !important; }
 .owner-card { border-color:#444 !important; }
 .owner-body a { color:#83bfff !important; }
 .owner-muted { color:#c3c3c3 !important; }
 .owner-divider { border-color:#444 !important; }
}
[data-ogsc] .owner-body,[data-ogsc] .owner-card { background:#171717 !important; color:#f1f1f1 !important; }
[data-ogsc] .owner-body a { color:#83bfff !important; }
[data-ogsc] .owner-muted { color:#c3c3c3 !important; }
@media (max-width:420px) { .owner-page { padding:12px 6px; } .owner-body { padding:22px 16px; } }
</style></head><body class="owner-page"><div class="owner-card"><div class="owner-header"><img src="cid:executive-logo" alt="Executive Driving" width="154" style="width:154px;max-width:100%;height:auto;display:block;margin:0 auto;border:0;"></div><div class="owner-body"><h1>${esc(heading)}</h1>${content}<hr class="owner-divider"><p class="owner-muted">Reference: ${esc(reference(b.reference)||'Website request')}</p><p class="owner-muted">Reply to this email to contact the customer.</p><p class="owner-muted">Executive Driving<br><a href="tel:+18259739800">825-973-9800</a></p></div><div class="owner-footer">&copy; ${new Date().getFullYear()} Executive Driving. All rights reserved. &middot; Team copy</div></div></body></html>`;
}
export function renderBookingEmail(b) {
  const row=(label,value,{background='',color='#111',bold=false}={})=>value===undefined||value===null||value===''?'':`<tr><td width="31%" valign="top" style="width:31%;padding:9px 12px 9px 0;"><b>${esc(label)}:</b></td><td valign="top" style="padding:9px 0;${bold?'font-weight:700;':''}overflow-wrap:anywhere;word-break:break-word;">${lines(value)}</td></tr>`;
  const phone=b.phone?`<a href="tel:${esc(String(b.phone).replace(/[^\d+]/g,''))}" style="color:#1769aa;text-decoration:underline;">${esc(b.phone)}</a>`:'';
  const email=b.email?`<a href="mailto:${esc(encodeURIComponent(b.email))}" style="color:#1769aa;text-decoration:underline;">${esc(b.email)}</a>`:'';
  const contactRow=(label,value)=>`<tr><td width="31%" valign="top" style="width:31%;padding:9px 12px 9px 0;"><b>${label}:</b></td><td valign="top" style="padding:9px 0;overflow-wrap:anywhere;word-break:break-word;">${value}</td></tr>`;
  const luggage=typeof b.luggage==='boolean'?(b.luggage?'Yes':'No'):b.luggage!==undefined&&b.luggage!==''?`${b.luggage} bag(s)`:null;
  let rows=row('Name',b.name)+contactRow('Phone',phone)+contactRow('Email',email)+row('Service',b.serviceType)+row('Pickup',b.pickup)+row('Drop-off',b.dropoff)+row('Date',displayDate(b.date))+row('Time',`${displayTime(b.time)} / Alberta time`)+row('Passengers',b.passengers)+row('Luggage',luggage)+row('Flight',b.flightNumber)+row('Vehicle preference',b.requestedVehicle);
  if(b.returnTrip) {
    rows+=row('Return trip','Requested',{background:'#fff9e6',color:'#765f1c',bold:true});
    if(b.returnJourney) {
      const r=b.returnJourney,style={background:'#fffdf5'};
      rows+=row('Return pickup',r.pickup,style)+row('Return drop-off',r.dropoff,style)+row('Return date',displayDate(r.date),style)+row('Return time',`${displayTime(r.time)} / Alberta time`,style);
    } else rows+=row('Return details','To be confirmed',{background:'#fffdf5'});
  }
  if(b.alcoholService)rows+=row('Liquor service','Requested',{background:'#f0f9ff',color:'#1a6b3a',bold:true})+row('Liquor preferences',b.serviceRefreshmentPreferences||'To be confirmed',{background:'#f0f9ff'});
  if(b.nonAlcoholicService)rows+=row('Non-alcoholic drinks','Requested',{background:'#f0f9ff',color:'#1a6b3a',bold:true})+row('Drink preferences',b.refreshmentPreferences||'To be confirmed',{background:'#f0f9ff'});
  const notes=b.customerNotes??b.notes;
  const noteHtml=notes?.trim()?`<hr class="owner-divider"><p style="margin:0 0 10px;"><b>Notes:</b></p><p style="margin:0;overflow-wrap:anywhere;word-break:break-word;">${lines(notes.trim())}</p>`:'';
  const followUp=b.escalationNote?`<p style="margin:16px 0 0;overflow-wrap:anywhere;word-break:break-word;"><b>Team follow-up:</b> ${lines(b.escalationNote)}</p>`:'';
  return ownerFrame(b,'New quote request',`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">${rows}</table>${noteHtml}${followUp}<p class="owner-muted" style="margin-top:22px;">The ride is not yet confirmed. Reply with availability and a full quote.</p>`);
}
export function renderConciergeEmail(b) {
  const row=(label,value)=>`<tr><td width="31%" valign="top" style="width:31%;padding:9px 12px 9px 0;"><b>${esc(label)}:</b></td><td valign="top" style="padding:9px 0;overflow-wrap:anywhere;word-break:break-word;">${value}</td></tr>`;
  const rows=row('Name',esc(b.name))+row('Phone',`<a href="tel:${esc(String(b.phone||'').replace(/[^\d+]/g,''))}">${esc(b.phone)}</a>`)+row('Email',`<a href="mailto:${esc(encodeURIComponent(b.email||''))}">${esc(b.email)}</a>`)+row('Service date',esc(displayDate(b.date)));
  return ownerFrame(b,'Client Care Request',`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">${rows}</table>${b.details?`<hr class="owner-divider"><p style="margin:0 0 10px;"><b>Message:</b></p><p style="margin:0;overflow-wrap:anywhere;word-break:break-word;">${lines(b.details)}</p>`:''}`);
}
