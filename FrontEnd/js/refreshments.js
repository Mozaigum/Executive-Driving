(() => {
  const setups = [
    ['alcoholService', 'liquorServiceEnquiry', 'serviceRefreshmentPreferences'],
    ['nonAlcoholicService', 'refreshmentFields', 'refreshmentPreferences']
  ];
  setups.forEach(([toggleId, panelId, inputId]) => {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);
    const input = document.getElementById(inputId);
    if (!toggle || !panel || !input) return;
    const form = input.form;
    const validate = () => {
      input.setCustomValidity(toggle.checked && !input.value.trim() ? (toggleId === 'alcoholService' ? 'Tell us your liquor preferences.' : 'Tell us which non-alcoholic drinks you would like.') : '');
    };
    const update = () => {
      panel.hidden = !toggle.checked;
      panel.disabled = !toggle.checked;
      toggle.setAttribute('aria-expanded', String(toggle.checked));
      validate();
    };
    input.addEventListener('input', validate);
    toggle.addEventListener('change', update);
    form.addEventListener('submit', event => {
      validate();
      if (toggle.checked && !input.reportValidity()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    form.addEventListener('reset', () => setTimeout(update, 0));
    update();
  });
})();
