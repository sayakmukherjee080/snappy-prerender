import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LabShell } from './LabShell.jsx';

/**
 * Renders a portal tooltip that flips and clamps itself to the viewport.
 * @param {{ label: string, children: unknown }} props
 */
function Tooltip({ label, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tipRef = useRef(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return undefined;

    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!trigger || !tip) return;

      let top = trigger.top - tip.height - 8;
      if (top < 8) top = trigger.bottom + 8;

      let left = trigger.left + trigger.width / 2 - tip.width / 2;
      if (left < 8) left = 8;
      if (left + tip.width > window.innerWidth - 8) {
        left = window.innerWidth - tip.width - 8;
      }

      setPosition({ top, left });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tooltip-trigger"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={tooltipId}
            role="tooltip"
            className="tooltip"
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}

/**
 * Demonstrates measured tooltip positioning at the edges of the viewport.
 */
export default function LayoutTooltipLab() {
  return (
    <LabShell
      title="Layout tooltip"
      summary="A portal tooltip measured with useLayoutEffect, flipped above or below, and clamped to the viewport."
      tags={['useLayoutEffect', 'ResizeObserver', 'createPortal', 'collision']}
      notes={[
        'The tooltip is portaled to the body so overflow does not clip it.',
        'Position is measured after layout, then clamped to the viewport.',
        'Hover or focus the edge buttons to see the flip behavior.',
      ]}
    >
      <div className="lab-demo tooltip-demo">
        <div className="tooltip-demo__row">
          <Tooltip label="This tooltip is near the left edge. It clamps instead of clipping.">
            Left edge
          </Tooltip>
          <Tooltip label="A centered tooltip. It should sit above the trigger unless there is no room.">
            Center
          </Tooltip>
          <Tooltip label="This tooltip is near the right edge. It clamps to the viewport.">
            Right edge
          </Tooltip>
        </div>
        <div className="tooltip-demo__row tooltip-demo__row--bottom">
          <Tooltip label="A tooltip near the bottom edge flips above the trigger.">
            Bottom edge
          </Tooltip>
        </div>
      </div>
    </LabShell>
  );
}
