const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

import { estimateMonthlyCost } from '../lib/estimate.js';
import { formatDollars } from '../lib/format.js';

export function setupAccordion(root) {
  for (const accordion of root.querySelectorAll('[data-island="accordion"]')) {
    const buttons = [...accordion.querySelectorAll('.accordion__button')];
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        buttons.forEach((other, otherIndex) => {
          const panel = document.getElementById(other.getAttribute('aria-controls'));
          const open = !isOpen && otherIndex === index;
          other.setAttribute('aria-expanded', String(open));
          panel.hidden = !open;
          other.querySelector('.accordion__icon').textContent = open ? '−' : '+';
        });
      });
    });
  }
}

/**
 * Wires the pricing cards, billing toggle, and estimator.
 * @param {HTMLElement} root
 */
export function setupPricing(root) {
  const calculators = [...root.querySelectorAll('[data-island="pricing-calculator"]')];

  /**
   * Recomputes one estimator's output.
   * @param {HTMLElement} calculator
   */
  function updateCalculator(calculator) {
    const slider = calculator.querySelector('[data-volume-slider]');
    const volume = Number(slider.value);
    const reserved = calculator.dataset.reserved === 'true';
    const estimate = estimateMonthlyCost(volume, reserved);
    calculator.querySelector('[data-volume-value]').firstChild.textContent = String(volume);
    calculator.querySelector('[data-estimate="developer"]').textContent = formatDollars(
      estimate.developer,
    );
    calculator.querySelector('[data-estimate="scale"]').textContent = formatDollars(estimate.scale);
    calculator.querySelector('[data-estimate="recommendation"]').textContent =
      estimate.recommendation;
    calculator.querySelector('[data-assumption]').textContent = `${
      reserved ? 'Reserved rates applied.' : 'On-demand rates applied.'
    } Input and output are metered separately; the estimator uses a 70/30 mix.`;
  }

  for (const calculator of calculators) {
    calculator.__update = () => updateCalculator(calculator);
    calculator
      .querySelector('[data-volume-slider]')
      .addEventListener('input', () => updateCalculator(calculator));
    updateCalculator(calculator);
  }

  /**
   * Applies the billing period to the plan cards and every estimator.
   * @param {boolean} reserved
   */
  function applyReserved(reserved) {
    const multiplier = reserved ? 0.8 : 1;
    for (const card of root.querySelectorAll('[data-plan]')) {
      const rates = card.querySelector('[data-plan-rates]');
      const price = card.querySelector('[data-plan-price]');
      const note = card.querySelector('[data-plan-note]');
      const platform = rates.dataset.platform === '' ? null : Number(rates.dataset.platform);
      const input = rates.dataset.input === '' ? null : Number(rates.dataset.input);
      const output = rates.dataset.output === '' ? null : Number(rates.dataset.output);
      if (platform !== null) price.textContent = formatDollars(platform * multiplier);
      if (input !== null) {
        rates.querySelector('[data-rate="input"]').textContent = `$${(input * multiplier).toFixed(
          2,
        )} / 1M input`;
        rates.querySelector('[data-rate="output"]').textContent = `$${(output * multiplier).toFixed(
          2,
        )} / 1M output`;
      }
      note.hidden = !reserved || card.dataset.plan === 'dedicated';
    }
    for (const toggle of root.querySelectorAll('[data-reserved-option]')) {
      toggle.setAttribute(
        'aria-pressed',
        String(toggle.dataset.reservedOption === String(reserved)),
      );
    }
    for (const calculator of calculators) {
      calculator.dataset.reserved = String(reserved);
      calculator.__update();
    }
  }

  for (const toggle of root.querySelectorAll('[data-reserved-option]')) {
    toggle.addEventListener('click', () => applyReserved(toggle.dataset.reservedOption === 'true'));
  }
}

/**
 * Wires the orbital altitude calculator.
 * @param {HTMLElement} root
 */
export function setupOrbitCalculator(root) {
  for (const calculator of root.querySelectorAll('[data-island="orbit-calculator"]')) {
    const slider = calculator.querySelector('[data-altitude-slider]');
    slider.addEventListener('input', () => {
      const altitude = Number(slider.value);
      const radius = 6371 + altitude;
      const period = (2 * Math.PI * Math.sqrt(radius ** 3 / 398600.4418)) / 60;
      calculator.querySelector('[data-altitude-label]').textContent = String(altitude);
      calculator.querySelector('[data-orbit-period]').textContent = `${period.toFixed(1)} min`;
      calculator.querySelector('[data-orbit-trip]').textContent = `${(
        (2 * altitude) / 299.792
      ).toFixed(2)} ms`;
      calculator.querySelector('[data-orbit-class]').textContent = altitude < 2000 ? 'LEO' : 'MEO';
    });
  }
}

