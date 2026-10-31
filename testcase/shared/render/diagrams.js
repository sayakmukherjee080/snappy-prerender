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
 * @returns {string}
 */
export function constellationDiagram() {
  return `<figure class="blueprint constellation">
  <div class="blueprint__head"><span>FIG. 03 — CONSTELLATION</span><span>WALKER 24/6/4 · 550 KM</span></div>
  <div class="blueprint__body">
    <svg class="constellation__svg" viewBox="0 0 1100 620" role="img" aria-labelledby="constellation-title constellation-desc">
      <title id="constellation-title">Aether orbital constellation</title>
      <desc id="constellation-desc">Twenty-four satellites arranged in six orbital planes around a wireframe Earth, linked to eight ground stations.</desc>
      <defs>
        <pattern id="constellation-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"></path></pattern>
        <radialGradient id="globe-shade" cx="35%" cy="28%" r="78%"><stop offset="0%" stop-color="#1d272d"></stop><stop offset="100%" stop-color="#080c0f"></stop></radialGradient>
        <clipPath id="globe-clip"><circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${GLOBE_RADIUS}"></circle></clipPath>
      </defs>
      <rect width="1100" height="620" fill="url(#constellation-grid)"></rect>
      <g fill="none" stroke="#5d6971" stroke-width="1" stroke-dasharray="3 8" opacity="0.7">${PLANES.map(
        (plane) =>
          `<ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="350" ry="145" transform="rotate(${plane.rotation} ${CENTER_X} ${CENTER_Y})"></ellipse>`,
      ).join('')}</g>
      <g fill="none" stroke="#ee5a24" stroke-width="1" stroke-dasharray="2 6" opacity="0.5">
        <path d="M 236 224 Q 550 54 864 224"></path>
        <path d="M 296 436 Q 550 576 804 436"></path>
        <path d="M 410 152 Q 690 230 812 430"></path>
      </g>
      <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${GLOBE_RADIUS}" fill="url(#globe-shade)" stroke="#3a444b"></circle>
      <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${GLOBE_RADIUS + 9}" fill="none" stroke="#ee5a24" stroke-opacity="0.18"></circle>
      <g clip-path="url(#globe-clip)" fill="none" stroke="#2c363d" stroke-width="1">
        <ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="${GLOBE_RADIUS}" ry="62"></ellipse>
        <ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="${GLOBE_RADIUS}" ry="124"></ellipse>
        <ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="62" ry="${GLOBE_RADIUS}"></ellipse>
        <ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="124" ry="${GLOBE_RADIUS}"></ellipse>
        <line x1="360" y1="${CENTER_Y}" x2="740" y2="${CENTER_Y}"></line>
        <line x1="${CENTER_X}" y1="130" x2="${CENTER_X}" y2="510"></line>
      </g>
      <g>${PLANES.map(
        (plane) =>
          `<text x="${plane.label.x + 8}" y="${plane.label.y - 5}" class="dg-label">P${Math.round(plane.rotation / 30) + 1}</text>`,
      ).join('')}</g>
      <g>${PLANES.flatMap((plane) =>
        plane.nodes.map(
          (node) =>
            `<g opacity="${node.behind ? 0.3 : 1}"><circle cx="${node.x}" cy="${node.y}" r="9" fill="#ee5a24" opacity="0.12"></circle><circle cx="${node.x}" cy="${node.y}" r="4" fill="#ee5a24" stroke="#0b0f12" stroke-width="1.5"></circle></g>`,
        ),
      ).join('')}</g>
      <g>${STATIONS.map(
        (station) => `<g>
          <line x1="${station.x}" y1="${station.y}" x2="${station.labelX - (station.align === 'end' ? -4 : 4)}" y2="${station.labelY}" stroke="#5d6971" stroke-width="1"></line>
          <rect x="${station.x - 3.5}" y="${station.y - 3.5}" width="7" height="7" fill="#e9e7e0" stroke="#ee5a24" stroke-width="1.5"></rect>
          <text x="${station.labelX}" y="${station.labelY + 3}" text-anchor="${station.align}" class="dg-label constellation__station-label">${station.code}</text>
        </g>`,
      ).join('')}</g>
      <g>
        <text x="28" y="36" class="dg-label">24 NODES / 6 PLANES / 8 RELAYS</text>
        <text x="1072" y="36" text-anchor="end" class="dg-label">OPTICAL MESH · 20 GBPS</text>
      </g>
      <g transform="translate(28 560)">
        <circle cx="5" cy="0" r="4" fill="#ee5a24"></circle><text x="18" y="3" class="dg-label">AETHER NODE</text>
        <rect x="142" y="-4" width="8" height="8" fill="#e9e7e0" stroke="#ee5a24"></rect><text x="160" y="3" class="dg-label">GROUND RELAY</text>
        <line x1="292" y1="0" x2="322" y2="0" stroke="#ee5a24" stroke-dasharray="2 5"></line><text x="332" y="3" class="dg-label">OPTICAL LINK</text>
      </g>
      <g transform="translate(1072 560)" text-anchor="end"><text y="3" class="dg-label">INCLINATION 97.6° · PERIOD 95 MIN</text></g>
    </svg>
  </div>
  <div class="blueprint__foot"><span>24 SATELLITES · 6 PLANES</span><span>8 GROUND STATIONS · 4 CONTINENTS</span></div>
</figure>`;
}

