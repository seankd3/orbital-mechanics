import {
  CustomBlending,
  EdgesGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  MaxEquation,
  Vector2,
  type BufferGeometry,
  type Color,
  type Object3D,
  type Vector3,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/**
 * Anti-aliased vector lines. Every stroke is a screen-space quad padded by
 * a device pixel on each side; the fragment shader computes exact pixel
 * coverage from the distance to the centerline, so edges and round caps
 * are smooth at any pixel ratio (no reliance on MSAA). Strokes combine by
 * MAX, like phosphor: overlapping caps and crossings never pile up into
 * bright beads.
 */

export interface Stroke {
  color: Color;
  /** Width in CSS pixels. */
  width?: number;
  /** 0..1; on a black display this dims the stroke. */
  opacity?: number;
  /** Dash and gap lengths in render units. */
  dash?: [number, number];
}

/** Device-pixel viewport, shared by every line material. */
const resolution = new Vector2(1, 1);
let pixelRatio = 1;
const materials = new Set<VectorLineMaterial>();

/** Call on resize: widths are specified in CSS pixels. */
export function setLineResolution(cssWidth: number, cssHeight: number, dpr: number): void {
  resolution.set(cssWidth * dpr, cssHeight * dpr);
  pixelRatio = dpr;
  for (const m of materials) m.linewidth = m.cssWidth * pixelRatio;
}

const PAD = '2.0'; // quad padding, device px (one each side) for the coverage falloff
// With meter log depth (depth.ts) a constant offset is a constant fraction of range:
// 7e-6 ≈ 0.02 % (6 mm at 30 m), far above depth-buffer noise, far below any real gap.
const DEPTH_BIAS = '7e-6';

export class VectorLineMaterial extends LineMaterial {
  readonly cssWidth: number;

  constructor({ color, width = 1.25, opacity = 1, dash }: Stroke) {
    super({ color: color.getHex(), linewidth: width * pixelRatio, worldUnits: false, dashed: !!dash });
    this.cssWidth = width;
    this.opacity = opacity;
    if (dash) [this.dashSize, this.gapSize] = dash;
    this.uniforms.resolution.value = resolution; // shared: one resize updates all
    this.transparent = true;
    this.depthWrite = false;
    this.blending = CustomBlending;
    this.blendEquation = MaxEquation;
    this.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('offset *= linewidth;', `offset *= linewidth + ${PAD};`);
      shader.fragmentShader = shader.fragmentShader
        // Dash ends get the same one-pixel coverage ramp instead of a hard discard.
        .replace('if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX', '')
        .replace(
          'vec4 diffuseColor = vec4( diffuse, alpha );',
          `{
            // Exact coverage of a box-filtered stroke: distance to the centerline in device px.
            float cap = max( abs( vUv.y ) - 1.0, 0.0 );
            float r = length( vec2( vUv.x, cap ) ) * ( linewidth + ${PAD} ) * 0.5;
            alpha *= clamp( 0.5 * linewidth + 0.5 - r, 0.0, 1.0 );
            #ifdef USE_DASH
              float u = mod( vLineDistance + dashOffset, dashSize + gapSize );
              float px = max( fwidth( vLineDistance ), 1e-9 ); // line distance per device px
              alpha *= clamp( u / px + 0.5, 0.0, 1.0 ) * clamp( ( dashSize - u ) / px + 0.5, 0.0, 1.0 );
            #endif
          }
          vec4 diffuseColor = vec4( diffuse, alpha );`,
        )
        .replace(
          // An edge ties in depth with the faces that meet there (log depth
          // bypasses polygonOffset): pull strokes a hair toward the eye.
          '#include <logdepthbuf_fragment>',
          `#include <logdepthbuf_fragment>
          #ifdef USE_LOGDEPTHBUF
            if ( vIsPerspective != 0.0 ) gl_FragDepth -= ${DEPTH_BIAS};
          #endif`,
        )
        .replace(
          '#include <premultiplied_alpha_fragment>',
          '#include <premultiplied_alpha_fragment>\n\tgl_FragColor = vec4( gl_FragColor.rgb * gl_FragColor.a, gl_FragColor.a );',
        );
    };
    this.customProgramCacheKey = () => 'vector-line';
    materials.add(this);
  }
}

