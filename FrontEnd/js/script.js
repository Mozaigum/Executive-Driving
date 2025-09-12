import { postJSON, API_CHAT, API_BOOK } from './api.js';


console.log('script.js loaded v8');

console.log('script.js loaded v7');

/* ===============================
   Executive Driving — script.js
   (cleaned & organized, no auto-greet on load)
   =============================== */

/* ---------- tiny utilities ---------- */
(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Scroll lock via class (avoids style flicker)
  const lockScroll   = () => document.body.classList.add('no-scroll');
  const unlockScroll = () => document.body.classList.remove('no-scroll');

  // Safe event add (no-op if target missing)
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  // Export helpers to window (scoped but available to modules below)
  window.__XD__ = { $, $$, on, lockScroll, unlockScroll };
})();

/* ---------- Overlay menu ---------- */
(() => {
  const { $, $$, on, lockScroll, unlockScroll } = window.__XD__;

  const overlay = $('#menu-overlay');
  const openBtn = $('.rr-burger-btn') || $('.menu-toggle');
  const closeBtn = overlay?.querySelector('.menu-close');
  if (!overlay || !openBtn || !closeBtn) return;

  const setMenuState = (open) => {
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    open ? lockScroll() : unlockScroll();

    if (open) {
      const firstLink = overlay.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
      firstLink?.focus({ preventScroll: true });
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
  on(document, 'keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  $$('.overlay-link', overlay).forEach(a => {
    const opensModal = a.classList.contains('js-open-terms') || a.classList.contains('js-open-privacy');
    on(a, 'click', (e) => {
      if (opensModal) {
        e.preventDefault();
      } else {
        closeMenu();
      }
    });
  });
})();

/* ---------- Booking form submit -> email via /book ---------- */
(() => {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const overlay = document.getElementById('booking-overlay');

  const get = (name) => form.querySelector(`[name="${name}"]`);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: get('name')?.value.trim(),
      phone: get('phone')?.value.trim(),
      email: get('email')?.value.trim(),
      pickup: get('pickup')?.value.trim(),
      dropoff: get('dropoff')?.value.trim(),
      date: get('date')?.value,
      time: get('time')?.value,
      passengers: get('passengers')?.value,
      notes: get('notes')?.value || ''
    };

    for (const [k, v] of Object.entries(payload)) {
      if (['notes'].includes(k)) continue;
      if (!v) { alert('Please fill all required fields.'); return; }
    }

    try {
      const data = await postJSON(API_BOOK, payload);

      if (data.ok) {
        alert('Thanks! Your request was sent. We’ll confirm shortly.');
        form.reset();
        overlay?.classList.remove('open');
        overlay?.setAttribute('aria-hidden', 'true');
      } else {
        alert('Sorry—could not send just now. Please call 825-973-9800 or email info@executivedriving.ca.');
      }
    } catch (e) {
      alert(e.message || 'Network error. Please try again or contact us directly.');
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

/* ---------- Reveal-on-scroll ---------- */
(() => {
  const { $$ } = window.__XD__;
  const els = $$('[data-reveal]');
  if (!els.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.38, rootMargin: '0px 0px -20% 0px' });

  els.forEach(el => io.observe(el));
})();

/* ---------- Hero sizing + safe autoplay ---------- */
(() => {
  const { $, on } = window.__XD__;
  const hero = $('.hero-section');
  const video = $('.hero-video');
  if (!hero) return;

  const setH = () => {
    const h = window.innerHeight;
    hero.style.minHeight = `${h}px`;
    hero.style.height = `${h}px`;
  };

  setH();
  on(window, 'resize', setH, { passive: true });
  on(window, 'orientationchange', setH);

  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
  }
})();

/* ---------- Terms / Privacy modals ---------- */
(() => {
  const { $, $$, on, lockScroll, unlockScroll } = window.__XD__;

  const wire = (openSel, overlayId) => {
    const modalOverlay = document.getElementById(overlayId);
    const openers = $$(openSel);
    if (!modalOverlay || !openers.length) return;

    const closeBtn = modalOverlay.querySelector('.modal-close');

    const openModal = (e) => {
      e?.preventDefault();
      modalOverlay.classList.add('open');
      modalOverlay.setAttribute('aria-hidden', 'false');
      const menu = $('#menu-overlay');
      if (menu) {
        menu.classList.add('open');
        menu.setAttribute('aria-hidden', 'false');
      }
      lockScroll();
      const focusable = modalOverlay.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
      focusable?.focus({ preventScroll: true });
    };

    const closeModal = () => {
      modalOverlay.classList.remove('open');
      modalOverlay.setAttribute('aria-hidden', 'true');
      const menu = $('#menu-overlay');
      if (menu) {
        menu.classList.add('open');
        menu.setAttribute('aria-hidden', 'false');
      } else {
        unlockScroll();
      }
    };

    openers.forEach(btn => on(btn, 'click', openModal));
    on(closeBtn, 'click', closeModal);
    on(modalOverlay, 'click', (e) => { if (e.target === modalOverlay) closeModal(); });
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
    });
  };

  wire('.js-open-terms', 'terms-overlay');
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

/* ---------- Apple-style logo intro ---------- */
(() => {
  const { $, on, lockScroll, unlockScroll } = window.__XD__;
  const body = document.body;
  const intro = $('#intro');
  if (!intro) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const INTRO_MIN = reduceMotion ? 0 : 3200;
  const INTRO_FADE = 1000;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    intro.classList.add('intro-out');
    setTimeout(() => {
      intro.remove();
      body.classList.remove('intro-active');
      body.classList.add('intro-done');
      unlockScroll();
    }, reduceMotion ? 0 : INTRO_FADE);
  };

  body.classList.add('intro-active');
  lockScroll();

  const skip = (e) => {
    if (!e || e.type === 'click') return finish();
    const ok = ['Escape', 'Enter', ' '].includes(e.key);
    if (ok) finish();
  };

  on(intro, 'click', skip);
  on(document, 'keydown', skip);

  const logo = intro.querySelector('.intro-logo');
  const startTimer = () => setTimeout(finish, INTRO_MIN);

  if (reduceMotion) {
    finish();
  } else if (logo && !logo.complete) {
    const go = () => startTimer();
    logo.addEventListener('load', go, { once: true });
    logo.addEventListener('error', go, { once: true });
    setTimeout(startTimer, 600);
  } else {
    startTimer();
  }

  on(window, 'load', () => {
    if (!reduceMotion) setTimeout(() => intro.classList.add('gleam'), Math.max(0, INTRO_MIN - 200));
  });
})();

