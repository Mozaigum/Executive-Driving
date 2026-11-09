import { postJSON, API_BOOK, API_BASE } from './api.js';




/*  Executive Driving,  script.js*/

/* ---------- tiny utilities ---------- */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Scroll lock via class 
 // Scroll lock (mobile-safe: freezes page at current scroll)
const lockScroll = () => {
  if (document.body.classList.contains('modal-open')) return;
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.dataset.scrollY = String(y);
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.classList.add('modal-open','no-scroll');
};
const unlockScroll = () => {
  const y = parseInt(document.body.dataset.scrollY || '0', 10);
  document.body.classList.remove('modal-open','no-scroll');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  delete document.body.dataset.scrollY;
  window.scrollTo(0, y);
};


  // Safe event add 
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  // Export helpers to window 
  window.__XD__ = { $, $$, on, lockScroll, unlockScroll };
})();

/* Shared form completion and phone checks. */
(() => {
  window.__XD__.completeRequest = details => {
    const receipt = {reference:details.reference,email:details.email,pickup:details.pickup,dropoff:details.dropoff,date:details.date,time:details.time,passengers:details.passengers,returnTrip:details.returnTrip,alcoholService:details.alcoholService,nonAlcoholicService:details.nonAlcoholicService,customerEmailSent:details.customerEmailSent,requestType:details.requestType || 'quote',savedAt:Date.now()};
    try { sessionStorage.setItem('xd-request-receipt', JSON.stringify(receipt)); } catch (_) {}
    window.location.assign('thank-you.html#received');
  };
  document.querySelectorAll('input[name="phone"]').forEach(input => {
    input.setAttribute('inputmode', 'tel');
    const validate = () => {
      const digits = input.value.replace(/\D/g, '');
      input.setCustomValidity(!input.value.trim() || /^(?:1)?\d{10}$/.test(digits) ? '' : 'Enter a 10-digit phone number with area code, for example 8259739800. A leading 1 is also accepted.');
    };
    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.form?.addEventListener('submit', validate, true);
    input.form?.addEventListener('reset', () => setTimeout(validate, 0));
    validate();
  });
})();

