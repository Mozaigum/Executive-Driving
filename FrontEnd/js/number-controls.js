(() => {
  document.querySelectorAll('#booking-form input[name="passengers"], #booking-form input[name="luggage"]').forEach(input => {
    if (input.closest('.number-control')) return;
    input.setAttribute('inputmode', 'numeric');
    const wrapper = document.createElement('span');
    wrapper.className = 'number-control';
    input.before(wrapper);
    wrapper.append(input);
    const controls = document.createElement('span');
    controls.className = 'number-control-buttons';
    wrapper.append(controls);
    const buttons = [];
    [1, -1].forEach(direction => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${direction > 0 ? 'Increase' : 'Decrease'} ${input.name}`);
      button.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction > 0 ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'}"/></svg>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        if (input.disabled || input.readOnly) return;
        if (!input.value) input.value = input.min || '0';
        else if (direction > 0) input.stepUp();
        else input.stepDown();
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
      });
      buttons.push(button);
      controls.append(button);
    });
    const update = () => {
      const value = input.valueAsNumber;
      const unavailable = input.disabled || input.readOnly;
      buttons[0].disabled = unavailable || (input.value !== '' && input.max !== '' && value >= Number(input.max));
      buttons[1].disabled = unavailable || (input.value !== '' && input.min !== '' && value <= Number(input.min));
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.form?.addEventListener('reset', () => setTimeout(update, 0));
    update();
  });
})();
