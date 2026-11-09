(() => {
  const title = document.getElementById('receiptTitle');
  if (!title) return;
  let receipt = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem('xd-request-receipt') || 'null');
    if (saved && Date.now() - saved.savedAt < 2 * 60 * 60 * 1000) receipt = saved;
    else sessionStorage.removeItem('xd-request-receipt');
  } catch { /* A successful submission still has a confirmation without stored details. */ }
  const received = Boolean(receipt) || location.hash === '#received';
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  if (!received) {
    title.textContent = 'Let’s plan your journey.';
    set('receiptMessage', 'Submit a quote request to receive your reference and next steps here.');
    document.getElementById('receivedContent').hidden = true;
    return;
  }
  const enquiry = receipt?.requestType === 'enquiry';
  title.textContent = 'Thank you. Request received.';
  set('receiptMessage', enquiry ? 'Your enquiry has reached our team. We’ll review your plans and get back to you.' : 'Your quote request has reached our team. We’ll review your journey and follow up with availability, a vehicle and the complete price.');
  if (receipt?.reference) {
    set('receiptReference', 'ED-' + receipt.reference.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase());
    document.getElementById('receiptReferenceRow').hidden = false;
  }
  if (receipt?.email) {
    set('receiptEmail', receipt.customerEmailSent ? `A request receipt has been sent to ${receipt.email}.` : `Our team will follow up at ${receipt.email}.`);
  }
  const summary = document.getElementById('receiptDetails');
  const add = (label, value) => {
    if (!value) return;
    const row = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = String(value);
    row.append(term, detail); summary.append(row);
  };
  if (receipt && !enquiry) {
    add('Pickup', receipt.pickup); add('Destination', receipt.dropoff);
    const date = receipt.date ? new Date(`${receipt.date}T12:00:00`).toLocaleDateString('en-CA', {month:'long',day:'numeric',year:'numeric'}) : '';
    add('Pickup date & time', [date, receipt.time, 'Alberta time'].filter(Boolean).join(' · '));
    add('Passengers', receipt.passengers);
    if (receipt.returnTrip) add('Return trip', 'Included in your request');
    const extras = [receipt.alcoholService && 'Liquor service', receipt.nonAlcoholicService && 'Non-alcoholic refreshments'].filter(Boolean);
    if (extras.length) add('Requested extras', extras.join(' · '));
    document.getElementById('receiptSummary').hidden = false;
  }
  set('receiptNextStep', enquiry ? 'We’ll respond to your enquiry using the contact details you provided.' : 'Your ride is confirmed after you receive and approve the final availability, vehicle and rate in writing. No payment is requested at this stage.');
})();
