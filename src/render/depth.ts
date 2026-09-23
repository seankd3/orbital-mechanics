import { ShaderChunk } from 'three';
import { RENDER_SCALE } from '../constants';

/**
 * Logarithmic depth measured in meters. three writes log2(1 + w) with w in
 * render units (1 unit = 1,000 km): at craft range that curve is nearly flat,
 * and a 24-bit depth buffer resolves only about a meter at 30 m — edges tie
 * with the faces behind them. Scaling w to meters (renormalized so the far
 * plane still maps to 1) gives sub-millimeter depth at craft range and
 * still spans the solar system. Must run before any shader compiles.
 */
export function useMeterLogDepth(): void {
  const k = (1 / RENDER_SCALE).toFixed(1);
  const patch = (chunk: 'logdepthbuf_vertex' | 'logdepthbuf_fragment', from: string, to: string) => {
    if (!ShaderChunk[chunk].includes(from)) throw new Error(`log depth: ${chunk} changed upstream`);
    ShaderChunk[chunk] = ShaderChunk[chunk].replace(from, to);
  };
  patch('logdepthbuf_vertex', 'vFragDepth = 1.0 + gl_Position.w;', `vFragDepth = 1.0 + ${k} * gl_Position.w;`);
  // logDepthBufFC = 2 / log2(far + 1): recover far, then normalize by log2(k·far + 1).
  patch(
    'logdepthbuf_fragment',
    'log2( vFragDepth ) * logDepthBufFC * 0.5',
    `log2( vFragDepth ) / log2( ${k} * ( exp2( 2.0 / logDepthBufFC ) - 1.0 ) + 1.0 )`,
  );
}