/**
 * Wires the validated contact form.
 * @param {HTMLElement} root
 */
export function setupContactForm(root) {
  for (const form of root.querySelectorAll('[data-island="contact-form"]')) {
    const fields = {
      name: form.querySelector('[name="name"]'),
      email: form.querySelector('[name="email"]'),
      company: form.querySelector('[name="company"]'),
      topic: form.querySelector('[name="topic"]'),
      message: form.querySelector('[name="message"]'),
    };
    const status = form.querySelector('[data-form-status]');

    /**
     * Shows or clears one field error.
     * @param {string} name
     * @param {string} message
     */
    function setError(name, message) {
      const error = form.querySelector(`[data-error="${name}"]`);
      error.textContent = message;
      error.hidden = !message;
      fields[name].setAttribute('aria-invalid', String(Boolean(message)));
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const errors = {};
      if (!fields.name.value.trim()) errors.name = 'Enter your name.';
      if (!EMAIL_PATTERN.test(fields.email.value.trim())) {
        errors.email = 'Enter a valid email address.';
      }
      if (!fields.message.value.trim()) errors.message = 'Tell us what you need.';
      if (fields.message.value.length > 2000) {
        errors.message = 'Keep the message under 2,000 characters.';
      }
      for (const name of ['name', 'email', 'message']) setError(name, errors[name] ?? '');
      if (Object.keys(errors).length > 0) {
        fields[Object.keys(errors)[0]].focus();
        return;
      }

      const recipients = {
        Capacity: 'capacity@aethercompute.space',
        Partnership: 'capacity@aethercompute.space',
        Press: 'press@aethercompute.space',
        Careers: 'careers@aethercompute.space',
      };
      const recipient = recipients[fields.topic.value] ?? recipients.Capacity;
      const subject = `[${fields.topic.value}] Inquiry from ${fields.name.value.trim()}`;
      const body = [
        `Name: ${fields.name.value.trim()}`,
        `Email: ${fields.email.value.trim()}`,
        `Company: ${fields.company.value.trim() || 'Not provided'}`,
        `Topic: ${fields.topic.value}`,
        '',
        fields.message.value.trim(),
      ].join('\n');
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      status.textContent =
        'Your mail client should open with the message ready to send. If it does not, email hello@aethercompute.space.';
    });
  }
}

/**
 * Wires the generic search and category filter used by catalog indexes.
 * @param {HTMLElement} root
 */
export function setupFilters(root) {
  for (const input of root.querySelectorAll('[data-filter-input]')) {
    const scope = input.closest('.docs-index__controls') ?? input.parentElement;
    const list = root.querySelector('[data-filter-list]');
    if (!list) continue;
    const items = [...list.querySelectorAll('[data-filter-item]')];
    const count = root.querySelector('[data-filter-count]');
    const empty = root.querySelector('[data-filter-empty]');
    const groupButtons = [...(scope?.querySelectorAll('[data-filter-group-option]') ?? [])];
    let group = 'All';
    const initialCount = count?.textContent ?? '';
    const noun = initialCount.replace(/^\d+\s*/, '') || 'items';

    /**
     * Applies the current query and group to the item list.
     */
    function apply() {
      const needle = input.value.trim().toLowerCase();
      let visible = 0;
      for (const item of items) {
        const matchesGroup = group === 'All' || item.dataset.filterGroup === group;
        const matchesText = !needle || item.dataset.filterText.toLowerCase().includes(needle);
        const show = matchesGroup && matchesText;
        item.hidden = !show;
        if (show) visible += 1;
      }
      if (count) count.textContent = `${visible} ${noun}`;
      if (empty) empty.hidden = visible > 0;
    }

    input.addEventListener('input', apply);
    for (const button of groupButtons) {
      button.addEventListener('click', () => {
        group = button.dataset.filterGroupOption;
        for (const other of groupButtons) {
          other.setAttribute('aria-pressed', String(other === button));
        }
        apply();
      });
    }
  }

  for (const input of root.querySelectorAll('[data-island="docs-search"]')) {
    input.addEventListener('input', () => {
      const needle = input.value.trim().toLowerCase();
      for (const link of root.querySelectorAll('.docs-nav a')) {
        const item = link.closest('li');
        item.hidden = Boolean(needle) && !link.textContent.toLowerCase().includes(needle);
      }
    });
  }
}

/**
 * Wires the copy buttons on code samples.
 * @param {HTMLElement} root
 */
export function setupCode(root) {
  for (const figure of root.querySelectorAll('[data-island="code"]')) {
    const button = figure.querySelector('[data-code-copy]');
    button.addEventListener('click', async () => {
      const code = figure.querySelector('code').textContent;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1600);
      } catch {
        button.textContent = 'Unavailable';
      }
    });
  }
}

/**
 * Wires the demo lab gate.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
