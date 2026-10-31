import { useId } from 'react';
import { GROUND_STATIONS } from '../content/site.js';

const CENTER_X = 550;
const CENTER_Y = 320;
const GLOBE_RADIUS = 190;
const PLANE_COUNT = 6;
const NODES_PER_PLANE = 4;
const STATION_ANGLES = [-152, -108, -68, -24, 22, 66, 112, 154];

/**
 * Rotates a point around the constellation centre so every plane can share one ellipse.
 * @param {number} radiusX
 * @param {number} radiusY
 * @param {number} rotationDegrees
 * @param {number} angleRadians
 * @returns {{ x: number, y: number }}
 */
function pointOnOrbit(radiusX, radiusY, rotationDegrees, angleRadians) {
  const x = radiusX * Math.cos(angleRadians);
  const y = radiusY * Math.sin(angleRadians);
  const rotation = (rotationDegrees * Math.PI) / 180;

  return {
    x: CENTER_X + x * Math.cos(rotation) - y * Math.sin(rotation),
    y: CENTER_Y + x * Math.sin(rotation) + y * Math.cos(rotation),
  };
}

const PLANES = Array.from({ length: PLANE_COUNT }, (_, planeIndex) => {
  const rotation = planeIndex * 30;
  const nodes = Array.from({ length: NODES_PER_PLANE }, (_, nodeIndex) => {
    const angle = (nodeIndex * Math.PI) / 2 + planeIndex * 0.32;
    const point = pointOnOrbit(350, 145, rotation, angle);
    const distanceFromCentre = Math.hypot(point.x - CENTER_X, point.y - CENTER_Y);
    return { ...point, behind: distanceFromCentre < GLOBE_RADIUS - 8 };
  });

  return { rotation, nodes, label: pointOnOrbit(350, 145, rotation, 0) };
});

const STATIONS = GROUND_STATIONS.map((station, index) => {
  const angle = (STATION_ANGLES[index] * Math.PI) / 180;
  return {
    ...station,
    x: CENTER_X + (GLOBE_RADIUS + 24) * Math.cos(angle),
    y: CENTER_Y + (GLOBE_RADIUS + 24) * Math.sin(angle),
    labelX: CENTER_X + (GLOBE_RADIUS + 42) * Math.cos(angle),
    labelY: CENTER_Y + (GLOBE_RADIUS + 42) * Math.sin(angle),
    align: Math.cos(angle) < 0 ? 'end' : 'start',
  };
});

/**
 * Draws the 24-node, six-plane constellation and its eight ground relays.
 */
