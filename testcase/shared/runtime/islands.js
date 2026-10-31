import { routes } from '../routes.js';
import { DEMO_UNLOCK_CODE } from './hidden.js';
import { setupApi } from './islands-api.js';
import {
  setupAccordion,
  setupCode,
  setupContactForm,
  setupFilters,
  setupOrbitCalculator,
  setupPricing,
} from './islands-content.js';
import { setupLab } from './islands-lab.js';
import { buildPaletteItems } from './palette.js';

let activePalette = null;
let activeMenuClose = null;
let keyboardBound = false;

/**
 * Binds the document-level shortcuts once, targeting the palette and menu from the latest render.
 */
function bindKeyboard() {
  if (keyboardBound) return;
  keyboardBound = true;
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      activePalette?.open();
    } else if (event.key === 'Escape') {
      activePalette?.close();
      activeMenuClose?.();
    }
  });
}

/**
 * Sets up the command palette dialog and returns its open and close controls.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @returns {{ open: () => void, close: () => void }}
 */
function setupPalette(root, ctx) {
  const backdrop = root.querySelector('[data-palette]');
  if (!backdrop) return { open() {}, close() {} };

  const input = backdrop.querySelector('[data-palette-input]');
  const list = backdrop.querySelector('[data-palette-list]');
  const count = backdrop.querySelector('[data-palette-count]');
  const empty = backdrop.querySelector('[data-palette-empty]');
  const items = buildPaletteItems(routes, {
    hiddenUnlocked: ctx.state.hiddenUnlocked,
    showHidden: ctx.state.preferences.flags.showHidden,
  });
  let filtered = [];
  let selected = 0;

  /**
   * Renders the current result list.
   * @param {string} query
   */
  function renderList(query) {
    const needle = query.trim().toLowerCase();
    filtered = (
      needle
        ? items.filter((item) =>
            `${item.title} ${item.path} ${item.group}`.toLowerCase().includes(needle),
          )
        : items
    ).slice(0, 24);
    selected = 0;
    list.replaceChildren(
      ...filtered.map((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `palette__item${index === 0 ? ' palette__item--active' : ''}`;
        button.tabIndex = -1;
        button.innerHTML = `<span class="palette__item-title">${item.title}</span><span class="palette__item-path">${item.path}</span>${
          item.hidden ? '<span class="palette__item-hidden">hidden</span>' : ''
        }`;
        button.addEventListener('click', () => {
          ctx.navigate(item.path);
          close();
        });
        button.addEventListener('mouseenter', () => {
          selected = index;
          highlight();
        });
        return button;
      }),
    );
    count.textContent = `${filtered.length} of ${items.length} routes`;
    empty.hidden = filtered.length > 0;
    empty.textContent = needle
      ? `No route matches “${query}”. Try a group name, a satellite, or “lab”.`
      : 'No route is available.';
  }

  /**
   * Moves the active result highlight.
   */
  function highlight() {
    const buttons = [...list.querySelectorAll('.palette__item')];
    buttons.forEach((button, index) => {
      button.classList.toggle('palette__item--active', index === selected);
      button.setAttribute('aria-current', index === selected ? 'true' : 'false');
    });
    buttons[selected]?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Opens the dialog and focuses the search input.
   */
  function open() {
    backdrop.hidden = false;
    document.body.classList.add('palette-open');
    input.value = '';
    renderList('');
    input.focus();
  }

  /**
   * Closes the dialog and restores page interaction.
   */
  function close() {
    backdrop.hidden = true;
    document.body.classList.remove('palette-open');
  }

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = Math.min(selected + 1, Math.max(filtered.length - 1, 0));
      highlight();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[selected]) {
        ctx.navigate(filtered[selected].path);
        close();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  backdrop.querySelector('[data-palette-close]').addEventListener('click', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });

  for (const action of backdrop.querySelectorAll('[data-palette-action]')) {
    action.addEventListener('click', () => {
      const kind = action.dataset.paletteAction;
      if (kind === 'telemetry') {
        const next = {
          ...ctx.state.preferences,
          flags: {
            ...ctx.state.preferences.flags,
            telemetry: !ctx.state.preferences.flags.telemetry,
          },
        };
        ctx.setPreferences(next);
        reopen();
      } else if (kind === 'variant') {
        const next = {
          ...ctx.state.preferences,
          variant: ctx.state.preferences.variant === 'a' ? 'b' : 'a',
        };
        ctx.setPreferences(next);
        reopen();
      } else if (kind === 'hidden') {
        const next = {
          ...ctx.state.preferences,
          flags: {
            ...ctx.state.preferences.flags,
            showHidden: !ctx.state.preferences.flags.showHidden,
          },
        };
        ctx.setPreferences(next);
        reopen();
      } else if (kind === 'lock') {
        close();
        ctx.setHidden(false);
      }
    });
  }

  /**
   * Reopens the palette after a preference re-render replaces the DOM.
   */
  function reopen() {
    document.querySelector('[data-palette-open]')?.click();
  }

  const telemetry = ctx.state.preferences.flags.telemetry;
  const variant = ctx.state.preferences.variant;
  const showHidden = ctx.state.preferences.flags.showHidden;
  backdrop.querySelector('[data-palette-action="telemetry"]').textContent = `Telemetry ${
    telemetry ? 'on' : 'off'
  }`;
  backdrop
    .querySelector('[data-palette-action="telemetry"]')
    .setAttribute('aria-pressed', String(telemetry));
  backdrop.querySelector('[data-palette-action="variant"]').textContent =
    `Variant ${variant.toUpperCase()}`;
  backdrop
    .querySelector('[data-palette-action="variant"]')
    .setAttribute('aria-pressed', String(variant === 'b'));
  const hiddenButton = backdrop.querySelector('[data-palette-action="hidden"]');
  const lockButton = backdrop.querySelector('[data-palette-action="lock"]');
  hiddenButton.hidden = !ctx.state.hiddenUnlocked;
  lockButton.hidden = !ctx.state.hiddenUnlocked;
  hiddenButton.textContent = `Hidden ${showHidden ? 'on' : 'off'}`;
  hiddenButton.setAttribute('aria-pressed', String(showHidden));

  renderList('');
  activePalette = { open, close };
  return { open, close };
}

