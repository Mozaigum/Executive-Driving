// ======================================
// EVENTS PAGE,  ENHANCED WITH MODERN DROPDOWNS
// ======================================

let ALL_EVENTS = [];
let DISPLAYED_EVENTS = [];
const EVENTS_PER_PAGE = 12;
let currentEventPage = 1;

let ACTIVE_FILTERS = {
  city: "all",
  categories: [],
  search: "",
  dateRange: "all",
  specificDate: null // NEW: for calendar picker
};

// Controls edit a draft; the event list changes only after Apply.
let APPLIED_FILTERS = structuredClone(ACTIVE_FILTERS);

// ===== HELPER FUNCTIONS =====

function isToday(date) {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isThisWeekend(date) {
  const day = date.getDay();
  const today = new Date();

  if (day === 0 || day === 6) {
    const diff = Math.abs(date - today);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 7;
  }
  return false;
}

function isThisWeek(date) {
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return date >= today && date <= weekFromNow;
}

function isThisMonth(date) {
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function isNextMonth(date) {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthAfter = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  return date >= nextMonth && date < monthAfter;
}

function getEventCategory(event) {
  if (event.type === "nightlife") {
    return "nightlife";
  }

  const classification = (event.classification || "").toLowerCase();
  const genre = (event.genre || "").toLowerCase();
  const name = (event.name || "").toLowerCase();

  if (classification.includes("music") || classification.includes("concert")) {
    return "concert";
  }
  if (classification.includes("sport")) {
    return "sports";
  }
  if (classification.includes("arts") || classification.includes("theatre") || classification.includes("theater")) {
    return "arts";
  }
  if (classification.includes("family")) {
    return "family";
  }

  if (genre.includes("music") || genre.includes("concert")) {
    return "concert";
  }
  if (genre.includes("sport")) {
    return "sports";
  }

  if (name.includes("concert") || name.includes("music")) {
    return "concert";
  }
  if (name.includes("game") || name.includes("vs") || name.includes("bears") || name.includes("oilers")) {
    return "sports";
  }
  if (name.includes("family")) {
    return "family";
  }

  return "other";
}

// ===== CALENDAR EXPORT FUNCTION =====

function icsText(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }

function generateICS(event) {
  const eventDate = new Date(`${event.date}T${event.time || "00:00"}Z`);
  const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);

  const formatDate = (date) => {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  };

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Executive Driving//Events//EN
BEGIN:VEVENT
UID:${encodeURIComponent(event.id || event.name)}@executivedriving.ca
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART;TZID=America/Edmonton:${formatDate(eventDate)}
DTEND;TZID=America/Edmonton:${formatDate(endDate)}
SUMMARY:${icsText(event.name)}
DESCRIPTION:Event at ${icsText(event.venue)}. Book your ride with Executive Driving!
LOCATION:${icsText(event.venue)}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

function downloadICS(event) {
  if (!event.date) return;
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${event.name.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ===== SHARE FUNCTION =====

async function shareEvent(event) {
  const shareData = {
    title: event.name,
    text: `Check out ${event.name} at ${event.venue}!`,
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      console.log('✅ Event shared successfully');
    } catch (err) {
      if (err.name !== 'AbortError') {
        fallbackShare(event);
      }
    }
  } else {
    fallbackShare(event);
  }
}

function fallbackShare(event) {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard!');
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== API CONFIG =====

const API_BASE =
  (["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3001" : "") ||
  document.querySelector('meta[name="api-base"]')?.content?.replace(/\/$/, "") ||
  "https://executive-driving-backend-b79y.onrender.com";

// ===== LOAD EVENTS FROM API =====

async function loadEvents() {
  const list = document.getElementById("events-list");
  if (!list) {
    console.error("❌ #events-list not found");
    return;
  }

  list.innerHTML = '<p style="opacity:.6; text-align: center; padding: 60px 0; color: #d4af37;">Loading events...</p>';

  try {
    console.log("🔄 Loading events...");

    const res = await fetch(`${API_BASE}/api/events/ticketmaster?city=all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    ALL_EVENTS = data.events || [];
    window.__xdTicketmasterEvents = ALL_EVENTS.slice();
    document.dispatchEvent(new Event('ticketmaster-events-loaded'));
    console.log("✅ Ticketmaster events:", ALL_EVENTS.length);

    try {
      const nightlifeRes = await fetch(`${API_BASE}/api/events/nightlife?city=all`);
      if (nightlifeRes.ok) {
        const nightlifeData = await nightlifeRes.json();
        if (Array.isArray(nightlifeData.events)) {
          console.log("✅ Nightlife venues:", nightlifeData.events.length);
          ALL_EVENTS = [...ALL_EVENTS, ...nightlifeData.events];
        }
      }
    } catch (err) {
      console.warn("⚠️ Nightlife unavailable");
    }

    console.log("✅ Total events loaded:", ALL_EVENTS.length);

    updateFilterCounts();
    renderEvents();
  } catch (err) {
    console.error("❌ Error:", err);
    list.innerHTML = `
      <div class="events-fallback">
        <span class="events-fallback__label">Event planning</span>
        <h2>The calendar is taking a moment.</h2>
        <p>Tell us which concert, game or private event you are attending. We can still arrange the vehicle, pickup and return journey directly.</p>
        <a href="booking.html?service=event" class="ed-button">Plan event transportation</a>
      </div>`;
  }
}

// ===== UPDATE FILTER COUNTS =====

function updateFilterCounts() {
  const categories = {
    concert: 0,
    sports: 0,
    nightlife: 0,
    arts: 0,
    family: 0
  };

  ALL_EVENTS.forEach(event => {
    const category = getEventCategory(event);
    if (categories[category] !== undefined) {
      categories[category]++;
    }
  });

  console.log("📊 Category counts:", categories);

  // Update counts in dropdown checkboxes
  Object.keys(categories).forEach(cat => {
    const countEl = document.querySelector(`.dropdown-checkbox-item input[data-category="${cat}"] ~ .checkbox-count`);
    if (countEl) {
      countEl.textContent = categories[cat];
    }
  });
}

// ===== RENDER EVENTS =====

function renderEvents(resetPage = true) {
  if (document.body.classList.contains('filters-open')) return;
  const ACTIVE_FILTERS = APPLIED_FILTERS;
  const list = document.getElementById("events-list");
  if (!list) return;
  if (resetPage) currentEventPage = 1;

  let filtered = ALL_EVENTS;

  console.log("🎯 Starting with", filtered.length, "events");

  // Filter by city
  if (ACTIVE_FILTERS.city !== "all") {
    filtered = filtered.filter(e => {
      if (!e.city) return false;
      return e.city.toLowerCase() === ACTIVE_FILTERS.city.toLowerCase();
    });
  }

  // Filter by category
  if (ACTIVE_FILTERS.categories.length > 0) {
    filtered = filtered.filter(e => {
      const category = getEventCategory(e);
      return ACTIVE_FILTERS.categories.includes(category);
    });
  }

  // Filter by search
  if (ACTIVE_FILTERS.search) {
    const searchLower = ACTIVE_FILTERS.search.toLowerCase();
    filtered = filtered.filter(e => {
      const name = (e.name || "").toLowerCase();
      const venue = (e.venue || "").toLowerCase();
      return name.includes(searchLower) || venue.includes(searchLower);
    });
  }

  // Filter by specific date (calendar picker)
  if (ACTIVE_FILTERS.specificDate) {
    filtered = filtered.filter(e => {
      if (!e.date || e.type === "nightlife") return false;
      return e.date === ACTIVE_FILTERS.specificDate;
    });
  }
  // Filter by date range (quick buttons)
  else if (ACTIVE_FILTERS.dateRange !== "all") {
    filtered = filtered.filter(e => {
      if (!e.date || e.type === "nightlife") return ACTIVE_FILTERS.dateRange === "all";

      const eventDate = new Date(`${e.date}T${e.time || "00:00"}`);

      switch (ACTIVE_FILTERS.dateRange) {
        case "today":
          return isToday(eventDate);
        case "thisWeek":
          return isThisWeek(eventDate);
        case "thisMonth":
          return isThisMonth(eventDate);
        case "nextMonth":
          return isNextMonth(eventDate);
        default:
          return true;
      }
    });
  }

  // Separate and sort
  const nightlifeEvents = filtered.filter(e => e.type === "nightlife");
  const datedEvents = filtered.filter(e => e.type !== "nightlife");

  const now = new Date();
  const futureDatedEvents = datedEvents.filter(e => {
    if (!e.date) return false;
    const eventDate = new Date(`${e.date}T${e.time || "00:00"}`);
    return !isNaN(eventDate) && eventDate >= now;
  });

  futureDatedEvents.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}`);
    const db = new Date(`${b.date}T${b.time || "00:00"}`);
    return da - db;
  });

  filtered = [...futureDatedEvents, ...nightlifeEvents];

  if (filtered.length === 0) {
    list.innerHTML = '<p class="events-empty" role="status">No events match these filters. Open Filters to try another date or location.</p>';
    renderEventPagination(0);
    return;
  }

  const pageCount = Math.ceil(filtered.length / EVENTS_PER_PAGE);
  currentEventPage = Math.min(currentEventPage, pageCount);
  const start = (currentEventPage - 1) * EVENTS_PER_PAGE;
  list.innerHTML = filtered.slice(start, start + EVENTS_PER_PAGE).map(e => renderEventCard(e)).join("");
  renderEventPagination(filtered.length);
}

function renderEventPagination(total) {
  const nav = document.getElementById('eventPagination');
  const summary = document.getElementById('eventPageSummary');
  if (!nav || !summary) return;
  const pageCount = Math.ceil(total / EVENTS_PER_PAGE);
  summary.textContent = total ? `${(currentEventPage - 1) * EVENTS_PER_PAGE + 1}–${Math.min(currentEventPage * EVENTS_PER_PAGE, total)} of ${total} events` : '';
  nav.hidden = pageCount <= 1;
  if (pageCount <= 1) { nav.innerHTML = ''; return; }
  const start = Math.max(1, Math.min(currentEventPage - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const button = (page, text, label, disabled = false) => `<button type="button" data-page="${page}" aria-label="${label}"${disabled ? ' disabled' : ''}${page === currentEventPage && /^\d+$/.test(text) ? ' aria-current="page"' : ''}>${text}</button>`;
  let html = button(currentEventPage - 1, '‹', 'Previous page', currentEventPage === 1);
  if (start > 1) html += button(1, '1', 'Page 1') + (start > 2 ? '<span aria-hidden="true">…</span>' : '');
  for (let page = start; page <= end; page++) html += button(page, String(page), `Page ${page}`);
  if (end < pageCount) html += (end < pageCount - 1 ? '<span aria-hidden="true">…</span>' : '') + button(pageCount, String(pageCount), `Page ${pageCount}`);
  nav.innerHTML = html + button(currentEventPage + 1, '›', 'Next page', currentEventPage === pageCount);
  nav.querySelectorAll('button').forEach(control => control.addEventListener('click', () => {
    currentEventPage = Math.max(1, Math.min(pageCount, Number(control.dataset.page)));
    renderEvents(false);
    nav.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
    document.getElementById('events-list')?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }));
}

function getEventImage(event, category) {
  const fallback = category === 'sports' ? 'images/ai/hockey.jpg'
    : (category === 'concert' || category === 'arts') ? 'images/ai/concert.jpg'
    : 'images/ai/skyline.jpg';
  const images = Array.isArray(event.images) ? event.images.filter(image =>
    image && typeof image.url === 'string' && /^https?:\/\//i.test(image.url.trim())) : [];
  const selected = images.find(image => image.ratio === '16_9' && image.width >= 640)
    || images.find(image => image.ratio === '16_9')
    || images.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0];
  const url = selected ? selected.url.trim().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') : fallback;
  return { url, fallback, description: selected ? 'Event promotional image' : 'Event venue illustration' };
}

// Remote promotional images can disappear after the feed has loaded.
document.addEventListener('error', event => {
  const img = event.target;
  if (!img?.matches?.('.event-media img[data-fallback]')) return;
  const fallback = img.dataset.fallback;
  img.removeAttribute('data-fallback');
  img.alt = 'Event venue illustration';
  img.src = fallback;
}, true);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function renderEventCard(e) {
  const isNightlife = e.type === "nightlife";
  const category = getEventCategory(e);
  const eventId = e.id || e.name;

  let d = null;
  let badge = "";
  let dateDisplay = "";
  let timeDisplay = e.time || "TBA";
  let dateBox = "";

  if (!isNightlife && e.date) {
    d = new Date(`${e.date}T${e.time || "00:00"}`);

    if (isToday(d)) {
      badge = `<span class="event-badge today">Today</span>`;
    } else if (isThisWeekend(d)) {
      badge = `<span class="event-badge weekend">This Weekend</span>`;
    }

    dateDisplay = d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    if (e.time && !Number.isNaN(d.getTime())) {
      timeDisplay = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: d.getMinutes() ? '2-digit' : undefined,
        hour12: true
      });
    }

    dateBox = `
      <div class="event-date">
        <span class="day">${d.getDate()}</span>
        <span class="month">${d.toLocaleString("en", { month: "short" }).toUpperCase()}</span>
      </div>
    `;
  } else {
    dateDisplay = "Open nightly";
    timeDisplay = e.hours || "See venue for hours";
  }

  const eventImage = getEventImage(e, category);

  const categoryLabel =
    category === "concert" ? "Music" :
    category === "sports" ? "Sports" :
    category === "nightlife" ? "Nightlife" :
    category === "arts" ? "Arts" :
    category === "family" ? "Family" : "";

  const bookingParams = new URLSearchParams({
    event: e.name || "",
    venue: e.venue || "",
    date: d ? d.toLocaleDateString("en-CA") : "",
    eventTime: e.time || ""
  });


  return `
    <article class="event-row" data-event-id="${escapeHTML(eventId)}">
      <div class="event-media">
        <img src="${eventImage.url}" alt="${eventImage.description}" data-fallback="${eventImage.fallback}" loading="lazy" decoding="async">
        ${categoryLabel ? `<span class="event-category">${categoryLabel}</span>` : ""}
        ${dateBox}
      </div>

      <div class="event-content">
        <h3 class="event-title">${escapeHTML(e.name)}</h3>

        <div class="event-meta">
          <div class="event-location">
            <i class="ri-map-pin-line"></i> ${escapeHTML(e.venue)}
          </div>
          <div class="event-datetime">
            <i class="ri-time-line"></i> ${dateDisplay} • ${escapeHTML(timeDisplay)}
          </div>
          ${badge}
        </div>

      </div>

      <div class="event-actions">
        <button class="action-btn calendar-btn" data-action="calendar" title="Add to Calendar"${!e.date ? ' disabled aria-disabled="true"' : ''}>
          <i class="ri-calendar-line"></i>
        </button>
        <button class="action-btn share-btn" data-action="share" title="Share Event">
          <i class="ri-share-line"></i>
        </button>
      </div>

      <div class="event-right">
        <p class="event-ride-note">Private pickup. A relaxed ride home.</p>
        <a class="book-btn"
          href="booking.html?${bookingParams.toString()}"
          data-event="${escapeHTML(e.name)}"
          data-venue="${escapeHTML(e.venue)}"
          data-date="${d ? d.toLocaleDateString("en-CA") : "TBA"}"
          data-time="${escapeHTML(e.time || '')}">
          Request a quote <i class="ri-arrow-right-line"></i>
        </a>
      </div>
    </article>
  `;
}

// ===== MODERN DROPDOWN UI CONTROLS =====

function initDropdownUI() {
  if (document.querySelector('.simple-filters')) {
    initSimpleFilters();
    return;
  }
  // Date Dropdown
  const dateToggle = document.getElementById('dateDropdownToggle');
  const dateMenu = document.getElementById('dateDropdownMenu');

  // City Dropdown
  const cityToggle = document.getElementById('cityDropdownToggle');
  const cityMenu = document.getElementById('cityDropdownMenu');

  // Event Type Dropdown
  const typeToggle = document.getElementById('typeDropdownToggle');
  const typeMenu = document.getElementById('typeDropdownMenu');

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('open');
    });
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      toggle.classList.remove('active');
    });
  }

  function toggleDropdown(toggle, menu) {
    const isOpen = menu.classList.contains('open');
    closeAllDropdowns();

    if (!isOpen) {
      menu.classList.add('open');
      toggle.classList.add('active');
    }
  }

  // Dropdown toggle listeners
  if (dateToggle && dateMenu) {
    dateToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(dateToggle, dateMenu);
    });
  }

  if (cityToggle && cityMenu) {
    cityToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(cityToggle, cityMenu);
    });
  }

  if (typeToggle && typeMenu) {
    typeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(typeToggle, typeMenu);
    });
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) {
      closeAllDropdowns();
    }
  });

  // Prevent closing when clicking inside menu
  document.querySelectorAll('.dropdown-menu').forEach(menu => {
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Date Picker & Quick Buttons
  const datePicker = document.getElementById('eventDatePicker');
  const quickDateBtns = document.querySelectorAll('.quick-date-btn');
  const dateLabel = document.querySelector('#dateDropdownToggle .dropdown-label');

  quickDateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');

      quickDateBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      dateLabel.textContent = btn.textContent;

      ACTIVE_FILTERS.dateRange = range;
      ACTIVE_FILTERS.specificDate = null; // Clear specific date

      if (datePicker) datePicker.value = '';

      renderEvents();

      setTimeout(() => {
        dateMenu.classList.remove('open');
        dateToggle.classList.remove('active');
      }, 200);
    });
  });

  if (datePicker) {
    datePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        quickDateBtns.forEach(b => b.classList.remove('active'));

        const selectedDate = new Date(e.target.value);
        dateLabel.textContent = selectedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });

        ACTIVE_FILTERS.specificDate = e.target.value;
        ACTIVE_FILTERS.dateRange = "all"; // Clear range when using picker

        renderEvents();

        setTimeout(() => {
          dateMenu.classList.remove('open');
          dateToggle.classList.remove('active');
        }, 200);
      }
    });
  }

  // City Dropdown Items
  const cityItems = document.querySelectorAll('#cityDropdownMenu .dropdown-item');
  const cityLabel = document.querySelector('#cityDropdownToggle .dropdown-label');

  cityItems.forEach(item => {
    item.addEventListener('click', () => {
      const city = item.getAttribute('data-city');

      cityItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      cityLabel.textContent = item.textContent.trim();

      ACTIVE_FILTERS.city = city.toLowerCase();
      renderEvents();

      setTimeout(() => {
        cityMenu.classList.remove('open');
        cityToggle.classList.remove('active');
      }, 200);
    });
  });

  // Event Type Checkboxes
  const checkboxItems = document.querySelectorAll('.dropdown-checkbox-item');
  const typeLabel = document.querySelector('#typeDropdownToggle .dropdown-label');

  checkboxItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return; // Let checkbox handle itself

      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;

      const category = checkbox.getAttribute('data-category');

      if (checkbox.checked) {
        if (!ACTIVE_FILTERS.categories.includes(category)) {
          ACTIVE_FILTERS.categories.push(category);
        }
      } else {
        ACTIVE_FILTERS.categories = ACTIVE_FILTERS.categories.filter(c => c !== category);
      }

      updateTypeLabel();
      renderEvents();
    });

    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      const category = checkbox.getAttribute('data-category');

      if (checkbox.checked) {
        if (!ACTIVE_FILTERS.categories.includes(category)) {
          ACTIVE_FILTERS.categories.push(category);
        }
      } else {
        ACTIVE_FILTERS.categories = ACTIVE_FILTERS.categories.filter(c => c !== category);
      }

      updateTypeLabel();
      renderEvents();
    });
  });

  function updateTypeLabel() {
    const checkedBoxes = document.querySelectorAll('.dropdown-checkbox-item input[type="checkbox"]:checked');

    if (checkedBoxes.length === 0) {
      typeLabel.textContent = 'All Types';
    } else if (checkedBoxes.length === 1) {
      typeLabel.textContent = checkedBoxes[0].parentElement.querySelector('.checkbox-label').textContent;
    } else {
      typeLabel.textContent = `${checkedBoxes.length} Types Selected`;
    }
  }

  console.log('✅ Dropdown UI initialized');
}

