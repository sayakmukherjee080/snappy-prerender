import { useId } from 'react';

/**
 * Draws the hero schematic: one inference node, its optical crosslink, and the Svalbard relay.
 */
export function OrbitDiagram() {
  const generatedId = useId();
  const diagramId = generatedId.replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = `orbit-title-${diagramId}`;
  const descId = `orbit-desc-${diagramId}`;
  const gridId = `orbit-grid-${diagramId}`;
  const earthClipId = `earth-clip-${diagramId}`;

  return (
    <figure className="blueprint">
      <div className="blueprint__head">
        <span>FIG. 01 — AETHER NODE</span>
        <span>REV 2.6 / 550 KM SSO</span>
      </div>

      <div className="blueprint__body">
        <svg
          className="orbit-diagram"
          viewBox="0 0 560 620"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>Aether inference satellite in low Earth orbit</title>
          <desc id={descId}>
            Technical line drawing of a satellite with deployable solar arrays, an optical crosslink
            to a neighbouring node, and a ground relay at Svalbard.
          </desc>

          <defs>
            <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.055"
                strokeWidth="1"
              />
            </pattern>
            <clipPath id={earthClipId}>
              <circle cx="280" cy="760" r="345" />
            </clipPath>
          </defs>

          <rect width="560" height="620" fill={`url(#${gridId})`} />

          <g clipPath={`url(#${earthClipId})`} opacity="0.55">
            <ellipse cx="280" cy="760" rx="345" ry="250" fill="none" stroke="#39434a" />
            <ellipse cx="280" cy="760" rx="345" ry="150" fill="none" stroke="#39434a" />
            <line x1="280" y1="415" x2="280" y2="1105" stroke="#39434a" />
            <line x1="-65" y1="760" x2="625" y2="760" stroke="#39434a" />
          </g>

          <circle cx="280" cy="760" r="345" fill="#0a0e11" fillOpacity="0.9" />
          <circle cx="280" cy="760" r="345" fill="none" stroke="#39434a" />
          <circle cx="280" cy="760" r="358" fill="none" stroke="#ee5a24" strokeOpacity="0.22" />

          <g
            className="orbit-diagram__orbits"
            fill="none"
            stroke="#5d6971"
            strokeWidth="1"
            strokeDasharray="3 7"
          >
            <ellipse cx="280" cy="300" rx="225" ry="94" transform="rotate(-18 280 300)" />
            <ellipse cx="280" cy="300" rx="255" ry="118" transform="rotate(14 280 300)" />
            <ellipse
              className="orbit-diagram__orbit-accent"
              cx="280"
              cy="300"
              rx="180"
              ry="66"
              transform="rotate(-38 280 300)"
              stroke="#ee5a24"
              strokeOpacity="0.55"
            />
          </g>

          <path
            d="M 228 224 L 168 290"
            fill="none"
            stroke="#ee5a24"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
          <path
            d="M 290 220 L 402 424"
            fill="none"
            stroke="#ee5a24"
            strokeWidth="1"
            strokeDasharray="2 5"
            strokeOpacity="0.75"
          />

          <g transform="translate(285 205) rotate(-14)">
            <rect x="-16" y="-10" width="32" height="20" rx="1.5" fill="#e9e7e0" />
            <line x1="-16" y1="-10" x2="16" y2="10" stroke="#0f1417" strokeOpacity="0.25" />
            <line x1="-16" y1="10" x2="16" y2="-10" stroke="#0f1417" strokeOpacity="0.18" />
            <rect x="-78" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c" />
            <rect x="20" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c" />
            <line x1="-20" y1="0" x2="-78" y2="0" stroke="#8c969c" />
            <line x1="20" y1="0" x2="78" y2="0" stroke="#8c969c" />
            <line x1="-70" y1="-5" x2="-70" y2="5" stroke="#5d6971" />
            <line x1="-56" y1="-5" x2="-56" y2="5" stroke="#5d6971" />
            <line x1="-42" y1="-5" x2="-42" y2="5" stroke="#5d6971" />
            <line x1="30" y1="-5" x2="30" y2="5" stroke="#5d6971" />
            <line x1="44" y1="-5" x2="44" y2="5" stroke="#5d6971" />
            <line x1="58" y1="-5" x2="58" y2="5" stroke="#5d6971" />
            <path d="M 0 10 L 0 26" stroke="#8c969c" />
            <path d="M -10 26 L 10 26" stroke="#8c969c" />
            <path d="M 0 -10 L -5 -20 L 5 -20 Z" fill="none" stroke="#8c969c" />
            <circle className="orbit-diagram__beacon" cx="0" cy="0" r="2.6" fill="#ee5a24" />
          </g>

          <g transform="translate(132 318) rotate(22) scale(0.55)">
            <rect x="-16" y="-10" width="32" height="20" rx="1.5" fill="#e9e7e0" />
            <rect x="-78" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c" />
            <rect x="20" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c" />
            <line x1="-20" y1="0" x2="-78" y2="0" stroke="#8c969c" />
            <line x1="20" y1="0" x2="78" y2="0" stroke="#8c969c" />
            <circle cx="0" cy="0" r="3" fill="#ee5a24" />
          </g>

          <g transform="translate(405 436)">
            <circle cx="0" cy="-8" r="2.5" fill="#ee5a24" />
            <path d="M -7 0 L 0 -12 L 7 0 Z" fill="#ee5a24" />
            <path d="M -13 -5 Q 0 -24 13 -5" fill="none" stroke="#ee5a24" strokeOpacity="0.5" />
            <path d="M -21 -9 Q 0 -34 21 -9" fill="none" stroke="#ee5a24" strokeOpacity="0.25" />
          </g>

          <g className="orbit-diagram__callouts">
            <text x="24" y="34" className="dg-label">
              NODE / AETHER-02
            </text>
            <text x="24" y="52" className="dg-value">
              8 × TENSOR NODES
            </text>
            <path className="dg-leader" d="M 24 62 L 112 62 L 188 154" />

            <text x="536" y="34" textAnchor="end" className="dg-label">
              OPTICAL CROSSLINK
            </text>
            <text x="536" y="52" textAnchor="end" className="dg-value">
              2 × 10 GBPS
            </text>
            <path className="dg-leader" d="M 536 62 L 462 62 L 370 162" />

            <text x="280" y="356" textAnchor="middle" className="dg-label">
              ORBIT
            </text>
            <text x="280" y="374" textAnchor="middle" className="dg-value">
              550 KM · SSO
            </text>

            <text x="24" y="536" className="dg-label">
              SOLAR ARRAY
            </text>
            <text x="24" y="554" className="dg-value">
              42 KW DEPLOYED
            </text>
            <path className="dg-leader" d="M 24 564 L 84 564 L 160 340" />

            <text x="536" y="536" textAnchor="end" className="dg-label">
              GROUND RELAY
            </text>
            <text x="536" y="554" textAnchor="end" className="dg-value">
              SVALBARD · 78.2°N
            </text>
            <path className="dg-leader" d="M 536 564 L 470 564 L 414 452" />
          </g>

          <g stroke="#5d6971" strokeWidth="1">
            <path d="M 60 170 h 10 M 65 165 v 10" />
            <path d="M 496 248 h 10 M 501 243 v 10" />
            <path d="M 196 498 h 10 M 201 493 v 10" />
          </g>

          <g transform="translate(230 592)">
            <path
              d="M 0 0 h 100 M 0 -4 v 8 M 50 -3 v 6 M 100 -4 v 8"
              stroke="#5d6971"
              fill="none"
            />
            <text x="0" y="-8" className="dg-label">
              0
            </text>
            <text x="100" y="-8" textAnchor="end" className="dg-label">
              50 M
            </text>
          </g>
        </svg>
      </div>

      <div className="blueprint__foot">
        <span>NODE 02 / PLANE P1</span>
        <span>42 KW · 1.2 PFLOPS</span>
      </div>
    </figure>
  );
}
