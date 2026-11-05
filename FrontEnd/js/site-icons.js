(() => {
  const paths = {
    'ri-phone-line': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
    'ri-mail-line': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
    'ri-time-line': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'ri-calendar-line': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    'ri-calendar-check-line': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-11 5 2 2 4-4"/>',
    'ri-map-pin-line': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    'ri-flight-takeoff-line': '<path d="M3 20h18M3 13l3 3 14-6c2-1 1-3-1-2l-5 2-6-6-2 1 4 7-4 1-2-2Z"/>',
    'ri-file-check-line': '<path d="M14 2H5v20h14V7Zm0 0v5h5m-11 8 3 3 5-6"/>',
    'ri-file-text-line': '<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h8"/>',
    'ri-shield-check-line': '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6"/>',
    'ri-lock-2-line': '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    'ri-roadster-line': '<path d="m5 7-2 7v6h3v-3h12v3h3v-6l-2-7Zm-1 6h16M7 16h.01M17 16h.01"/>',
    'ri-group-line': '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 5"/>',
    'ri-wifi-line': '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01"/>',
    'ri-battery-charge-line': '<path d="M7 6H3v12h4m10-12h3v12h-5m7-9v6M13 3l-5 9h6l-3 9"/>',
    'ri-goblet-line': '<path d="M4 3h16l-8 9Zm8 9v9m-5 0h10M7 7h10"/>',
    'ri-temp-cold-line': '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Zm3-8v11"/>',
    'ri-user-star-line': '<circle cx="9" cy="6" r="4"/><path d="M2 22v-3a7 7 0 0 1 10-6m5 0 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5Z"/>',
    'ri-24-hours-line': '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/><path d="M9 10h3v3H9v3h3m3-6v3h3m0-3v6"/>',
    'ri-suitcase-line': '<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 7V3h8v4M7 7v14M17 7v14"/>',
    'ri-layout-row-line': '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18"/>',
    'ri-vip-crown-line': '<path d="m3 5 4 5 5-7 5 7 4-5-2 14H5Zm2 17h14"/>',
    'ri-information-line': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    'ri-search-2-line': '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    'ri-quill-pen-line': '<path d="m3 21 6-6m-3 3c-3-8 4-15 15-15 0 11-7 18-15 15Zm4-4 5-5"/>',
    'ri-share-line': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/>',
    'ri-arrow-down-s-line': '<path d="m6 9 6 6 6-6"/>',
    'ri-arrow-left-s-line': '<path d="m15 6-6 6 6 6"/>',
    'ri-arrow-right-s-line': '<path d="m9 6 6 6-6 6"/>',
    'ri-arrow-right-line': '<path d="M3 12h18m-7-7 7 7-7 7"/>',
    'ri-close-line': '<path d="m6 6 12 12M6 18 18 6"/>',
    'fa-facebook-f': '<path d="M14 22v-9h3l.5-4H14V7c0-1.5.5-2 2-2h2V1h-3c-4 0-6 2-6 6v2H6v4h3v9Z"/>',
    'fa-instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>'
  };
  paths['fa-clock'] = paths['ri-time-line'];
  paths['ri-google-line'] = '<path d="M20 7a9 9 0 1 0 1 5h-9m9 0v5"/>';
  function render(root) {
    const nodes = root.matches?.('i') ? [root] : root.querySelectorAll?.('i') || [];
    nodes.forEach(node => {
      if (node.classList.contains('site-svg-icon')) return;
      const name = Array.from(node.classList).find(value => paths[value]);
      if (!name) return;
      node.classList.add('site-svg-icon');
      node.setAttribute('aria-hidden', 'true');
      node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[name]}</svg>`;
    });
  }
  render(document);
  document.querySelectorAll('.stars, .review-card__stars').forEach(node => {
    if (!node.textContent.includes('★')) return;
    node.setAttribute('aria-label', '5 out of 5 stars');
    node.innerHTML = Array.from({ length: 5 }, () => '<svg class="review-star-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3 6.5 7 1-5 5 .9 7-5.9-3.3L6.1 21l.9-6.5-5-5 7-1Z"/></svg>').join('');
  });
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) render(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();
