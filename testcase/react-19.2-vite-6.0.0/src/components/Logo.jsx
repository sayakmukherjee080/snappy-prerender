/**
 * Renders the Aether orbital mark and wordmark for the header and footer.
 * @param {{ tone?: 'ink' | 'light' }} props
 */
export function Logo({ tone = 'ink' }) {
  return (
    <span className={`logo logo--${tone}`}>
      <svg className="logo__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <ellipse
          cx="20"
          cy="20"
          rx="18"
          ry="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          transform="rotate(-28 20 20)"
        />
        <circle cx="33.5" cy="10.5" r="2.6" fill="var(--orange)" />
      </svg>
      <span className="logo__text">
        <span className="logo__name">AETHER</span>
        <span className="logo__sub">COMPUTE / ORBITAL</span>
      </span>
    </span>
  );
}
