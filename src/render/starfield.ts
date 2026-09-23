import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Points, PointsMaterial } from 'three';

/**
 * The real night sky: HYG catalog (~8,900 stars to mag 6.5) on a far
 * celestial sphere, loaded async. Rows are [ra°, dec°, magnitude, B−V].
 */
export function createStarfield(radius = 1e5): Group {
  const group = new Group();
  fetch(`${import.meta.env.BASE_URL}data/star_catalog.json`)
    .then((r) => r.json())
    .then((catalog: [number, number, number, number][]) => {
      group.add(layer(catalog.filter(([, , m]) => m <= 2.5), radius, 2.2));
      group.add(layer(catalog.filter(([, , m]) => m > 2.5), radius, 1.2));
    })
    .catch(() => {
      /* a starless sky is survivable */
    });
  return group;
}

function layer(stars: [number, number, number, number][], radius: number, size: number): Points {
  const pos = new Float32Array(stars.length * 3);
  const col = new Float32Array(stars.length * 3);
  const c = new Color();
  stars.forEach(([ra, dec, mag, bv], i) => {
    const a = (ra * Math.PI) / 180;
    const d = (dec * Math.PI) / 180;
    pos.set([radius * Math.cos(d) * Math.cos(a), radius * Math.sin(d), -radius * Math.cos(d) * Math.sin(a)], i * 3);
    // Restrained: dim, lightly tinted by color index.
    const brightness = Math.min(0.85, Math.max(0.12, 10 ** (-0.3 * mag)));
    c.set(bv < 0 ? '#c3d2ff' : bv < 0.5 ? '#eef2ff' : bv < 1.1 ? '#fff4e2' : '#ffdcb8').multiplyScalar(brightness);
    col.set([c.r, c.g, c.b], i * 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  return new Points(g, starMaterial(size));
}

/**
 * Stars as round discs with exact pixel coverage (like the lines): the
 * sprite is padded a pixel each side and the edge is shaded by distance
 * from the center, in linear light. GL points would be hard squares.
 */
function starMaterial(size: number): PointsMaterial {
  const m = new PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, blending: AdditiveBlending, depthWrite: false });
  const edit = (src: string, from: string, to: string) => {
    if (!src.includes(from)) throw new Error('starfield: points shader changed upstream');
    return src.replace(from, to);
  };
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = edit(shader.vertexShader, 'gl_PointSize = size;', 'gl_PointSize = size + 2.0;\n\tvDiameter = size;');
    shader.vertexShader = edit(shader.vertexShader, 'uniform float scale;', 'uniform float scale;\nvarying float vDiameter;');
    shader.fragmentShader = edit(shader.fragmentShader, 'uniform float opacity;', 'uniform float opacity;\nvarying float vDiameter;');
    shader.fragmentShader = edit(
      shader.fragmentShader,
      'outgoingLight = diffuseColor.rgb;',
      `float r = length( gl_PointCoord - 0.5 ) * ( vDiameter + 2.0 ); // device px from the center
      outgoingLight = diffuseColor.rgb * clamp( 0.5 * vDiameter + 0.5 - r, 0.0, 1.0 );`,
    );
  };
  m.customProgramCacheKey = () => 'star-disc';
  return m;
}
