import {
  CustomBlending,
  EdgesGeometry,
  InstancedBufferAttribute,
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
  /**
   * Fade features as they shrink below a few pixels on screen: each
   * segment carries a feature size (render units). `true`: the geometry
   * lies on a sphere about its object's origin and is foreshortened with
   * it (grids, craters); `'solid'`: no foreshortening (rocks).
   */
  fade?: boolean | 'solid';
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
/** Feature fade: invisible below FADE_FROM px apart, full at FADE_TO px. */
const FADE_FROM = '1.5';
const FADE_TO = '5.0';

/** Replace exactly one occurrence, loudly: three's shader source is not an API. */
function patch(source: string, from: string, to: string): string {
  if (!source.includes(from)) throw new Error(`lines: LineMaterial shader changed upstream (${from.slice(0, 40)}…)`);
  return source.replace(from, to);
}

const VERTEX: [string, string][] = [
  ['uniform vec2 resolution;', `uniform vec2 resolution;
    #ifdef USE_FEATURE_FADE
      attribute float instanceFeature;
      varying float vFade;
    #endif`],
  ['vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );', `vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
    #ifdef USE_FEATURE_FADE
    {
      // Screen size of this segment's feature, foreshortened by the sphere it lies on.
      bool atStart = position.y < 0.5;
      vec3 p = atStart ? start.xyz : end.xyz;
      vec3 n = normalize( ( modelViewMatrix * vec4( atStart ? instanceStart : instanceEnd, 0.0 ) ).xyz );
      bool persp = projectionMatrix[ 2 ][ 3 ] == - 1.0;
      vec3 view = persp ? normalize( p ) : vec3( 0.0, 0.0, - 1.0 );
      #ifdef FEATURE_FADE_SOLID
        float foreshortening = 1.0;
      #else
        float foreshortening = abs( dot( view, n ) );
      #endif
      float size = instanceFeature * foreshortening * projectionMatrix[ 1 ][ 1 ] * 0.5 * resolution.y;
      vFade = smoothstep( ${FADE_FROM}, ${FADE_TO}, persp ? size / length( p ) : size );
    }
    #endif`],
  ['offset *= linewidth;', `offset *= linewidth + ${PAD};`],
];

const FRAGMENT: [string, string][] = [
  ['uniform float linewidth;', `uniform float linewidth;
    #ifdef USE_FEATURE_FADE
      varying float vFade;
    #endif`],
  // Dash ends get the coverage ramp below instead of a hard discard.
  ['if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX', ''],
  ['vec4 diffuseColor = vec4( diffuse, alpha );', `
    // Exact coverage of a box-filtered stroke: distance to the centerline in device px.
    float cap = max( abs( vUv.y ) - 1.0, 0.0 );
    float r = length( vec2( vUv.x, cap ) ) * ( linewidth + ${PAD} ) * 0.5;
    float coverage = clamp( 0.5 * linewidth + 0.5 - r, 0.0, 1.0 );
    #ifdef USE_DASH
      float u = mod( vLineDistance + dashOffset, dashSize + gapSize );
      float px = max( fwidth( vLineDistance ), 1e-9 ); // line distance per device px
      coverage *= clamp( u / px + 0.5, 0.0, 1.0 ) * clamp( ( dashSize - u ) / px + 0.5, 0.0, 1.0 );
    #endif
    #ifdef USE_FEATURE_FADE
      coverage *= vFade;
    #endif
    vec4 diffuseColor = vec4( diffuse, alpha );`],
  // An edge ties in depth with the faces that meet there (log depth bypasses
  // polygonOffset): pull strokes a hair toward the eye.
  ['#include <logdepthbuf_fragment>', `#include <logdepthbuf_fragment>
    #ifdef USE_LOGDEPTHBUF
      if ( vIsPerspective != 0.0 ) gl_FragDepth -= ${DEPTH_BIAS};
    #endif`],
  // Coverage is light: apply it in linear space (gamma-correct edges; MAX
  // blending commutes with the sRGB curve, so this is exact). Opacity dims in
  // display space, as the palette was tuned.
  ['gl_FragColor = vec4( diffuseColor.rgb, alpha );', 'gl_FragColor = vec4( diffuseColor.rgb * coverage, coverage );'],
  ['#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\n\tgl_FragColor.rgb *= opacity;'],
];

export class VectorLineMaterial extends LineMaterial {
  readonly cssWidth: number;

  constructor({ color, width = 1.25, opacity = 1, dash, fade = false }: Stroke) {
    super({ color: color.getHex(), linewidth: width * pixelRatio, worldUnits: false, dashed: !!dash });
    this.cssWidth = width;
    this.opacity = opacity;
    if (dash) [this.dashSize, this.gapSize] = dash;
    if (fade) this.defines.USE_FEATURE_FADE = '';
    if (fade === 'solid') this.defines.FEATURE_FADE_SOLID = '';
    this.uniforms.resolution.value = resolution; // shared: one resize updates all
    this.transparent = true;
    this.depthWrite = false;
    this.blending = CustomBlending;
    this.blendEquation = MaxEquation;
    this.onBeforeCompile = (shader) => {
      shader.vertexShader = VERTEX.reduce((src, [from, to]) => patch(src, from, to), shader.vertexShader);
      shader.fragmentShader = FRAGMENT.reduce((src, [from, to]) => patch(src, from, to), shader.fragmentShader);
    };
    this.customProgramCacheKey = () => 'vector-line';
    materials.add(this);
  }

  get fades(): boolean {
    return 'USE_FEATURE_FADE' in this.defines;
  }
}

export function lineMaterial(stroke: Stroke): VectorLineMaterial {
  return new VectorLineMaterial(stroke);
}

/**
 * Static segments from a flat [x0,y0,z0, x1,y1,z1, …] list. A fading
 * material needs `features`: one size (render units) per segment.
 */
export function segments(positions: ArrayLike<number>, material: VectorLineMaterial, features?: ArrayLike<number>): LineSegments2 {
  return new LineSegments2(segmentGeometry(positions, material, features), material);
}

/** The geometry behind `segments`, for swapping into an existing object. */
export function segmentGeometry(positions: ArrayLike<number>, material: VectorLineMaterial, features?: ArrayLike<number>): LineSegmentsGeometry {
  const g = new LineSegmentsGeometry().setPositions(positions instanceof Float32Array ? positions : Float32Array.from(positions));
  if (material.fades) {
    const n = Math.floor(positions.length / 6);
    if (!features || features.length !== n) throw new Error('lines: a fading stroke needs one feature size per segment');
    g.setAttribute('instanceFeature', new InstancedBufferAttribute(Float32Array.from(features), 1));
  }
  if (material.dashed) new LineSegments2(g, material).computeLineDistances();
  return g;
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