/**
 * Draws the hero schematic: one inference node, its optical crosslink, and the Svalbard relay.
 * @returns {string}
 */
export function orbitDiagram() {
  return `<figure class="blueprint">
  <div class="blueprint__head"><span>FIG. 01 — AETHER NODE</span><span>REV 2.6 / 550 KM SSO</span></div>
  <div class="blueprint__body">
    <svg class="orbit-diagram" viewBox="0 0 560 620" role="img" aria-labelledby="orbit-title orbit-desc">
      <title id="orbit-title">Aether inference satellite in low Earth orbit</title>
      <desc id="orbit-desc">Technical line drawing of a satellite with deployable solar arrays, an optical crosslink to a neighbouring node, and a ground relay at Svalbard.</desc>
      <defs>
        <pattern id="orbit-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"></path></pattern>
        <clipPath id="earth-clip"><circle cx="280" cy="760" r="345"></circle></clipPath>
      </defs>
      <rect width="560" height="620" fill="url(#orbit-grid)"></rect>
      <g clip-path="url(#earth-clip)" opacity="0.55">
        <ellipse cx="280" cy="760" rx="345" ry="250" fill="none" stroke="#39434a"></ellipse>
        <ellipse cx="280" cy="760" rx="345" ry="150" fill="none" stroke="#39434a"></ellipse>
        <line x1="280" y1="415" x2="280" y2="1105" stroke="#39434a"></line>
        <line x1="-65" y1="760" x2="625" y2="760" stroke="#39434a"></line>
      </g>
      <circle cx="280" cy="760" r="345" fill="#0a0e11" fill-opacity="0.9"></circle>
      <circle cx="280" cy="760" r="345" fill="none" stroke="#39434a"></circle>
      <circle cx="280" cy="760" r="358" fill="none" stroke="#ee5a24" stroke-opacity="0.22"></circle>
      <g fill="none" stroke="#5d6971" stroke-width="1" stroke-dasharray="3 7">
        <ellipse cx="280" cy="300" rx="225" ry="94" transform="rotate(-18 280 300)"></ellipse>
        <ellipse cx="280" cy="300" rx="255" ry="118" transform="rotate(14 280 300)"></ellipse>
        <ellipse cx="280" cy="300" rx="180" ry="66" transform="rotate(-38 280 300)" stroke="#ee5a24" stroke-opacity="0.55"></ellipse>
      </g>
      <path d="M 228 224 L 168 290" fill="none" stroke="#ee5a24" stroke-width="1" stroke-dasharray="2 5"></path>
      <path d="M 290 220 L 402 424" fill="none" stroke="#ee5a24" stroke-width="1" stroke-dasharray="2 5" stroke-opacity="0.75"></path>
      <g transform="translate(285 205) rotate(-14)">
        <rect x="-16" y="-10" width="32" height="20" rx="1.5" fill="#e9e7e0"></rect>
        <line x1="-16" y1="-10" x2="16" y2="10" stroke="#0f1417" stroke-opacity="0.25"></line>
        <line x1="-16" y1="10" x2="16" y2="-10" stroke="#0f1417" stroke-opacity="0.18"></line>
        <rect x="-78" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c"></rect>
        <rect x="20" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c"></rect>
        <line x1="-20" y1="0" x2="-78" y2="0" stroke="#8c969c"></line>
        <line x1="20" y1="0" x2="78" y2="0" stroke="#8c969c"></line>
        <line x1="-70" y1="-5" x2="-70" y2="5" stroke="#5d6971"></line>
        <line x1="-56" y1="-5" x2="-56" y2="5" stroke="#5d6971"></line>
        <line x1="-42" y1="-5" x2="-42" y2="5" stroke="#5d6971"></line>
        <line x1="30" y1="-5" x2="30" y2="5" stroke="#5d6971"></line>
        <line x1="44" y1="-5" x2="44" y2="5" stroke="#5d6971"></line>
        <line x1="58" y1="-5" x2="58" y2="5" stroke="#5d6971"></line>
        <path d="M 0 10 L 0 26" stroke="#8c969c"></path>
        <path d="M -10 26 L 10 26" stroke="#8c969c"></path>
        <path d="M 0 -10 L -5 -20 L 5 -20 Z" fill="none" stroke="#8c969c"></path>
        <circle cx="0" cy="0" r="2.6" fill="#ee5a24"></circle>
      </g>
      <g transform="translate(132 318) rotate(22) scale(0.55)">
        <rect x="-16" y="-10" width="32" height="20" rx="1.5" fill="#e9e7e0"></rect>
        <rect x="-78" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c"></rect>
        <rect x="20" y="-5" width="58" height="10" fill="#1b2227" stroke="#8c969c"></rect>
        <line x1="-20" y1="0" x2="-78" y2="0" stroke="#8c969c"></line>
        <line x1="20" y1="0" x2="78" y2="0" stroke="#8c969c"></line>
        <circle cx="0" cy="0" r="3" fill="#ee5a24"></circle>
      </g>
      <g transform="translate(405 436)">
        <circle cx="0" cy="-8" r="2.5" fill="#ee5a24"></circle>
        <path d="M -7 0 L 0 -12 L 7 0 Z" fill="#ee5a24"></path>
        <path d="M -13 -5 Q 0 -24 13 -5" fill="none" stroke="#ee5a24" stroke-opacity="0.5"></path>
        <path d="M -21 -9 Q 0 -34 21 -9" fill="none" stroke="#ee5a24" stroke-opacity="0.25"></path>
      </g>
      <g>
        <text x="24" y="34" class="dg-label">NODE / AETHER-02</text>
        <text x="24" y="52" class="dg-value">8 × TENSOR NODES</text>
        <path class="dg-leader" d="M 24 62 L 112 62 L 188 154"></path>
        <text x="536" y="34" text-anchor="end" class="dg-label">OPTICAL CROSSLINK</text>
        <text x="536" y="52" text-anchor="end" class="dg-value">2 × 10 GBPS</text>
        <path class="dg-leader" d="M 536 62 L 462 62 L 370 162"></path>
        <text x="280" y="356" text-anchor="middle" class="dg-label">ORBIT</text>
        <text x="280" y="374" text-anchor="middle" class="dg-value">550 KM · SSO</text>
        <text x="24" y="536" class="dg-label">SOLAR ARRAY</text>
        <text x="24" y="554" class="dg-value">42 KW DEPLOYED</text>
        <path class="dg-leader" d="M 24 564 L 84 564 L 160 340"></path>
        <text x="536" y="536" text-anchor="end" class="dg-label">GROUND RELAY</text>
        <text x="536" y="554" text-anchor="end" class="dg-value">SVALBARD · 78.2°N</text>
        <path class="dg-leader" d="M 536 564 L 470 564 L 414 452"></path>
      </g>
      <g stroke="#5d6971" stroke-width="1">
        <path d="M 60 170 h 10 M 65 165 v 10"></path>
        <path d="M 496 248 h 10 M 501 243 v 10"></path>
        <path d="M 196 498 h 10 M 201 493 v 10"></path>
      </g>
      <g transform="translate(230 592)">
        <path d="M 0 0 h 100 M 0 -4 v 8 M 50 -3 v 6 M 100 -4 v 8" stroke="#5d6971" fill="none"></path>
        <text x="0" y="-8" class="dg-label">0</text>
        <text x="100" y="-8" text-anchor="end" class="dg-label">50 M</text>
      </g>
    </svg>
  </div>
  <div class="blueprint__foot"><span>NODE 02 / PLANE P1</span><span>42 KW · 1.2 PFLOPS</span></div>
</figure>`;
}
