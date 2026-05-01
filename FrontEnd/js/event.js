// ======================================
// EVENTS PAGE — ENHANCED WITH MODERN DROPDOWNS
// ======================================

let ALL_EVENTS = [];
let DISPLAYED_EVENTS = [];

let ACTIVE_FILTERS = {
  city: "all",
  categories: [],
  search: "",
  dateRange: "all",
  specificDate: null // NEW: for calendar picker
};

// Mock trending data
let TRENDING_EVENTS = new Set();

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

// ===== SOCIAL PROOF FUNCTIONS =====

function isTrending(eventId) {
  return TRENDING_EVENTS.has(eventId) || Math.random() > 0.7;
}

// ===== CALENDAR EXPORT FUNCTION =====

function generateICS(event) {
  const eventDate = new Date(`${event.date}T${event.time || "00:00"}`);
  const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Executive Driving//Events//EN
BEGIN:VEVENT
UID:${event.id || event.name}@executivedriving.ca
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.name}
DESCRIPTION:Event at ${event.venue}. Book your ride with Executive Driving!
LOCATION:${event.venue}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  
  return icsContent;
}

function downloadICS(event) {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${event.name.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : "https://executive-driving-backend-b79y.onrender.com";

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
    list.innerHTML = '<p style="text-align: center; padding: 60px 20px; opacity: .6;">Unable to load events.</p>';
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

function renderEvents(append = false) {
  const list = document.getElementById("events-list");
  if (!list) return;

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

  console.log(`✅ Showing all ${filtered.length} events`);

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align: center; padding: 60px 20px; opacity: .6; color: rgba(255,255,255,.6);">No events match your filters.</p>';
    return;
  }

  list.innerHTML = filtered.map(e => renderEventCard(e)).join("");
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
      month: "long",
      day: "numeric",
    });

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

  let imageUrl = "/FrontEnd/images/Fallback-events.jpg";
  if (Array.isArray(e.images) && e.images.length) {
    const img =
      e.images.find(i => i.ratio === "16_9" && i.width >= 640) ||
      e.images.find(i => i.ratio === "16_9") ||
      e.images[0];
    if (img?.url) imageUrl = img.url;
  }

  const categoryLabel = 
    category === "concert" ? "Music" :
    category === "sports" ? "Sports" :
    category === "nightlife" ? "Nightlife" :
    category === "arts" ? "Arts" :
    category === "family" ? "Family" : "";

  const trending = isTrending(eventId);
  const bookingParams = new URLSearchParams({
    event: e.name || "",
    venue: e.venue || "",
    date: d ? d.toLocaleDateString("en-CA") : "",
    eventTime: timeDisplay || ""
  });
  
  let socialProof = "";
  if (trending) {
    socialProof += `<span class="social-proof-badge trending"><i class="ri-fire-line"></i> Trending</span>`;
  }

  return `
    <article class="event-row" data-event-id="${eventId}">
      <div class="event-media">
        <img src="${imageUrl}" alt="${e.name}" loading="lazy">
        ${categoryLabel ? `<span class="event-category">${categoryLabel}</span>` : ""}
        ${dateBox}
      </div>

      <div class="event-content">
        <h3 class="event-title">${e.name}</h3>
        
        <div class="event-meta">
          <div class="event-location">
            <i class="ri-map-pin-line"></i> ${e.venue}
          </div>
          <div class="event-datetime">
            <i class="ri-time-line"></i> ${dateDisplay} • ${timeDisplay}
          </div>
          ${badge}
        </div>

        ${socialProof ? `<div class="social-proof">${socialProof}</div>` : ""}
      </div>

      <div class="event-actions">
        <button class="action-btn calendar-btn" data-action="calendar" title="Add to Calendar">
          <i class="ri-calendar-line"></i>
        </button>
        <button class="action-btn share-btn" data-action="share" title="Share Event">
          <i class="ri-share-line"></i>
        </button>
      </div>

      <div class="event-right">
        <a class="book-btn"
          href="booking.html?${bookingParams.toString()}"
          data-event="${e.name}"
          data-venue="${e.venue}"
          data-date="${d ? d.toLocaleDateString("en-CA") : "TBA"}"
          data-time="${timeDisplay}">
          Book Ride <i class="ri-arrow-right-line"></i>
        </a>
      </div>
    </article>
  `;
}

// ===== MODERN DROPDOWN UI CONTROLS =====

function initDropdownUI() {
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
      
      renderEvents();
    });
  }
}

// ===== MOBILE FILTER TOGGLE =====

function initMobileFilters() {
  const openBtn = document.getElementById('openFilters');
  const sidebar = document.querySelector('.events-sidebar');
  
  if (openBtn && sidebar) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    
    // Close when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && 
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !openBtn.contains(e.target)) {
        sidebar.classList.remove('open');
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

// ===== NOTIFY ME FEATURE =====

(() => {
  const bookingForm = document.getElementById("booking-form");
  if (!bookingForm) return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const thanksOverlay = document.getElementById('thanks-overlay');
        if (thanksOverlay && thanksOverlay.classList.contains('open')) {
          handleNotifySubscription();
          observer.disconnect();
        }
      }
    });
  });
  
  const thanksOverlay = document.getElementById('thanks-overlay');
  if (thanksOverlay) {
    observer.observe(thanksOverlay, { attributes: true });
  }
  
  async function handleNotifySubscription() {
    const notifyMeCheckbox = document.getElementById("notifyMe");
    const emailInput = bookingForm.querySelector('input[name="email"]');
    const email = emailInput ? emailInput.value : '';
    
    if (!notifyMeCheckbox || !notifyMeCheckbox.checked || !email) {
      return;
    }
    
    try {
      const notesField = bookingForm.querySelector('textarea[name="notes"]');
      const currentEventName = notesField ? notesField.value : '';
      
      let categories = [];
      const notesLower = currentEventName.toLowerCase();
      
      if (notesLower.includes('concert') || notesLower.includes('music')) {
        categories.push('concert');
      }
      if (notesLower.includes('sport') || notesLower.includes('game')) {
        categories.push('sports');
      }
      if (notesLower.includes('club') || notesLower.includes('nightlife')) {
        categories.push('nightlife');
      }
      if (notesLower.includes('art') || notesLower.includes('theatre') || notesLower.includes('theater')) {
        categories.push('arts');
      }
      if (notesLower.includes('family')) {
        categories.push('family');
      }
      
      if (categories.length === 0) {
        categories = ['concert', 'sports', 'nightlife', 'arts', 'family'];
      }
      
      const notifyResponse = await fetch(`${API_BASE}/api/notify/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          categories: categories,
          city: ACTIVE_FILTERS.city !== "all" ? ACTIVE_FILTERS.city : "all"
        })
      });
      
      if (notifyResponse.ok) {
        console.log('✅ Notification subscription successful');
        showToast('You\'ll be notified about similar events!');
      }
    } catch (err) {
      console.warn('⚠️ Notification subscription failed:', err);
    }
  }
})();

console.log("✅ Event.js Enhanced with Dropdowns loaded");