export function lineMaterial(stroke: Stroke): VectorLineMaterial {
  return new VectorLineMaterial(stroke);
}

/** Static segments from a flat [x0,y0,z0, x1,y1,z1, …] list. */
export function segments(positions: ArrayLike<number>, material: VectorLineMaterial): LineSegments2 {
  const g = new LineSegmentsGeometry().setPositions(positions instanceof Float32Array ? positions : Float32Array.from(positions));
  const line = new LineSegments2(g, material);
  if (material.dashed) line.computeLineDistances();
  return line;
}

/** Point pairs (a, b, c, d …) as segments ab, cd, … */
export function pairs(points: Vector3[], material: VectorLineMaterial): LineSegments2 {
  return segments(points.flatMap((p) => [p.x, p.y, p.z]), material);
}

/** A connected polyline; `closed` joins the last point to the first. */
export function polyline(points: Vector3[], material: VectorLineMaterial, closed = false): LineSegments2 {
  const out: number[] = [];
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return segments(out, material);
}

/** Hard edges of a mesh geometry (the wireframe look). */
export function edges(geometry: BufferGeometry, material: VectorLineMaterial, thresholdDeg = 12): LineSegments2 {
  return segments(new EdgesGeometry(geometry, thresholdDeg).getAttribute('position').array, material);
}

export function isVectorLine(o: Object3D): o is LineSegments2 {
  return (o as LineSegments2).isLineSegments2 === true;
}

/**
 * Segments rewritten every frame, in place: fixed-capacity GPU buffers, so
 * no per-frame allocation (three's setPositions makes a new GPU buffer each call).
 */
export class LineBuffer {
  readonly object: LineSegments2;
  private readonly geometry = new LineSegmentsGeometry();
  private readonly ends: InstancedInterleavedBuffer;
  private readonly distances: InstancedInterleavedBuffer | null = null;

  constructor(material: VectorLineMaterial, readonly capacity: number) {
    this.ends = new InstancedInterleavedBuffer(new Float32Array(capacity * 6), 6, 1);
    this.geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(this.ends, 3, 0));
    this.geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(this.ends, 3, 3));
    if (material.dashed) {
      this.distances = new InstancedInterleavedBuffer(new Float32Array(capacity * 2), 2, 1);
      this.geometry.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(this.distances, 1, 0));
      this.geometry.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(this.distances, 1, 1));
    }
    this.geometry.instanceCount = 0;
    this.object = new LineSegments2(this.geometry, material);
    this.object.frustumCulled = false;
  }

  /** Replace the contents with `count` segments from a flat xyz-pair list. */
  setSegments(positions: ArrayLike<number>, count = Math.floor(positions.length / 6)): void {
    const n = Math.min(count, this.capacity);
    const a = this.ends.array as Float32Array;
    for (let i = 0; i < n * 6; i++) a[i] = positions[i];
    this.ends.needsUpdate = true;
    if (this.distances) {
      const d = this.distances.array as Float32Array;
      let total = 0;
      for (let i = 0; i < n; i++) {
        const k = i * 6;
        d[i * 2] = total;
        total += Math.hypot(a[k + 3] - a[k], a[k + 4] - a[k + 1], a[k + 5] - a[k + 2]);
        d[i * 2 + 1] = total;
      }
      this.distances.needsUpdate = true;
    }
    this.geometry.instanceCount = n;
  }

  /** A connected polyline from a flat xyz list of `count` points. */
  setPolyline(points: ArrayLike<number>, count = Math.floor(points.length / 3)): void {
    const n = Math.max(0, Math.min(count - 1, this.capacity));
    const scratch = this.scratch.length >= n * 6 ? this.scratch : (this.scratch = new Float32Array(n * 6));
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        scratch[i * 6 + c] = points[i * 3 + c];
        scratch[i * 6 + 3 + c] = points[(i + 1) * 3 + c];
      }
    }
    this.setSegments(scratch, n);
  }

  private scratch = new Float32Array(0);
}
