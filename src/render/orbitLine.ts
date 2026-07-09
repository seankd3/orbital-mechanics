import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three';
import { RENDER_SCALE } from '../constants';
import { stateAtTrueAnomaly, type OrbitalElements } from '../sim/physics';

const SAMPLES = 256;

/** Predicted orbit as a phosphor-cyan track, with periapsis/apoapsis markers. */
export class OrbitLine {
  readonly group = new Group();
  private readonly line: Line;
  private readonly positions: Float32Array;
  private readonly periMarker: Mesh;
  private readonly apoMarker: Mesh;

  constructor() {
    this.positions = new Float32Array((SAMPLES + 1) * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.line = new Line(
      geometry,
      new LineBasicMaterial({ color: new Color('#2e7d8c'), transparent: true, opacity: 0.9 }),
    );
    this.line.frustumCulled = false;
    this.group.add(this.line);

    this.periMarker = marker('#7dffa8');
    this.apoMarker = marker('#ffb347');
    this.group.add(this.periMarker, this.apoMarker);
  }

  update(el: OrbitalElements): void {
    const e = el.eccentricity;
    const hyperbolic = e >= 1;

    // For hyperbolic passes, only sample the arc that stays reasonably close.
    let nuMax = Math.PI;
    if (hyperbolic) nuMax = Math.acos(-1 / e) - 0.08;

    const attr = this.line.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i <= SAMPLES; i++) {
      const nu = -nuMax + (i / SAMPLES) * 2 * nuMax;
      const p = stateAtTrueAnomaly(el, nu);
      attr.setXYZ(i, p.x * RENDER_SCALE, p.y * RENDER_SCALE, p.z * RENDER_SCALE);
    }
    attr.needsUpdate = true;

    // Markers are meaningless on a (near-)circular orbit.
    const showMarkers = e > 0.001;
    this.periMarker.visible = showMarkers;
    this.apoMarker.visible = showMarkers && !hyperbolic;

    if (showMarkers) {
      this.periMarker.position.copy(stateAtTrueAnomaly(el, 0).multiplyScalar(RENDER_SCALE));
      if (!hyperbolic) {
        this.apoMarker.position.copy(stateAtTrueAnomaly(el, Math.PI).multiplyScalar(RENDER_SCALE));
      }
      const scale = Math.max(0.03, Math.abs(el.semiMajorAxis) * RENDER_SCALE * 0.008);
      this.periMarker.scale.setScalar(scale);
      this.apoMarker.scale.setScalar(scale);
    }
  }
}

function marker(color: string): Mesh {
  return new Mesh(
    new OctahedronGeometry(1),
    new MeshBasicMaterial({ color: new Color(color), wireframe: true }),
  );
}