// ===== CLEAR FILTERS =====

function initSimpleFilters() {
  const datePicker = document.getElementById('eventDatePicker');
  const quickDates = [...document.querySelectorAll('.quick-date-btn')];
  const cities = [...document.querySelectorAll('[data-city]')];
  quickDates.forEach(button => button.addEventListener('click', () => {
    ACTIVE_FILTERS.dateRange = button.dataset.range;
    ACTIVE_FILTERS.specificDate = null;
    datePicker.value = '';
    quickDates.forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
  }));
  datePicker?.addEventListener('change', () => {
    ACTIVE_FILTERS.specificDate = datePicker.value || null;
    ACTIVE_FILTERS.dateRange = 'all';
    quickDates.forEach(item => {
      const selected = !datePicker.value && item.dataset.range === 'all';
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  });
  cities.forEach(button => button.addEventListener('click', () => {
    ACTIVE_FILTERS.city = button.dataset.city;
    cities.forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
  }));
  document.querySelectorAll('[data-category]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      ACTIVE_FILTERS.categories = [...document.querySelectorAll('[data-category]:checked')]
        .map(input => input.dataset.category);
    });
  });
}

function initClearFilters() {
  const clearBtn = document.getElementById('clear-filters');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Reset filters
      ACTIVE_FILTERS.categories = [];
      ACTIVE_FILTERS.search = "";
      ACTIVE_FILTERS.city = "all";
      ACTIVE_FILTERS.dateRange = "all";
      ACTIVE_FILTERS.specificDate = null;

      // Reset date picker
      const datePicker = document.getElementById('eventDatePicker');
      if (datePicker) datePicker.value = '';

      // Reset quick date buttons
      document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-range') === 'all') {
          btn.classList.add('active');
        }
      });

      // Reset city dropdown
      document.querySelectorAll('#cityDropdownMenu .dropdown-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-city') === 'all') {
          item.classList.add('active');
        }
      });

      // Reset event type checkboxes
      document.querySelectorAll('.dropdown-checkbox-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });

      // Reset labels
      const dateLabel = document.querySelector('#dateDropdownToggle .dropdown-label');
      const cityLabel = document.querySelector('#cityDropdownToggle .dropdown-label');
      const typeLabel = document.querySelector('#typeDropdownToggle .dropdown-label');

      if (dateLabel) dateLabel.textContent = 'Select Date';
      if (cityLabel) cityLabel.textContent = 'All Cities';
      if (typeLabel) typeLabel.textContent = 'All Types';

      // Reset search input
      const searchInput = document.getElementById('event-search');
      if (searchInput) searchInput.value = '';
      document.querySelectorAll('.quick-date-btn, [data-city]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.classList.contains('active')));
      });

      APPLIED_FILTERS = structuredClone(ACTIVE_FILTERS);
      document.querySelectorAll('[data-category]').forEach(input => { input.checked = false; });
      document.querySelectorAll('[data-city]').forEach(button => button.classList.toggle('active', button.dataset.city === 'all'));
      clearBtn.closest('.events-sidebar') && document.getElementById('openFilters')?.classList.remove('has-filters');
      renderEvents();
    });
  }
}

