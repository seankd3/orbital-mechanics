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

export interface OrbitLineOptions {
  color: string;
  opacity?: number;
  /** Show periapsis/apoapsis markers (only the live orbit wants them). */
  markers?: boolean;
}

/**
 * A conic track around the current primary (move `group.position` to the
 * primary's render position). Handles ellipses and hyperbolic arcs.
 */
export class OrbitLine {
  readonly group = new Group();
  private readonly line: Line;
  private readonly periMarker: Mesh;
  private readonly apoMarker: Mesh;
  private readonly showMarkers: boolean;

  constructor(options: OrbitLineOptions) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array((SAMPLES + 1) * 3), 3));
    this.line = new Line(
      geometry,
      new LineBasicMaterial({
        color: new Color(options.color),
        transparent: true,
        opacity: options.opacity ?? 0.9,
      }),
    );
    this.line.frustumCulled = false;
    this.group.add(this.line);

    this.showMarkers = options.markers ?? false;
    this.periMarker = marker('#7dffa8');
    this.apoMarker = marker('#ffb347');
    this.group.add(this.periMarker, this.apoMarker);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  update(el: OrbitalElements | null): void {
    if (!el || !isFinite(el.semiMajorAxis) || el.semiMajorAxis === 0) {
      this.line.visible = false;
      this.periMarker.visible = false;
      this.apoMarker.visible = false;
      return;
    }
    this.line.visible = true;

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
    const showMarkers = this.showMarkers && e > 0.001;
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

/** The planned-burn point on the current orbit. */
export function createNodeMarker(): Mesh {
  const m = marker('#ffef8a');
  m.scale.setScalar(0.05);
  return m;
}

function marker(color: string): Mesh {
  return new Mesh(
    new OctahedronGeometry(1),
    new MeshBasicMaterial({ color: new Color(color), wireframe: true }),
  );
}