/**
 * Wires the mobile menu and palette trigger in the header.
 * @param {HTMLElement} root
 * @param {{ open: () => void }} palette
 */
function setupHeader(root, palette) {
  const header = root.querySelector('[data-island="header"]');
  if (!header) return;

  const toggle = header.querySelector('[data-menu-toggle]');
  const menu = header.querySelector('[data-mobile-menu]');

  /**
   * Opens or closes the mobile navigation.
   * @param {boolean} open
   */
  function setMenu(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  toggle.addEventListener('click', () => setMenu(menu.hidden));
  for (const link of header.querySelectorAll('[data-menu-link]')) {
    link.addEventListener('click', () => setMenu(false));
  }
  activeMenuClose = () => setMenu(false);
  bindKeyboard();

  header.querySelector('[data-palette-open]')?.addEventListener('click', () => {
    setMenu(false);
    palette.open();
  });
}

/**
 * Wires the single-open accordion.
 * @param {HTMLElement} root
 */
function setupLabGate(root, ctx) {
  for (const gate of root.querySelectorAll('[data-island="lab-gate"]')) {
    const form = gate.querySelector('form');
    const input = gate.querySelector('[data-gate-input]');
    const error = gate.querySelector('[data-gate-error]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.value.trim().toUpperCase() !== DEMO_UNLOCK_CODE) {
        error.textContent = 'That code does not match the demo gate.';
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      error.hidden = true;
      input.setAttribute('aria-invalid', 'false');
      ctx.setHidden(true);
    });
  }
}

/**
 * Wires the lab lock, visibility, and demo controls.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
/**
 * Mounts every interactive island in a rendered document.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export function mountIslands(root, ctx) {
  const palette = setupPalette(root, ctx);
  setupHeader(root, palette);
  setupAccordion(root);
  setupPricing(root);
  setupOrbitCalculator(root);
  setupContactForm(root);
  setupFilters(root);
  setupCode(root);
  setupLabGate(root, ctx);
  setupLab(root, ctx);
  setupApi(root, ctx);
}