// ===== MOBILE FILTER TOGGLE =====

function initMobileFilters() {
  const openBtn = document.getElementById('openFilters');
  const sidebar = document.querySelector('.events-sidebar');
  const closeBtn = document.getElementById('closeFilters');
  const applyBtn = document.getElementById('applyFilters');
  const backdrop = document.getElementById('filterBackdrop');
  if (sidebar) sidebar.inert = true;

  const closeFilters = () => {
    sidebar?.classList.remove('open');
    document.body.classList.remove('filters-open');
    openBtn?.setAttribute('aria-expanded', 'false');
    sidebar?.setAttribute('aria-hidden', 'true');
    if (sidebar) sidebar.inert = true;
    openBtn?.focus({ preventScroll: true });
    renderEvents();
  };

  const openFilters = () => {
    sidebar?.classList.add('open');
    document.body.classList.add('filters-open');
    openBtn?.setAttribute('aria-expanded', 'true');
    sidebar?.setAttribute('aria-hidden', 'false');
    if (sidebar) sidebar.inert = false;
    if (!window.matchMedia('(any-pointer: coarse)').matches) {
      document.getElementById('event-search')?.focus({ preventScroll: true });
    }
  };

  if (openBtn && sidebar) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('open')) closeFilters();
      else openFilters();
    });
    closeBtn?.addEventListener('click', closeFilters);
    backdrop?.addEventListener('click', closeFilters);
    applyBtn?.addEventListener('click', () => {
      APPLIED_FILTERS = structuredClone(ACTIVE_FILTERS);
      const count = (APPLIED_FILTERS.city !== 'all' ? 1 : 0)
        + APPLIED_FILTERS.categories.length
        + (APPLIED_FILTERS.search.trim() ? 1 : 0)
        + (APPLIED_FILTERS.specificDate || APPLIED_FILTERS.dateRange !== 'all' ? 1 : 0);
      openBtn.classList.toggle('has-filters', count > 0);
      openBtn.setAttribute('aria-label', count ? `Filter events, ${count} active` : 'Filter events');
      closeFilters();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) closeFilters();
      if (e.key === 'Tab' && sidebar.classList.contains('open') && !sidebar.classList.contains('inline-filters')) {
        const focusable = [...sidebar.querySelectorAll('button, input, [tabindex="0"]')]
          .filter(el => !el.disabled && el.getClientRects().length && !el.closest('.dropdown-menu:not(.open)'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
  }
}

// ===== MAIN INITIALIZATION =====

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Events page loaded - Enhanced with Dropdowns");

  // Load events from API
  loadEvents();

  // Initialize dropdown UI
  initDropdownUI();

  // Initialize clear filters
  initClearFilters();

  // Initialize mobile filters
  initMobileFilters();

  // Search input
  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      ACTIVE_FILTERS.search = e.target.value;
      APPLIED_FILTERS.search = ACTIVE_FILTERS.search;
      renderEvents();
    });
  }
});

// ===== EVENT ACTION HANDLERS =====

// Calendar and share buttons
document.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (actionBtn) {
    e.preventDefault();
    const action = actionBtn.dataset.action;
    const eventRow = actionBtn.closest(".event-row");
    const eventId = eventRow.dataset.eventId;
    const event = ALL_EVENTS.find(ev => (ev.id || ev.name) === eventId);

    if (!event) return;

    switch (action) {
      case "calendar":
        downloadICS(event);
        showToast("Event added to calendar!");
        break;
      case "share":
        shareEvent(event);
        break;
    }
  }
});

// Booking button handler
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".book-btn");
  if (!btn) return;

  if (!btn.getAttribute("href") || btn.getAttribute("href") === "#") {
    e.preventDefault();
    const params = new URLSearchParams({
      event: btn.dataset.event || "",
      venue: btn.dataset.venue || "",
      date: btn.dataset.date !== "TBA" ? (btn.dataset.date || "") : "",
      eventTime: btn.dataset.time || ""
    });
    window.location.href = `booking.html?${params.toString()}`;
  }
});
