/* Each Google list lives beside its input so scrolling cannot detach it. */
(() => {
  const initialized = new WeakSet();
  const claimedLists = new WeakSet();
  const selectors = ['#pickup', '#dropoff', '#customEventPanel input[name="venue"]', '#returnPickup', '#returnDropoff'];
  const formatPlace = place => {
    const name = place.name || '', address = place.formatted_address || '';
    return name && address && !address.startsWith(name) ? name + ', ' + address : address || name;
  };
  function attach(input) {
    if (!input || initialized.has(input)) return;
    const existing = new Set(document.querySelectorAll('.pac-container'));
    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'ca' },
      fields: ['name', 'formatted_address', 'place_id']
    });
    initialized.add(input);
    input.setAttribute('autocomplete', 'off');
    const anchor = document.createElement('span');
    anchor.className = 'place-input-anchor';
    input.before(anchor);
    anchor.append(input);
    let container = [...document.querySelectorAll('.pac-container')].find(node => !existing.has(node) && !claimedLists.has(node));
    const attachList = () => {
      if (!container) {
        const controlled = document.getElementById(input.getAttribute('aria-controls') || input.getAttribute('aria-owns') || '');
        if (controlled?.classList.contains('pac-container') && !claimedLists.has(controlled)) container = controlled;
        if (!container) container = [...document.querySelectorAll('.pac-container')].find(node => !existing.has(node) && !claimedLists.has(node));
      }
      if (!container) return false;
      claimedLists.add(container);
      // Relative CSS coordinates always win over Google's document-position styles.
      if (container.parentElement !== anchor) anchor.append(container);
      return true;
    };
    if (!attachList()) {
      const observer = new MutationObserver(() => { if (attachList()) observer.disconnect(); });
      observer.observe(document.body, { childList: true });
    }
    input.addEventListener('focus', attachList);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && container && getComputedStyle(container).display !== 'none' && container.querySelector('.pac-item')) event.preventDefault();
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.place_id) return;
      input.value = formatPlace(place);
      input.dataset.placeId = place.place_id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    input.addEventListener('input', () => delete input.dataset.placeId);
  }
  function init() {
    if (!window.google?.maps?.places?.Autocomplete) return;
    selectors.forEach(selector => document.querySelectorAll(selector).forEach(input => {
      try { attach(input); }
      catch (error) { console.warn('Place suggestions unavailable for this field.', error); }
    }));
  }
  window.__xdInitAutocomplete = init;
  init();
})();