export function ConstellationDiagram() {
  const generatedId = useId();
  const diagramId = generatedId.replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = `constellation-title-${diagramId}`;
  const descId = `constellation-desc-${diagramId}`;
  const gridId = `constellation-grid-${diagramId}`;
  const globeId = `globe-shade-${diagramId}`;
  const globeClipId = `globe-clip-${diagramId}`;

  return (
    <figure className="blueprint constellation">
      <div className="blueprint__head">
        <span>FIG. 03 — CONSTELLATION</span>
        <span>WALKER 24/6/4 · 550 KM</span>
      </div>

      <div className="blueprint__body">
        <svg
          className="constellation__svg"
          viewBox="0 0 1100 620"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>Aether orbital constellation</title>
          <desc id={descId}>
            Twenty-four satellites arranged in six orbital planes around a wireframe Earth, linked
            to eight ground stations.
          </desc>

          <defs>
            <pattern id={gridId} width="44" height="44" patternUnits="userSpaceOnUse">
              <path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.05"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id={globeId} cx="35%" cy="28%" r="78%">
              <stop offset="0%" stopColor="#1d272d" />
              <stop offset="100%" stopColor="#080c0f" />
            </radialGradient>
            <clipPath id={globeClipId}>
              <circle cx={CENTER_X} cy={CENTER_Y} r={GLOBE_RADIUS} />
            </clipPath>
          </defs>

          <rect width="1100" height="620" fill={`url(#${gridId})`} />

          <g
            className="constellation__orbits"
            fill="none"
            stroke="#5d6971"
            strokeWidth="1"
            strokeDasharray="3 8"
            opacity="0.7"
          >
            {PLANES.map((plane) => (
              <ellipse
                key={`orbit-${plane.rotation}`}
                cx={CENTER_X}
                cy={CENTER_Y}
                rx="350"
                ry="145"
                transform={`rotate(${plane.rotation} ${CENTER_X} ${CENTER_Y})`}
              />
            ))}
          </g>

          <g fill="none" stroke="#ee5a24" strokeWidth="1" strokeDasharray="2 6" opacity="0.5">
            <path d="M 236 224 Q 550 54 864 224" />
            <path d="M 296 436 Q 550 576 804 436" />
            <path d="M 410 152 Q 690 230 812 430" />
          </g>

          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={GLOBE_RADIUS}
            fill={`url(#${globeId})`}
            stroke="#3a444b"
          />
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={GLOBE_RADIUS + 9}
            fill="none"
            stroke="#ee5a24"
            strokeOpacity="0.18"
          />

          <g clipPath={`url(#${globeClipId})`} fill="none" stroke="#2c363d" strokeWidth="1">
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx={GLOBE_RADIUS} ry="62" />
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx={GLOBE_RADIUS} ry="124" />
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx="62" ry={GLOBE_RADIUS} />
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx="124" ry={GLOBE_RADIUS} />
            <line x1="360" y1={CENTER_Y} x2="740" y2={CENTER_Y} />
            <line x1={CENTER_X} y1="130" x2={CENTER_X} y2="510" />
          </g>

          <g className="constellation__planes">
            {PLANES.map((plane) => (
              <text
                key={`plane-${plane.rotation}`}
                x={plane.label.x + 8}
                y={plane.label.y - 5}
                className="dg-label"
              >
                P{Math.round(plane.rotation / 30) + 1}
              </text>
            ))}
          </g>

          <g className="constellation__nodes">
            {PLANES.flatMap((plane) =>
              plane.nodes.map((node, nodeIndex) => (
                <g key={`node-${plane.rotation}-${nodeIndex}`} opacity={node.behind ? 0.3 : 1}>
                  <circle cx={node.x} cy={node.y} r="9" fill="#ee5a24" opacity="0.12" />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="4"
                    fill="#ee5a24"
                    stroke="#0b0f12"
                    strokeWidth="1.5"
                  />
                </g>
              )),
            )}
          </g>

          <g className="constellation__stations">
            {STATIONS.map((station) => (
              <g key={station.code}>
                <line
                  x1={station.x}
                  y1={station.y}
                  x2={station.labelX - (station.align === 'end' ? -4 : 4)}
                  y2={station.labelY}
                  stroke="#5d6971"
                  strokeWidth="1"
                />
                <rect
                  x={station.x - 3.5}
                  y={station.y - 3.5}
                  width="7"
                  height="7"
                  fill="#e9e7e0"
                  stroke="#ee5a24"
                  strokeWidth="1.5"
                />
                <text
                  x={station.labelX}
                  y={station.labelY + 3}
                  textAnchor={station.align}
                  className="dg-label constellation__station-label"
                >
                  {station.code}
                </text>
              </g>
            ))}
          </g>

          <g className="orbit-diagram__callouts">
            <text x="28" y="36" className="dg-label">
              24 NODES / 6 PLANES / 8 RELAYS
            </text>
            <text x="1072" y="36" textAnchor="end" className="dg-label">
              OPTICAL MESH · 20 GBPS
            </text>
          </g>

          <g transform="translate(28 560)" className="constellation__legend">
            <circle cx="5" cy="0" r="4" fill="#ee5a24" />
            <text x="18" y="3" className="dg-label">
              AETHER NODE
            </text>
            <rect x="142" y="-4" width="8" height="8" fill="#e9e7e0" stroke="#ee5a24" />
            <text x="160" y="3" className="dg-label">
              GROUND RELAY
            </text>
            <line x1="292" y1="0" x2="322" y2="0" stroke="#ee5a24" strokeDasharray="2 5" />
            <text x="332" y="3" className="dg-label">
              OPTICAL LINK
            </text>
          </g>

          <g transform="translate(1072 560)" textAnchor="end">
            <text y="3" className="dg-label">
              INCLINATION 97.6° · PERIOD 95 MIN
            </text>
          </g>
        </svg>
      </div>

      <div className="blueprint__foot">
        <span>24 SATELLITES · 6 PLANES</span>
        <span>8 GROUND STATIONS · 4 CONTINENTS</span>
      </div>
    </figure>
  );
}