/* ---------- Overlay menu ---------- */
(() => {
  const { $, $$, on, lockScroll, unlockScroll } = window.__XD__;

  const overlay = $('#menu-overlay');
  const openBtn = $('.rr-burger-btn') || $('.menu-toggle');
  const closeBtn = overlay?.querySelector('.menu-close');
  if (!overlay || !openBtn || !closeBtn) return;
  // Keep the sheet outside page stacking contexts and cover the original header.
  document.body.append(overlay);

  // A shared, full-width navigation sheet across all five pages.
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Main navigation');
  overlay.inert = true;
  openBtn.setAttribute('aria-label', 'Open menu');
  closeBtn.setAttribute('aria-label', 'Close menu');

  const setMenuState = (open) => {
    if (overlay.classList.contains('open') === open) return;
    overlay.inert = !open;
    overlay.classList.toggle('open', open);
    document.body.classList.toggle('navigation-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    openBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    open ? lockScroll() : unlockScroll();

    if (open) {
      window.setTimeout(() => {
        if (overlay.classList.contains('open')) closeBtn.focus({ preventScroll: true });
      }, 260);
    } else {
      openBtn.focus({ preventScroll: true });
    }
  };

  const openMenu = () => setMenuState(true);
  const closeMenu = () => setMenuState(false);

  on(openBtn, 'click', () => {
    overlay.classList.contains('open') ? closeMenu() : openMenu();
  });

  on(closeBtn, 'click', closeMenu);
  on(overlay, 'click', (e) => { if (e.target === overlay) closeMenu(); });
  on(document, 'keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab') {
      const items = [...overlay.querySelectorAll('a[href], button:not([disabled])')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  on(window, 'resize', () => { if (window.innerWidth > 960) closeMenu(); });

  $$('a', overlay).forEach(a => {
    const opensModal = a.classList.contains('js-open-terms') || a.classList.contains('js-open-privacy');
    on(a, 'click', (e) => {
      if (opensModal) {
        e.preventDefault();
        closeMenu();
      } else {
        closeMenu();
      }
    });
  });
})();

// ============================================
// FIND AND REPLACE THIS SECTION IN YOUR script.js
// It's the booking form submit handler (around line 30-80)
// ============================================

/* ---------- Booking form submit -> email via /book ---------- */
(() => {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const overlay = document.getElementById('booking-overlay');

  const get = (name) => form.elements.namedItem(name);
  let requestKey = null, requestBody = null;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.className = 'booking-submit-status';
  status.tabIndex = -1;
  form.querySelector('.booking-actions')?.append(status);
  const submitBtn = form.querySelector('[type="submit"]');
  const submitLabel = submitBtn?.textContent || 'Request a quote';
  const progress = document.createElement('span');
  progress.className = 'submission-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.hidden = true;
  form.querySelector('.booking-actions')?.append(progress);

  // Carry the visitor's intent from service and fleet links into the request.
  const requestParams = new URLSearchParams(window.location.search);
  const requestedService = requestParams.get('service');
  const requestedVehicle = requestParams.get('vehicle');
  const vehicleNotice = document.getElementById('vehicleAvailabilityNotice');
  const vehicleName = document.getElementById('requestedVehicleName');
  if (requestedVehicle && requestedVehicle.trim() && vehicleNotice && vehicleName) {
    const vehicleLabels = { transit: 'Ford Transit AWD', lincoln: 'Lincoln Navigator L', denali: 'GMC Denali' };
    vehicleName.textContent = vehicleLabels[requestedVehicle.toLowerCase()] || requestedVehicle.trim().slice(0, 100);
    vehicleNotice.hidden = false;
  }
  const serviceSelect = get('serviceType');
  const serviceLabels = {
    airport: 'Airport transfer',
    corporate: 'Corporate travel',
    hourly: 'Hourly / as-directed',
    event: 'Event or occasion',
    group: 'Group transportation'
  };
  if (serviceSelect && serviceLabels[requestedService]) { serviceSelect.value = serviceLabels[requestedService]; serviceSelect.dispatchEvent(new Event('change', { bubbles: true })); }

  
  const setLoading = (on) => {
    if (!submitBtn) return;
    submitBtn.classList.toggle('is-loading', !!on);
    submitBtn.disabled = !!on;
    submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    form.setAttribute('aria-busy', String(Boolean(on)));
    submitBtn.textContent = on ? 'Sending request...' : submitLabel;
    progress.hidden = !on;
    status.textContent = on ? 'Sending your request securely. Please keep this page open.' : status.textContent;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn?.disabled) return;
    status.textContent = '';
    status.classList.remove('is-error');
    if (!form.reportValidity()) return;

    // Get returnTrip checkbox - try multiple ways to ensure we get it
    const returnTripCheckbox = form.querySelector('input[name="returnTrip"]') || 
                                document.getElementById('returnTrip');
    const returnTripValue = returnTripCheckbox ? returnTripCheckbox.checked : false;

    // DEBUG: Log to console to verify


    // Get "Notify me about similar events" checkbox (events page only)
const notifyCheckbox =
  form.querySelector('input[name="notifyMe"]') ||
  document.getElementById('notifyMe');

const notifyMeValue = notifyCheckbox ? notifyCheckbox.checked : false;


const AlcoholCheckbox = form.querySelector('input[name="alcoholService"]');
const alcoholValue = AlcoholCheckbox ? AlcoholCheckbox.checked : false;
const serviceType = get('serviceType')?.value.trim();
const luggage = get('luggage')?.value.trim();
const flightNumber = get('flightNumber')?.value.trim();

const journeyDetails = [
  serviceType ? `Service: ${serviceType}` : '',
  luggage ? `Luggage: ${luggage} bag(s)` : '',
  flightNumber ? `Flight: ${flightNumber}` : ''
].filter(Boolean).join('\n');

const returnDetails = returnTripValue && get('returnPickup') ? {
  pickup: get('returnPickup').value.trim(),
  dropoff: get('returnDropoff').value.trim(),
  date: get('returnDate').value,
  time: get('returnTime').value
} : null;
const returnSummary = returnDetails ? [
  'RETURN JOURNEY',
  'Pickup: ' + returnDetails.pickup,
  'Destination: ' + returnDetails.dropoff,
  'Date: ' + returnDetails.date,
  'Pickup time: ' + returnDetails.time,
  'Same passengers and luggage as the outbound journey.'
].join('\n') : 'Customer requested a return journey; confirm the details.';

const payload = {
  serviceType: serviceSelect ? serviceType : 'General journey',
  customerNotes: get('notes')?.value.trim() || '',
  requestedVehicle: requestedVehicle?.trim() || '',
  luggage: luggage || '',
  flightNumber: flightNumber || '',
  name: get('name')?.value.trim(),
  phone: get('phone')?.value.trim(),
  email: get('email')?.value.trim(),
  pickup: get('pickup')?.value.trim(),
  dropoff: get('dropoff')?.value.trim(),
  date: get('date')?.value,
  time: get('time')?.value,
  passengers: get('passengers')?.value,

  alcoholService: alcoholValue,   // ✅ FIXED NAME

  notes: (journeyDetails ? `${journeyDetails}\n\n` : '')
    + (get('notes')?.value || '') 
    + (returnTripValue ? '\n\n' + returnSummary : '')
    + (alcoholValue ? '\n\n Customer requested LIQUOR SERVICE.' : ''), // ✅ FIXED

  returnTrip: returnTripValue,
  notifyMe: notifyMeValue   
};
if (returnDetails) payload.returnJourney = returnDetails;
const refreshmentDetails = get('nonAlcoholicService')?.checked ? get('refreshmentPreferences')?.value.trim() : '';
if (refreshmentDetails) {
  payload.nonAlcoholicService = true;
  payload.refreshmentPreferences = refreshmentDetails;
  payload.notes += '\n\nNON-ALCOHOLIC REFRESHMENTS\n' + refreshmentDetails;
}
const enquiryRefreshments = get('alcoholService')?.checked ? get('serviceRefreshmentPreferences')?.value.trim() : '';
if (enquiryRefreshments) {
  payload.serviceRefreshmentPreferences = enquiryRefreshments;
  payload.notes += '\n\nLIQUOR SERVICE REQUEST\n' + enquiryRefreshments;
}

    // DEBUG: Log full payload


    const required = ['name', 'phone', 'email', 'pickup', 'dropoff', 'date', 'time', 'passengers'];
    if (required.some(name => !String(payload[name] ?? '').trim())) {
      status.textContent = 'Please complete the required journey and contact details.';
      return;
    }
    const serialized = JSON.stringify(payload);
    if (serialized !== requestBody) {
      requestKey = window.crypto?.randomUUID?.() || `request_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      requestBody = serialized;
    }
    setLoading(true);
    
    try {
      const data = await postJSON(API_BOOK, payload, { 'Idempotency-Key': requestKey });
      // 🔔 Notify-me subscription
if (payload.notifyMe === true) {
  try {
    await postJSON(`${API_BASE}/api/notify/subscribe`, {
      email: payload.email,
      categories: ["concert", "sports", "nightlife"],
      city: 'all'
    });

  } catch (err) {
    console.warn("Notify subscription failed:", err.message);
  }
}


      if (data.ok) {
        requestKey = null; requestBody = null;
        form.reset();
        window.__XD__.completeRequest({...payload,reference:data.reference,customerEmailSent:data.customerEmailSent});
      } else {
        throw new Error('Unable to send your request. Please call 825-973-9800 or try again.');
      }
    } catch (e) {
      status.textContent = e.message || 'Network error. Please try again or call 825-973-9800.';
      status.classList.add('is-error');
      status.focus({preventScroll:true});
      status.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
    finally {
      setLoading(false);
    }
  });
})();

/* ---------- Header compact state ---------- */
(() => {
  const { $, on } = window.__XD__;
  const header = $('#site-header');
  if (!header) return;

  const setState = () => {
    const y = window.scrollY || window.pageYOffset || 0;
    header.classList.toggle('is-scrolled', y > 10);
    header.classList.toggle('at-top', y <= 10);
  };

  on(window, 'scroll', setState, { passive: true });
  on(window, 'load', setState);
  setState();
})();
/* ---------- Reveal-on-scroll (universal smooth version) ---------- */
(() => {
  const { $$ } = window.__XD__;
  const els = $$('[data-reveal]');
  if (!els.length || !('IntersectionObserver' in window)) return;

  // ⚙️ Add GPU hint for smoother animation on mobile
  els.forEach(el => el.style.willChange = 'opacity, transform');

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      const el = entry.target;

      // If element is visible, show it once and stop observing
      if (entry.isIntersecting) {
        el.classList.add('is-visible');
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        obs.unobserve(el);
      }
    });
  }, {
    root: null,
    threshold: 0.15,
    rootMargin: '0px 0px -10% 0px'
  });

  els.forEach(el => {
    // Initial hidden state
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    io.observe(el);
  });
})();


/* Hero dimensions follow CSS viewport units without resize-driven jumps. */

/* ---------- Terms / Privacy modals (FIXED) ----------
   OLD version was incorrectly re-opening #menu-overlay on both open AND close.
   This version:
     - Closes the mobile menu if it happens to be open
     - Opens only the correct modal overlay (terms or privacy)
     - Desktop: works from the Policy dropdown in the nav
     - Mobile: works from the slide-out menu
     - Neither path touches the other overlay
-------------------------------------------------------- */
(() => {
  const { $, $$, on, lockScroll, unlockScroll } = window.__XD__;

  const wire = (openSel, overlayId) => {
    const modalOverlay = document.getElementById(overlayId);
    const openers = $$(openSel);
    if (!modalOverlay || !openers.length) return;

    const closeBtn = modalOverlay.querySelector('.modal-close');

    const openModal = (e) => {
      e?.preventDefault();

      // Close the mobile menu if it's currently open (mobile flow)
      const menu = $('#menu-overlay');
      if (menu && menu.classList.contains('open')) {
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        document.querySelector('.rr-burger-btn')?.setAttribute('aria-expanded', 'false');
      }

      // Open the correct modal
      modalOverlay.classList.add('open');
      modalOverlay.setAttribute('aria-hidden', 'false');
      lockScroll();

      const focusable = modalOverlay.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
      focusable?.focus({ preventScroll: true });
    };

    const closeModal = () => {
      modalOverlay.classList.remove('open');
      modalOverlay.setAttribute('aria-hidden', 'true');
      unlockScroll();
    };

    openers.forEach(btn => on(btn, 'click', openModal));
    on(closeBtn, 'click', closeModal);
    on(modalOverlay, 'click', (e) => { if (e.target === modalOverlay) closeModal(); });
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
    });
  };

  wire('.js-open-terms',   'terms-overlay');
  wire('.js-open-privacy', 'privacy-overlay');
})();

/* ---------- Scrollbar flash ---------- */
(() => {
  const { $$, on } = window.__XD__;

  const rafFlash = (el, cls = 'show-scrollbar', hideDelay = 700) => {
    const isRoot = (el === document.documentElement) || (el === document.body);
    if (isRoot) {
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
    } else {
      el.classList.add(cls);
    }

    cancelAnimationFrame(el._sbRaf);
    clearTimeout(el._sbT);

    const getY = (target) =>
      (target === document.documentElement || target === document.body) ? window.scrollY : target.scrollTop;

    let lastY = getY(el);
    const tick = () => {
      const nowY = getY(el);
      if (nowY !== lastY) {
        lastY = nowY;
        el._sbRaf = requestAnimationFrame(tick);
      } else {
        el._sbT = setTimeout(() => {
          if (isRoot) {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
          } else {
            el.classList.remove(cls);
          }
        }, hideDelay);
      }
    };
    el._sbRaf = requestAnimationFrame(tick);
  };

  ['scroll', 'wheel', 'touchmove', 'keydown'].forEach(evt =>
    on(window, evt, () => rafFlash(document.documentElement), { passive: true })
  );

  const wireModal = (mc) => {
    if (!mc || mc._wired) return;
    mc._wired = true;
    ['scroll', 'wheel', 'touchmove'].forEach(evt =>
      mc.addEventListener(evt, () => rafFlash(mc), { passive: true })
    );
  };

  $$('.modal-content').forEach(wireModal);
  new MutationObserver(() => {
    $$('.modal-content').forEach(wireModal);
  }).observe(document.body, { childList: true, subtree: true });
})();

/* ---------- Ready fade ---------- */
(() => {
  window.addEventListener('load', () => {
    requestAnimationFrame(() => document.body.classList.add('ready'));
  });
})();


/* ---------- Booking links ---------- */
(() => {
  const { $$, on } = window.__XD__;
  $$('[data-book-open]').forEach((link) => {
    if (!link.getAttribute('href') || link.getAttribute('href') === '#') {
      link.setAttribute('href', 'booking.html');
    }
    on(link, 'click', () => {
      const menu = document.getElementById('menu-overlay');
      if (menu?.classList.contains('open')) {
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        document.querySelector('.rr-burger-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();

// Partners: update the shared infobar with company name + short description
(() => {
  const section = document.querySelector('.partners-marquee');
  if (!section) return;

  const infoBar = section.querySelector('.partner-infobar');
  const titleEl = infoBar ? infoBar.querySelector('strong') : null;
  const descEl = infoBar ? infoBar.querySelector('span') : null;
  const partners = [...section.querySelectorAll('.partner')];

  // Safe defaults
  const DEFAULT_TITLE = 'Trusted Partners,';
  const DEFAULT_DESC = ' Hover Over a logo to learn more.';

  const setInfo = (el) => {
    if (!infoBar || !titleEl || !descEl) return;
    const name = el.dataset.name || DEFAULT_TITLE;
    const desc = el.dataset.desc ? `,  ${el.dataset.desc}` : '';
    titleEl.textContent = name;
    descEl.textContent = desc;
    infoBar.classList.add('is-active');
  };

  const resetInfo = () => {
    if (!infoBar || !titleEl || !descEl) return;
    titleEl.textContent = DEFAULT_TITLE;
    descEl.textContent = DEFAULT_DESC;
    infoBar.classList.remove('is-active');
  };

  partners.forEach((p) => {
    // Mouse
    p.addEventListener('mouseenter', () => setInfo(p));
    p.addEventListener('mouseleave', resetInfo);
    // Keyboard focus
    p.addEventListener('focus', () => setInfo(p));
    p.addEventListener('blur', resetInfo);
    // Touch: tap to show then auto-reset
    p.addEventListener('click', () => {
      setInfo(p);
      window.clearTimeout(p.__rrTimeout);
      p.__rrTimeout = window.setTimeout(resetInfo, 2200);
    });
  });

  // Initialize text once (optional)
  resetInfo();
})();
document.getElementById('year')?.append(new Date().getFullYear());
/* ==== Universal email compose (site-wide) ==== */
(function () {
  const DEFAULT_TO = 'info@executivedriving.ca';
  const SUBJECT = 'Executive Driving,  Booking / Inquiry';
  const BODY = `Hi Executive Driving team,

  I’d like to reserve a ride. Details:
  • Pickup:
  • Drop off:
  • Date & time:
  • Passengers:

  Thanks!`;

  const enc = s => encodeURIComponent(s);
  const buildMailto = (to = DEFAULT_TO) =>
    `mailto:${to}?subject=${enc(SUBJECT)}&body=${enc(BODY)}`;

  /* 1) Upgrade all existing mailto links (and a[data-email]) */
  document.querySelectorAll('a[href^="mailto:"], a[data-email]').forEach(a => {
    const explicit = a.getAttribute('data-email');
    const raw = (a.getAttribute('href') || '').replace(/^mailto:/, '').split('?')[0];
    const to = explicit || raw || DEFAULT_TO;
    a.setAttribute('href', buildMailto(to));
  });

  /* 2) Auto-link any plain-text occurrences of the email */
  const EMAIL = DEFAULT_TO.toLowerCase();
  const emailRegex = new RegExp(EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const t = p.tagName;
      if (t === 'A' || t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
      return emailRegex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const toReplace = [];
  while (walker.nextNode()) toReplace.push(walker.currentNode);

  toReplace.forEach(textNode => {
    const frag = document.createDocumentFragment();
    const parts = textNode.nodeValue.split(emailRegex);
    const matches = textNode.nodeValue.match(emailRegex);
    parts.forEach((part, i) => {
      if (part) frag.appendChild(document.createTextNode(part));
      if (matches && matches[i]) {
        const a = document.createElement('a');
        a.href = buildMailto(matches[i]);
        a.textContent = matches[i];
        a.className = 'email-link';
        frag.appendChild(a);
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  });
})();
// Google Places and date/time controls are shared in places-fields.js and field-pickers.js.

/* ---------- Fleet section: reveal title, subline, and cards (slower) ---------- */
(() => {
  const root = document.querySelector('#fleet');
  if (!root) return;

  const css = getComputedStyle(root);
  const dur = (css.getPropertyValue('--reveal-dur') || '1.1s').trim();
  const stag = (css.getPropertyValue('--reveal-stagger') || '.14s').trim();

  const toSecs = v => /ms/i.test(v) ? parseFloat(v) / 1000 : parseFloat(v);
  const STAG = toSecs(stag);
  const BASE = 0.10;

  // Targets in the order we want them to pop
  const header = root.querySelector('.fleet-h');
  const sub = root.querySelector('.fleet-sub');
  const cards = [...root.querySelectorAll('.fleet-card')];

  const obs = new IntersectionObserver((entries, ob) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        ob.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });

  const prep = (el, delay, extra = 0) => {
    if (!el) return;
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    el.style.setProperty('--dur', `calc(${dur} + ${extra}s)`);
    el.style.setProperty('--delay', `${delay.toFixed(3)}s`);
    obs.observe(el);
  };

  // Title then subline
  prep(header, BASE + 0 * STAG, 0.00);
  prep(sub, BASE + 1 * STAG, 0.05);

  // Cards + their inner bits (img, h3, p)
  cards.forEach((card, i) => {
    const cardDelay = BASE + (2 + i) * STAG;     // starts after header+sub
    prep(card, cardDelay, 0.00);

    const inner = card.querySelectorAll('img, h3, p');
    inner.forEach((el, k) => {
      prep(el, cardDelay + (k + 1) * 0.10, 0.08); // slight cascade inside card
    });
  });
})();
/* ---------- Our Story + Team section reveals (slower) ---------- */
(() => {
  const roots = document.querySelectorAll('#our-story, #team');
  if (!roots.length || !('IntersectionObserver' in window)) return;

  // Custom timings (slower than fleet)
  const DURATION = '1.6s';
  const STAGGER = 0.20;

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  roots.forEach(root => {
    const els = root.querySelectorAll('[data-reveal]');
    els.forEach((el, i) => {
      el.style.setProperty('--dur', DURATION);
      el.style.setProperty('--delay', `${(i * STAGGER).toFixed(2)}s`);
      io.observe(el);
    });
  });
})();
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('client-form');
  if (form) {
    const button = form.querySelector('[type="submit"]');
    const buttonLabel = button.textContent;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.className = 'booking-submit-status';
    status.tabIndex = -1;
    form.append(status);
    let lastBody = '', requestKey = '';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;
      const value = name => form.elements.namedItem(name).value.trim();
      const body = {type:'concierge',name:value('name'),phone:value('phone'),email:value('email'),date:value('date'),details:value('details')};
      const serialized = JSON.stringify(body);
      if (serialized !== lastBody) {lastBody = serialized;requestKey = window.crypto?.randomUUID?.() || `care_${Date.now()}_${Math.random().toString(36).slice(2)}`;}
      button.disabled = true;
      button.setAttribute('aria-busy','true');
      button.classList.add('is-loading');
      button.textContent = 'Sending request...';
      status.classList.remove('is-error');
      status.textContent = 'Sending your request. Please keep this page open.';
      try {
        const data = await postJSON(API_BOOK, body, {'Idempotency-Key':requestKey});
        if (!data?.ok) throw new Error('Unable to send your request. Please call 825-973-9800.');
        window.__XD__.completeRequest({...body,reference:data.reference,customerEmailSent:false,requestType:'enquiry'});
        form.reset();lastBody = '';requestKey = '';
      } catch (error) {status.textContent = error.message || 'Unable to send your request. Please call 825-973-9800.';status.classList.add('is-error');status.focus({preventScroll:true});status.scrollIntoView({block:'nearest',behavior:'smooth'});}
      finally {button.disabled = false;button.setAttribute('aria-busy','false');button.classList.remove('is-loading');button.textContent = buttonLabel;}
    });
  }
  // ---- Booking Received modal helpers ----
(() => {
  const { $, on, lockScroll, unlockScroll } = window.__XD__ || {
    $: (s, r=document) => r.querySelector(s),
    on: (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts),
    lockScroll: () => document.body.classList.add('no-scroll'),
    unlockScroll: () => document.body.classList.remove('no-scroll'),
  };

  const overlay = document.getElementById('thanks-overlay');
  if (!overlay) return;

  const panel   = overlay.querySelector('.modal-panel, .ty-panel');
  const closeBtn= overlay.querySelector('.modal-close');
  const emailEl = overlay.querySelector('#t-email');
  const sumEl   = overlay.querySelector('#t-summary');
  const icsBtn  = overlay.querySelector('#t-ics');
  const emailBtn= overlay.querySelector('#t-email-link');

  const fmtDate = (d) => d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) : ', ';
  const fmtTime = (t) => {
    if (!t) return ', ';
    const [h,m] = t.split(':').map(Number); const d=new Date(); d.setHours(h||0,m||0,0,0);
    return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  };

  function buildICS(p) {
    try {
      const start = new Date(`${p.date}T${p.time||'09:00'}:00Z`);
      const end   = new Date(start.getTime() + 60*60*1000);
      const pad=(n)=>String(n).padStart(2,'0');
      const dt=(d)=> d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z';
      const icsText = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
      const details = [
        `Name: ${p.name||''}`, `Phone: ${p.phone||''}`, `Email: ${p.email||''}`,
        `Pickup: ${p.pickup||''}`, `Drop-off: ${p.dropoff||''}`,
        `Passengers: ${p.passengers||''}`, p.notes?`Notes: ${p.notes}`:''
      ].filter(Boolean).join('\n');
      const ics = [
        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Executive Driving//Booking//EN',
        'BEGIN:VEVENT',`UID:${Date.now()}@executivedriving.ca`,
        `DTSTAMP:${dt(new Date())}`,`DTSTART;TZID=America/Edmonton:${p.date.replace(/-/g,'')}T${(p.time||'09:00').replace(':','')}00`,`DTEND;TZID=America/Edmonton:${end.getUTCFullYear()}${pad(end.getUTCMonth()+1)}${pad(end.getUTCDate())}T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}00`,
        'SUMMARY:Executive Driving Chauffeur Request',
        `LOCATION:${icsText(p.pickup)}`,`DESCRIPTION:${icsText(details)}`,
        'END:VEVENT','END:VCALENDAR'
      ].join('\r\n');
      return new Blob([ics], { type:'text/calendar' });
    } catch { return null; }
  }

  function mailtoHref(p) {
    const to = p.email || 'info@executivedriving.ca';
    const subject = 'Your Executive Driving Booking';
    const body = [
      'Thank you for your booking. Here are the details:',
      `• Name: ${p.name||''}`, `• Phone: ${p.phone||''}`, `• Email: ${p.email||''}`,
      `• Pickup: ${p.pickup||''}`, `• Drop-off: ${p.dropoff||''}`,
      `• Date: ${fmtDate(p.date)} at ${fmtTime(p.time)}`,
      `• Passengers: ${p.passengers||''}`, p.notes?`• Notes: ${p.notes}`:''
    ].filter(Boolean).join('\n');
    const enc = encodeURIComponent;
    return `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;
  }

  function openThanks(payload={}) {
    if (emailEl) emailEl.textContent = payload.email || 'your email';
    if (sumEl) {
      sumEl.innerHTML = '';
      [
        ...(payload.reference ? [['Reference', payload.reference]] : []), ['Name', payload.name], ['Phone', payload.phone],
        ['Pickup', payload.pickup], ['Drop-off', payload.dropoff],
        ['Date', fmtDate(payload.date)], ['Time', fmtTime(payload.time)],
        ['Passengers', payload.passengers], ...(payload.notes?[['Notes', payload.notes]]:[])
      ].forEach(([k,v]) => {
        const li=document.createElement('li'); li.style.margin='2px 0';
        const label = document.createElement('strong'); label.textContent = `${k}: `;
        li.append(label, document.createTextNode(String(v || '?'))); sumEl.appendChild(li);
      });
    }
    if (icsBtn) { const blob=buildICS(payload); if (blob) icsBtn.href=URL.createObjectURL(blob); }
    if (emailBtn) emailBtn.href = mailtoHref(payload);

    overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); lockScroll();
    panel.querySelector('a,button,[tabindex]:not([tabindex="-1"])')?.focus({preventScroll:true});
  }

  function closeThanks() {
    overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); unlockScroll();
  }

  on(closeBtn,'click',closeThanks);
  on(overlay,'click',(e)=>{ if(e.target===overlay) closeThanks(); });
  on(document,'keydown',(e)=>{ if(e.key==='Escape' && overlay.classList.contains('open')) closeThanks(); });

  window.__XD__ = Object.assign(window.__XD__||{}, { openThanks });
})();

});
