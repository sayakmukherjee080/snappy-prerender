/**
 * Syncs live form control state into markup attributes. React writes checked and
 * selected as DOM properties, which do not survive serialisation, so a prerendered
 * checkbox or select would come back in its default state until the bundle hydrates.
 * The result matches what React's own server rendering emits for controlled inputs.
 */
export async function captureFormState(page) {
  await page.evaluate(() => {
    // Writes or clears an attribute so the serialised markup matches the live DOM.
    const syncAttribute = (element, attribute, enabled) => {
      if (enabled) element.setAttribute(attribute, '');
      else element.removeAttribute(attribute);
    };

    const choices = document.querySelectorAll('input[type="radio" i], input[type="checkbox" i]');
    for (const control of choices) {
      syncAttribute(control, 'checked', control.checked);
    }
    for (const option of document.querySelectorAll('option')) {
      syncAttribute(option, 'selected', option.selected);
    }
  });
}
