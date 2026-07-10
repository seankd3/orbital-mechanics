import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Points,
  PointsMaterial,
} from 'three';

/**
 * Real night sky: HYG catalog (~8,900 stars to mag 6.5) placed on a far
 * celestial sphere. Loads async; the group starts empty and fills in.
 * Each catalog row is [ra_deg, dec_deg, magnitude, B-V color index].
 */
export function createStarfield(radius = 120_000): Group {
  const group = new Group();

  fetch('/data/star_catalog.json')
    .then((r) => r.json())
    .then((catalog: [number, number, number, number][]) => {
      group.add(buildLayer(catalog.filter(([, , m]) => m <= 2.5), radius, 2.6));
      group.add(buildLayer(catalog.filter(([, , m]) => m > 2.5), radius, 1.4));
    })
    .catch(() => {
      /* no stars is survivable; console already shows the fetch error */
    });

  return group;
}

function buildLayer(stars: [number, number, number, number][], radius: number, size: number): Points {
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const c = new Color();

  stars.forEach(([raDeg, decDeg, mag, bv], i) => {
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    positions[i * 3] = radius * Math.cos(dec) * Math.cos(ra);
    positions[i * 3 + 1] = radius * Math.sin(dec);
    positions[i * 3 + 2] = -radius * Math.cos(dec) * Math.sin(ra);

    // Brightness from magnitude (mag 0 ≈ full), gentle floor so dim stars survive.
    const brightness = Math.min(1, Math.max(0.16, Math.pow(10, -0.32 * mag)));
    c.copy(bvToColor(bv)).multiplyScalar(brightness);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  return new Points(
    geometry,
    new PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/** Rough B-V → RGB, muted toward the phosphor screen's palette. */
function bvToColor(bv: number): Color {
  if (bv < 0.0) return new Color('#b4c8ff');
  if (bv < 0.4) return new Color('#e8eeff');
  if (bv < 0.8) return new Color('#ffffff');
  if (bv < 1.2) return new Color('#fff0d0');
  return new Color('#ffd9ae');
}
