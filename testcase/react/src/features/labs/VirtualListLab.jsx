import { memo, useDeferredValue, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LabShell } from './LabShell.jsx';

const ROW_HEIGHT = 34;
const OVERSCAN = 6;
const VIEWPORT_HEIGHT = 420;
const ROWS = Array.from({ length: 10_000 }, (_, index) => ({
  id: index,
  node: `AETHER-${String((index % 24) + 1).padStart(2, '0')}`,
  latency: 14 + (index % 31),
  handoffs: index % 5,
}));

/**
 * Renders one memoized virtual row.
 * @param {{ row: { id: number, node: string, latency: number, handoffs: number }, top: number }} props
 */
const VirtualRow = memo(function VirtualRow({ row, top }) {
  return (
    <div className="virtual-row" style={{ transform: `translateY(${top}px)` }}>
      <span>{row.node}</span>
      <span>{row.latency} ms</span>
      <span>{row.handoffs} handoffs</span>
    </div>
  );
});

/**
 * Demonstrates a measured virtual window over ten thousand rows.
 */
export default function VirtualListLab() {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const containerRef = useRef(null);
  const filterId = useId();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return ROWS;
    return ROWS.filter((row) => row.node.toLowerCase().includes(needle));
  }, [deferredQuery]);

  const viewportHeight = VIEWPORT_HEIGHT;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const visible = filtered.slice(start, start + visibleCount);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the scroll window when the filter changes.
  useLayoutEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [deferredQuery]);

  return (
    <LabShell
      title="Virtual list"
      summary="Ten thousand rows, one fixed-height window, and memoized row components."
      tags={['useLayoutEffect', 'memo', 'useDeferredValue']}
      notes={[
        'Only the visible slice plus overscan is rendered.',
        'The window is sized to the fixed 420 px list viewport.',
        'Filtering uses a deferred query so typing remains responsive.',
      ]}
    >
      <div className="lab-demo">
        <label className="docs-search docs-search--wide" htmlFor={filterId}>
          <span className="sr-only">Filter nodes</span>
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by node name…"
            autoComplete="off"
          />
        </label>
        <p className="lab-facts__line">
          {filtered.length.toLocaleString('en-US')} rows · rendering {visible.length} ·{' '}
          {VIEWPORT_HEIGHT} px window
        </p>
        <section
          className="virtual-list"
          ref={containerRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          aria-label="Virtualized telemetry rows"
        >
          <div className="virtual-list__spacer" style={{ height: filtered.length * ROW_HEIGHT }}>
            {visible.map((row, index) => (
              <VirtualRow key={row.id} row={row} top={(start + index) * ROW_HEIGHT} />
            ))}
          </div>
        </section>
      </div>
    </LabShell>
  );
}
