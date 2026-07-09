import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
} from 'three';

/** Distant vector stars on a far shell. */
export function createStarfield(count = 3500, radius = 120_000): Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tint = [new Color('#9dffbb'), new Color('#cfeee0'), new Color('#57e6ff')];

  for (let i = 0; i < count; i++) {
    // Uniform on the sphere.
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * s * Math.cos(theta);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * s * Math.sin(theta);

    const c = tint[Math.floor(Math.random() * tint.length)]
      .clone()
      .multiplyScalar(0.35 + Math.random() * 0.65);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  return new Points(
    geometry,
    new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }),
  );
}
