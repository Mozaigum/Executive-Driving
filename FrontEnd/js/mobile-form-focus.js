/* Keep mobile page entry quiet; allow normal focus after the user's first action. */
(() => {
  if (!window.matchMedia('(any-pointer: coarse)').matches) return;
  let interacted = false;
  const editable = element => element instanceof Element && element.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]');
  const release = event => { if (event.isTrusted) interacted = true; };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => document.addEventListener(type, release, {capture:true,passive:true}));
  document.addEventListener('focusin', event => {
    if (!interacted && editable(event.target)) event.target.blur();
  }, true);
  const clearRestoredFocus = () => {
    if (!interacted && editable(document.activeElement)) document.activeElement.blur();
  };
  window.addEventListener('pagehide', () => { interacted = false; });
  window.addEventListener('pageshow', () => {
    clearRestoredFocus();
    requestAnimationFrame(clearRestoredFocus);
  });
  document.addEventListener('DOMContentLoaded', clearRestoredFocus, {once:true});
})();