/* ---------- Booking modal ---------- */
(() => {
  const { $, $$, on, unlockScroll } = window.__XD__;
  const overlay = $('#booking-overlay');
  if (!overlay) return;

  const modal = overlay.querySelector('.booking-modal');
  const openers = $$('[data-book-open]');
  const closeBtn = overlay.querySelector('[data-book-close]');
  const menu = $('#menu-overlay');
  const burger = document.querySelector('.rr-burger-btn');

  const setState = (open) => {
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    if (!open && !menu?.classList.contains('open')) unlockScroll();
  };

  const open = (e) => {
    e?.preventDefault();
    if (menu?.classList.contains('open')) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      burger?.setAttribute('aria-expanded', 'false');
    }
    setState(true);
  };

  const close = () => setState(false);

  openers.forEach(btn => on(btn, 'click', open));
  on(closeBtn, 'click', close);
  on(overlay, 'click', (e) => { if (!modal.contains(e.target)) close(); });
  on(document, 'keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();

/* ---------- Concierge chat (single clean module) ---------- */
(() => {
  const chatEl   = document.querySelector('.xd-chat');
  const toggle   = document.querySelector('.xd-chat__toggle');
  const closeBtn = document.querySelector('.xd-chat__close');
  const bodyEl   = document.getElementById('xdChatBody');
  const inputEl  = document.getElementById('xdChatInput');
  const sendBtn  = document.getElementById('xdChatSend');

  if (!chatEl || !toggle || !closeBtn || !bodyEl || !inputEl || !sendBtn) return;


  const MAX_TURNS = 20;
  const convo     = [];

const AVATAR_AI   = './images/batman.png';
const AVATAR_USER = './images/userdp.png';


  const escapeHTML = (s = '') =>
    s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const bubble = (text, who = 'user') => {
    const esc = escapeHTML(String(text));
    const withBreaks = esc.replace(/\n/g, '<br>');
    const linkified = withBreaks.replace(
      /\bhttps?:\/\/[^\s<]+/g,
      (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`
    );

    const row = document.createElement('div');
    row.className = `xd-chat__row xd-chat__row--${who}`;
    row.innerHTML = `
      <img class="xd-chat__avatar" src="${who === 'user' ? AVATAR_USER : AVATAR_AI}" alt="">
      <div class="xd-chat__msg">${linkified}</div>
    `;
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  };

  const typing = (() => {
    let el = null;
    return {
      show() {
        if (el) return;
        el = document.createElement('div');
        el.className = 'xd-chat__row xd-chat__row--ai';
        el.innerHTML = `
          <img class="xd-chat__avatar" src="${AVATAR_AI}" alt="">
          <div class="xd-chat__msg xd-chat__typing"><span></span><span></span><span></span></div>
        `;
        bodyEl.appendChild(el);
        bodyEl.scrollTop = bodyEl.scrollHeight;
      },
      hide() {
        if (!el) return;
        el.remove();
        el = null;
      }
    };
  })();

  // --- Friendly airport-aware rephraser ---
  const isAirportish = (s = '') => /\bairport\b/i.test(s) || /\bY[A-Z]{2}\b/.test(s) || /\b(t\d|terminal)\b/i.test(s);

  function adjustReply(raw, lastUserMessage = '') {
    const txt = String(raw).trim();
    const last = String(lastUserMessage).trim();

    // If server asks for "exact address" but user typed an airport (name or IATA), soften it.
    if (/❌\s*Could you share the \*\*exact (pickup|drop-off) address/i.test(txt) && isAirportish(last)) {
      if (/drop-off/i.test(txt)) {
        // They gave an airport as drop-off
        return `Got it — ${last.replace(/\*+/g,'')} ✈️. What date do you need the service?`;
      }
      if (/pickup/i.test(txt)) {
        // They gave an airport as pickup
        return `Got it — pickup at ${last.replace(/\*+/g,'')} ✈️. Where are we dropping you off?`;
      }
    }

    // If server generic-asks "Where are we dropping you off?" right after an airport pickup, keep natural flow.
    if (/Thanks\.\s*Where are we dropping you off\?/i.test(txt) && isAirportish(last)) {
      return txt; // already good
    }

    return txt; // default untouched
  }

  const GREET_KEY = 'xd_greeted';
  const greet = () => {
    bubble("Hi, I’m NAVI 👋 Welcome to Executive Driving — how can I help you today?", "ai");
  };

  const openChat = () => {
    chatEl.hidden = false;
    inputEl.placeholder = "Ask about pricing, availability, vehicles, or say 'book a ride'…";
    inputEl.focus();

    if (!sessionStorage.getItem(GREET_KEY)) {
      greet();
      sessionStorage.setItem(GREET_KEY, '1');
    }
  };

  const closeChat = () => { chatEl.hidden = true; };

  let sending = false;

  async function send() {
    if (sending) return;

    const text = inputEl.value.trim();
    if (!text) return;

    const lastUserMessage = text; // keep for airport-aware rephrase
    sending = true;

    inputEl.value = '';
    bubble(text, 'user');

    convo.push({ role: 'user', content: text });
    if (convo.length > MAX_TURNS) convo.splice(0, convo.length - MAX_TURNS);

    typing.show();
    sendBtn.disabled = true;
    try {
      const data = await postJSON(API_CHAT, { messages: convo });



      const rawReply = (data && typeof data.reply === 'string') ? data.reply : 'Sorry, I didn’t catch that.';
      const reply = adjustReply(rawReply, lastUserMessage);

      typing.hide();
      sendBtn.disabled = false;
      sending = false;

      convo.push({ role: 'assistant', content: reply });
      bubble(reply, 'ai');
      // Respect server "done" flag: lock the chat so it doesn't keep looping
if (data.done) {
  bubble('Session closed. Start a new chat anytime 👍', 'ai');
  inputEl.disabled = true;
  sendBtn.disabled = true;
  inputEl.placeholder = 'Session ended';
  return; // stop processing this send()
}


      if (convo.length > MAX_TURNS) convo.splice(0, convo.length - MAX_TURNS);
    } catch {
      typing.hide();
      sendBtn.disabled = false;
      sending = false;
      bubble('Connection error. Please try again.', 'ai');
    }
  }

  // --- Event wiring ---
  toggle.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', (e) => {
    if (!chatEl.hidden && e.key === 'Escape') closeChat();
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // stop reload
      send();
    }
  });

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    send();
  });
  sendBtn.setAttribute('type', 'button');
  toggle.setAttribute('type', 'button');

})();
// Partners: update the shared infobar with company name + short description
(() => {
  const section = document.querySelector('.partners-marquee');
  if (!section) return;

  const infoBar = section.querySelector('.partner-infobar');
  const titleEl = infoBar ? infoBar.querySelector('strong') : null;
  const descEl  = infoBar ? infoBar.querySelector('span')   : null;
  const partners = [...section.querySelectorAll('.partner')];

  // Safe defaults
  const DEFAULT_TITLE = 'Trusted Partners';
  const DEFAULT_DESC  = ' — Hover a logo to learn more.';

  const setInfo = (el) => {
    if (!infoBar || !titleEl || !descEl) return;
    const name = el.dataset.name || DEFAULT_TITLE;
    const desc = el.dataset.desc ? ` — ${el.dataset.desc}` : '';
    titleEl.textContent = name;
    descEl.textContent  = desc;
    infoBar.classList.add('is-active');
  };

  const resetInfo = () => {
    if (!infoBar || !titleEl || !descEl) return;
    titleEl.textContent = DEFAULT_TITLE;
    descEl.textContent  = DEFAULT_DESC;
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
  const SUBJECT = 'Executive Driving — Booking / Inquiry';
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
// ---------- Google Places Autocomplete (pickup & dropoff) ----------
window.initAutocomplete = function () {
  try {
    const pickup  = document.getElementById("pickup");
    const dropoff = document.getElementById("dropoff");

    if (pickup && window.google?.maps?.places) {
      new google.maps.places.Autocomplete(pickup, {
        componentRestrictions: { country: "ca" },   // Canada only
        fields: ["formatted_address", "geometry"]   // we’ll use later for distance calc
      });
    }
    if (dropoff && window.google?.maps?.places) {
      new google.maps.places.Autocomplete(dropoff, {
        componentRestrictions: { country: "ca" },
        fields: ["formatted_address", "geometry"]
      });
    }
  } catch (e) {
    console.warn("Autocomplete init skipped:", e);
  }
};

