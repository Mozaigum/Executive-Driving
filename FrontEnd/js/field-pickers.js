/* Native calendar and time popovers support touch, keyboard and manual entry. */
(() => {
  const icon = kind => kind === 'date'
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  document.querySelectorAll('#booking-form input[type="date"], #booking-form input[type="time"], #customEventPanel input[type="date"], #customEventPanel input[type="time"]').forEach(input => {
    if (input.closest('.field-picker')) return;
    const wrapper = document.createElement('span');
    wrapper.className = 'field-picker';
    input.before(wrapper);
    wrapper.append(input);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'field-picker-trigger';
    trigger.setAttribute('aria-label', input.type === 'date' ? 'Open calendar' : 'Choose time');
    trigger.innerHTML = icon(input.type);
    wrapper.append(trigger);
    const open = event => {
      if (typeof input.showPicker !== 'function') { input.focus(); return; }
      try { input.showPicker(); event.preventDefault(); }
      catch { input.focus(); } // Devices without showPicker retain their native input.
    };
    trigger.addEventListener('click', open);
    input.addEventListener('click', open);
  });
})();
