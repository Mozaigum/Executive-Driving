// ======================================
// EVENTS PAGE — PROFESSIONAL VERSION
// ======================================

let ALL_EVENTS = [];
let ACTIVE_FILTERS = {
  city: "all",
  categories: [],
  search: ""
};

// Event type mapping
const EVENT_CATEGORIES = {
  concert: ["Music", "Concert"],
  sports: ["Sports"],
  nightlife: ["Nightlife", "Bar", "Club"],
  arts: ["Arts", "Theatre", "Theater"],
  family: ["Family"]
};

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

function getEventCategory(event) {
  if (event.type === "nightlife") return "nightlife";
  
  const classification = event.classification?.toLowerCase() || "";
  const genre = event.genre?.toLowerCase() || "";
  const name = event.name?.toLowerCase() || "";
  
  if (classification.includes("music") || classification.includes("concert") || genre.includes("music")) {
    return "concert";
  }
  if (classification.includes("sports") || genre.includes("sports")) {
    return "sports";
  }
  if (classification.includes("arts") || classification.includes("theatre") || classification.includes("theater")) {
    return "arts";
  }
  if (classification.includes("family") || name.includes("family")) {
    return "family";
  }
  if (name.includes("bar") || name.includes("club") || name.includes("lounge")) {
    return "nightlife";
  }
  
  return "other";
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

  list.innerHTML = '<p style="opacity:.6; text-align: center; padding: 60px 0;">Loading events...</p>';

  try {
    console.log("🔄 Loading events...");

    // Load Ticketmaster events
    const res = await fetch(`${API_BASE}/api/events/ticketmaster?city=all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    ALL_EVENTS = data.events || [];
    console.log("✅ Events loaded:", ALL_EVENTS.length);

    // Load nightlife venues
    try {
      const nightlifeRes = await fetch(`${API_BASE}/api/events/nightlife?city=${ACTIVE_FILTERS.city}`);
      if (nightlifeRes.ok) {
        const nightlifeData = await nightlifeRes.json();
        if (Array.isArray(nightlifeData.events)) {
          ALL_EVENTS = [...ALL_EVENTS, ...nightlifeData.events];
        }
      }
    } catch (err) {
      console.warn("⚠️ Nightlife unavailable");
    }

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

  Object.keys(categories).forEach(cat => {
    const countEl = document.querySelector(`[data-category="${cat}"] .filter-count`);
    if (countEl) {
      countEl.textContent = categories[cat];
    }
  });
}

// ===== RENDER EVENTS =====

function renderEvents() {
  const list = document.getElementById("events-list");
  if (!list) return;

  let filtered = ALL_EVENTS;

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

  // Separate nightlife from dated events
  const nightlifeEvents = filtered.filter(e => e.type === "nightlife");
  const datedEvents = filtered.filter(e => e.type !== "nightlife");

  // Filter out past events
  const now = new Date();
  const futureDatedEvents = datedEvents.filter(e => {
    if (!e.date) return false;
    const eventDate = new Date(`${e.date}T${e.time || "00:00"}`);
    return !isNaN(eventDate) && eventDate >= now;
  });

  // Sort by soonest first
  futureDatedEvents.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}`);
    const db = new Date(`${b.date}T${b.time || "00:00"}`);
    return da - db;
  });

  // Combine
  filtered = [...futureDatedEvents, ...nightlifeEvents];

  console.log(`✅ Showing: ${filtered.length} events`);

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align: center; padding: 60px 20px; opacity: .6;">No events match your filters.</p>';
    return;
  }

  // Build HTML
  list.innerHTML = filtered.map(e => {
    const isNightlife = e.type === "nightlife";
    
    let d = null;
    let badge = "";
    let dateDisplay = "";
    let timeDisplay = e.time || "TBA";
    let dateColumn = "";

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

      dateColumn = `
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

    const eventName = e.name
      .replace(/ feat\. /gi, "<br>")
      .replace(/ - /g, "<br>")
      .replace(/ vs /gi, "<br>")
      .replace(/ v /gi, "<br>");

    return `
      <article class="event-row">
        ${badge}
        
        <div class="event-media">
          <img src="${imageUrl}" alt="${e.name}" loading="lazy">
        </div>

        <div class="event-content">
          <div class="event-title-row">
            <h3 class="event-title">${eventName}</h3>
          </div>

          <div class="event-meta">
            <div class="event-location">
              <i class="ri-map-pin-line"></i> ${e.venue}
            </div>
            <div class="event-datetime">
              <i class="ri-time-line"></i> ${dateDisplay} • ${timeDisplay}
            </div>
          </div>

          <div class="event-footer">
            <a class="book-btn"
              href="#"
              data-event="${e.name}"
              data-venue="${e.venue}"
              data-date="${d ? d.toLocaleDateString("en-CA") : "TBA"}"
              data-time="${timeDisplay}">
              Book a Ride <i class="ri-arrow-right-line"></i>
            </a>
          </div>
        </div>

        ${dateColumn}
      </article>
    `;
  }).join("");
}

// ===== EVENT LISTENERS =====

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Events initialized");
  loadEvents();

  // Search input
  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      ACTIVE_FILTERS.search = e.target.value;
      renderEvents();
    });
  }

  // City filter buttons
  document.querySelectorAll(".city-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".city-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      ACTIVE_FILTERS.city = btn.dataset.city;
      console.log("🏙️ City:", ACTIVE_FILTERS.city);
      
      renderEvents();
    });
  });

  // Category filters
  document.querySelectorAll(".filter-item").forEach(item => {
    item.addEventListener("click", () => {
      const category = item.dataset.category;
      const checkbox = item.querySelector(".filter-checkbox");
      
      if (ACTIVE_FILTERS.categories.includes(category)) {
        ACTIVE_FILTERS.categories = ACTIVE_FILTERS.categories.filter(c => c !== category);
        checkbox.classList.remove("checked");
      } else {
        ACTIVE_FILTERS.categories.push(category);
        checkbox.classList.add("checked");
      }
      
      renderEvents();
    });
  });

  // Clear filters
  const clearBtn = document.getElementById("clear-filters");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      ACTIVE_FILTERS.categories = [];
      ACTIVE_FILTERS.search = "";
      
      document.querySelectorAll(".filter-checkbox").forEach(cb => cb.classList.remove("checked"));
      if (searchInput) searchInput.value = "";
      
      renderEvents();
    });
  }
});

// Booking button handler
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".book-btn");
  if (!btn) return;

  e.preventDefault();

  const notesText = `Event: ${btn.dataset.event}
Venue: ${btn.dataset.venue}
Date: ${btn.dataset.date}
Time: ${btn.dataset.time}`;

  const notesField = document.querySelector('#booking-form textarea[name="notes"]');
  if (notesField) notesField.value = notesText;

  const dropoffInput = document.querySelector('#booking-form input[name="dropoff"]');
  if (dropoffInput && btn.dataset.venue) {
    dropoffInput.value = btn.dataset.venue;
  }

  const overlay = document.getElementById("booking-overlay");
  if (overlay) {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }
});

console.log("✅ Events loaded");