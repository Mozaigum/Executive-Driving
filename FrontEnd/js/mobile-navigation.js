(() => {
  if (document.querySelector('.mobile-bottom-nav')) return;
  const items = [
    ['index.html', 'Home', '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>'],
    ['events.html', 'Events', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>'],
    ['fleet.html', 'Fleet', '<path d="m5 7-2 7v5h3v-3h12v3h3v-5l-2-7Zm-1 6h16M7 16h.01M17 16h.01"/>'],
    ['booking.html', 'Quote', '<path d="M8 4H5v17h14V4h-3M8 3h8v4H8Zm0 9h8m-8 4h5"/>'],
    ['index.html#contact', 'Contact', '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z"/>']
  ];
  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', 'Quick navigation');
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page !== 'team.html' && matchMedia('(max-width: 960px)').matches) {
    const prefetch = document.createElement('link');
    prefetch.rel = 'prefetch'; prefetch.href = 'team.html'; prefetch.as = 'document';
    document.head.append(prefetch);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('.menu-toggle, .rr-burger-btn');
    if (!button || !matchMedia('(max-width: 960px)').matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (page === 'team.html') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    try { sessionStorage.setItem('xd-about-transition', '1'); } catch (_) {}
    document.documentElement.classList.add('about-route');
    location.assign('team.html');
  }, true);
  window.addEventListener('pageshow', event => { if (event.persisted) document.documentElement.classList.remove('about-route'); });
  const labelAbout = () => document.querySelectorAll('.menu-toggle, .rr-burger-btn').forEach(button => {
    button.setAttribute('aria-label', 'About Executive Driving');
    button.removeAttribute('aria-controls');
    button.removeAttribute('aria-expanded');
  });
  window.addEventListener('load', labelAbout);
  nav.innerHTML = items.map(([href, label, icon]) => `<a href="${href}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span></a>`).join('');
  const updateCurrent = () => {
    nav.querySelectorAll('a').forEach((link, index) => {
      const active = location.hash === '#contact' && page === 'index.html' ? index === 4 : !items[index][0].includes('#') && items[index][0] === (page === 'thank-you.html' ? 'booking.html' : page);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  };
  updateCurrent();
  window.addEventListener('hashchange', updateCurrent);
  document.body.appendChild(nav);
})();
