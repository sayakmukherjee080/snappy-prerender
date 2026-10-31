export function setupLab(root, ctx) {
  for (const button of root.querySelectorAll('[data-lab-lock]')) {
    button.addEventListener('click', () => ctx.setHidden(false));
  }

  for (const button of root.querySelectorAll('[data-lab-visibility]')) {
    button.addEventListener('click', () => {
      const next = {
        ...ctx.state.preferences,
        flags: {
          ...ctx.state.preferences.flags,
          showHidden: !ctx.state.preferences.flags.showHidden,
        },
      };
      ctx.setPreferences(next);
    });
  }

  for (const demo of root.querySelectorAll('[data-island="lab-demo"]')) {
    setupDemo(demo, ctx);
  }
}

/**
 * Implements a framework-native demo for one lab route.
 * @param {HTMLElement} demo
 * @param {object} ctx
 */
function setupDemo(demo, ctx) {
  const slug = demo.dataset.demo;
  const stage = demo.querySelector('[data-demo-stage]');
  const mount = demo.querySelector('[data-demo-mount]');
  const output = demo.querySelector('[data-demo-output]');
  const action = demo.querySelector('[data-demo-action]');
  let count = 0;

  if (slug === 'canvas-orbit') {
    mount.innerHTML = '<canvas width="480" height="220" class="lab-canvas"></canvas>';
    const canvas = mount.querySelector('canvas');
    const context = canvas.getContext('2d');
    let frame = 0;
    let running = true;
    const draw = () => {
      if (!running) return;
      if (!canvas.isConnected) {
        running = false;
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#101417';
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < 24; index += 1) {
        const angle = (index / 24) * Math.PI * 2 + frame * 0.01;
        const radius = 50 + (index % 6) * 24;
        context.beginPath();
        context.arc(
          canvas.width / 2 + Math.cos(angle) * radius,
          canvas.height / 2 + Math.sin(angle) * radius * 0.55,
          3,
          0,
          Math.PI * 2,
        );
        context.fillStyle = '#ee5a24';
        context.fill();
      }
      frame += 1;
      requestAnimationFrame(draw);
    };
    draw();
    output.textContent = 'Animation running. Reduce motion to pause.';
    action.textContent = 'Pause';
    action.addEventListener('click', () => {
      running = !running;
      action.textContent = running ? 'Pause' : 'Resume';
      if (running) draw();
    });
    return;
  }

  if (slug === 'imperative-dialog') {
    action.addEventListener('click', () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'lab-dialog';
      dialog.innerHTML =
        '<h2>Ground segment notice</h2><p>This dialog is opened imperatively and closes on Escape.</p><button type="button" class="button button--orange">Close</button>';
      document.body.appendChild(dialog);
      dialog.showModal();
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
    });
    output.textContent = 'Open a native dialog element.';
    return;
  }

  if (slug === 'transition-nav') {
    action.addEventListener('click', () => ctx.navigate('/network'));
    output.textContent = 'Navigate with the native router.';
    return;
  }

  if (slug === 'insertion-theme') {
    action.addEventListener('click', () => {
      stage.classList.toggle('lab-theme-dark');
      output.textContent = stage.classList.contains('lab-theme-dark')
        ? 'Flight theme applied.'
        : 'Paper theme applied.';
    });
    output.textContent = 'Toggle the demo theme.';
    return;
  }

  if (slug === 'deferred-search') {
    mount.innerHTML =
      '<input class="lab-input" type="search" placeholder="Filter nodes…" /><ul class="lab-list"></ul>';
    const input = mount.querySelector('input');
    const list = mount.querySelector('ul');
    const nodes = Array.from(
      { length: 60 },
      (_, index) => `AETHER-${String(index + 1).padStart(2, '0')}`,
    );
    const paint = () => {
      const needle = input.value.trim().toLowerCase();
      list.innerHTML = nodes
        .filter((node) => node.toLowerCase().includes(needle))
        .slice(0, 12)
        .map((node) => `<li>${node}</li>`)
        .join('');
    };
    input.addEventListener('input', paint);
    paint();
    output.textContent = 'Filter 60 nodes.';
    return;
  }

  if (slug === 'activity-tabs' || slug === 'id-tabs') {
    mount.innerHTML =
      '<div class="lab-tabs" role="tablist"><button type="button" role="tab" aria-selected="true">Telemetry</button><button type="button" role="tab" aria-selected="false">Log</button></div><div class="lab-tab-panel"><p>Telemetry panel: 0 updates.</p></div>';
    const tabs = [...mount.querySelectorAll('[role="tab"]')];
    const panel = mount.querySelector('.lab-tab-panel p');
    const counts = [0, 0];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        counts[index] += 1;
        tabs.forEach((other, otherIndex) => {
          other.setAttribute('aria-selected', String(otherIndex === index));
        });
        panel.textContent = `${index === 0 ? 'Telemetry' : 'Log'} panel: ${counts[index]} updates.`;
      });
    });
    output.textContent = 'Switch tabs; each keeps its own state.';
    return;
  }

  if (slug === 'optimistic-queue') {
    mount.innerHTML = '<ul class="lab-list"></ul>';
    const list = mount.querySelector('ul');
    action.addEventListener('click', () => {
      count += 1;
      const item = document.createElement('li');
      item.textContent = `Request ${count} queued optimistically`;
      list.prepend(item);
      output.textContent = `${count} queued.`;
    });
    output.textContent = 'Queue a request.';
    return;
  }

  if (slug === 'virtual-list') {
    action.addEventListener('click', () => {
      const started = performance.now();
      mount.innerHTML = `<div class="lab-list">${Array.from(
        { length: 200 },
        (_, index) => `<div>AETHER-${String(index + 1).padStart(3, '0')} · nominal</div>`,
      ).join('')}</div>`;
      output.textContent = `Rendered 200 rows in ${(performance.now() - started).toFixed(1)} ms.`;
    });
    output.textContent = 'Render a windowed telemetry list.';
    return;
  }

  if (slug === 'suspense-resource') {
    action.addEventListener('click', () => {
      output.textContent = 'Loading…';
      setTimeout(() => {
        if (output.isConnected) output.textContent = 'Resource resolved: 24 nodes, p50 18 ms.';
      }, 900);
    });
    output.textContent = 'Load a delayed resource.';
    return;
  }

  if (slug === 'error-boundaries') {
    action.addEventListener('click', () => {
      try {
        throw new Error('Deliberate demo fault');
      } catch (error) {
        output.textContent = `Boundary caught: ${error.message}. The page is still interactive.`;
      }
    });
    output.textContent = 'Inject a fault.';
    return;
  }

  if (slug === 'sync-store') {
    action.addEventListener('click', () => {
      count = Number(window.localStorage.getItem('aether.lab.sync') ?? '0') + 1;
      window.localStorage.setItem('aether.lab.sync', String(count));
      output.textContent = `Synced counter: ${count}. Reload to keep it.`;
    });
    output.textContent = 'Increment a persisted counter.';
    return;
  }

  if (slug === 'layout-tooltip') {
    mount.innerHTML =
      '<button type="button" class="button button--ghost lab-tooltip-trigger">Hover the node</button><span class="lab-tooltip" role="tooltip">Optical crosslink · 9.7 Gbps</span>';
    const trigger = mount.querySelector('.lab-tooltip-trigger');
    const tooltip = mount.querySelector('.lab-tooltip');
    trigger.addEventListener('mouseenter', () => {
      tooltip.hidden = false;
    });
    trigger.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });
    tooltip.hidden = true;
    output.textContent = 'Hover the button.';
    return;
  }

  if (slug === 'command-palette') {
    action.addEventListener('click', () => document.querySelector('[data-palette-open]')?.click());
    output.textContent = 'Open the route palette.';
    return;
  }

  if (slug === 'head-parity' || slug === 'default-title' || slug === 'noindex-fixture') {
    action.addEventListener('click', () => {
      output.textContent = `Title: ${document.title} · Robots: ${
        document.head.querySelector('meta[name="robots"]')?.content ?? 'unset'
      }`;
    });
    output.textContent = 'Read the live document head.';
    return;
  }

  if (slug === 'worker-sim') {
    action.addEventListener('click', () => {
      let progress = 0;
      output.textContent = 'Simulating… 0%';
      const timer = setInterval(() => {
        if (!output.isConnected) {
          clearInterval(timer);
          return;
        }
        progress += 10;
        output.textContent = `Simulating… ${progress}%`;
        if (progress >= 100) {
          clearInterval(timer);
          output.textContent = 'Simulation complete: 24 routes evaluated.';
        }
      }, 80);
    });
    output.textContent = 'Run the route simulation.';
    return;
  }

  if (slug === 'drag-planner') {
    mount.innerHTML =
      '<div class="lab-drag"><div class="lab-drag__handle" draggable="true">Drag capacity</div><div class="lab-drag__lane"></div></div>';
    const handle = mount.querySelector('.lab-drag__handle');
    const lane = mount.querySelector('.lab-drag__lane');
    handle.addEventListener('dragend', (event) => {
      lane.textContent = `Dropped at ${Math.round(event.offsetX)} px`;
    });
    output.textContent = 'Drag the handle into the lane.';
    return;
  }

  if (slug === 'view-transitions') {
    action.addEventListener('click', () => {
      stage.classList.toggle('lab-theme-dark');
      output.textContent = 'State changed with a CSS transition.';
    });
    output.textContent = 'Toggle a view transition.';
    return;
  }

  action.addEventListener('click', () => {
    count += 1;
    output.textContent = `Demo step ${count}.`;
  });
  output.textContent = 'Run the demo.';
}

/**
 * Wires API retry and image fallbacks.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
