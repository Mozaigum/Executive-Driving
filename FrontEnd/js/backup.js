let ALL_EVENTS = [];
let ACTIVE_FILTERS = {
  city: "all" // all | edmonton | gp
};

function isToday(date) {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isThisWeekend(date) {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : "https://executive-driving-backend-b79y.onrender.com";

async function loadEvents() {
  const list = document.getElementById("events-list");
  if (!list) return;

  list.innerHTML = '<p style="opacity:.7">Loading events…</p>';

  try {
    const res = await fetch(`${API_BASE}/api/events/ticketmaster?city=all`);
    const data = await res.json();
    ALL_EVENTS = data.events || [];

    // Load nightlife venues
    const nightlifeRes = await fetch(
      `${API_BASE}/api/events/nightlife?city=${ACTIVE_FILTERS.city}`
    );
    const nightlifeData = await nightlifeRes.json();

    if (Array.isArray(nightlifeData.events)) {
      ALL_EVENTS = [...ALL_EVENTS, ...nightlifeData.events];
    }

    console.log("EVENT SAMPLE:", ALL_EVENTS[0]);

    if (ALL_EVENTS.length === 0) {
      list.innerHTML = "<p>No upcoming events found.</p>";
      return;
    }

    renderEvents();
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Error loading events.</p>";
  }
}

function renderEvents() {
  const list = document.getElementById("events-list");
  if (!list) return;

  let filtered = ALL_EVENTS;

  // ✅ 1. Filter by city FIRST
  if (ACTIVE_FILTERS.city !== "all") {
    filtered = filtered.filter(e => e.city === ACTIVE_FILTERS.city);
  }

  // ✅ 2. Separate nightlife from dated events
  const nightlifeEvents = filtered.filter(e => e.type === "nightlife");
  const datedEvents = filtered.filter(e => e.type !== "nightlife");

  // ✅ 3. Filter out past events (only for dated events)
  const now = new Date();
  const futureDatedEvents = datedEvents.filter(e => {
    const eventDate = new Date(`${e.date}T${e.time || "00:00"}`);
    return !isNaN(eventDate) && eventDate >= now;
  });

  // ✅ 4. Sort dated events by soonest first
  futureDatedEvents.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}`);
    const db = new Date(`${b.date}T${b.time || "00:00"}`);
    return da - db;
  });

  // ✅ 5. Combine: dated events first, then nightlife
  filtered = [...futureDatedEvents, ...nightlifeEvents];

  if (filtered.length === 0) {
    list.innerHTML = "<p>No events found.</p>";
    return;
  }

  list.innerHTML = filtered.map(e => {
    const isNightlife = e.type === "nightlife";
    
    // ✅ Only create date for non-nightlife events
    let d = null;
    let badge = "";
    let dateDisplay = "";
    let timeDisplay = e.time || "TBA";

    if (!isNightlife && e.date) {
      d = new Date(`${e.date}T${e.time || "00:00"}`);
      
      // Badge logic
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
    } else {
      // Nightlife venues - no date
      dateDisplay = "Open nightly";
      timeDisplay = e.hours || "Check venue for hours";
    }

    let imageUrl = "/FrontEnd/images/Fallback-events.jpg";
    if (Array.isArray(e.images) && e.images.length) {
      const img =
        e.images.find(i => i.ratio === "16_9" && i.width >= 640) ||
        e.images.find(i => i.ratio === "16_9") ||
        e.images[0];
      if (img?.url) imageUrl = img.url;
    }

    return `
      <article class="event-row">
        <div class="event-media">
          <img src="${imageUrl}" alt="${e.name}" loading="lazy">
        </div>

        <div class="event-content">
          <div class="event-title-row">
            <h3 class="event-title">
              ${e.name.replace(/ feat\. | - | vs | v /gi, "<br>")}
            </h3>
            ${badge}
          </div>

          <div class="event-location">${e.venue}</div>
          <div class="event-datetime">
            ${dateDisplay} • ${timeDisplay}
          </div>

          <a class="book-btn gold"
            href="#"
            data-event="${e.name}"
            data-venue="${e.venue}"
            data-date="${d ? d.toLocaleDateString("en-CA") : "TBA"}"
            data-time="${timeDisplay}">
            Book a Ride →
          </a>
        </div>

        ${d ? `
          <div class="event-date">
            <span class="day">${d.getDate()}</span>
            <span class="month">${d.toLocaleString("en", { month: "short" })}</span>
          </div>
        ` : ''}
      </article>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", loadEvents);

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

document.querySelectorAll(".city-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".city-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ACTIVE_FILTERS.city = btn.dataset.city;
    renderEvents();
  });
});