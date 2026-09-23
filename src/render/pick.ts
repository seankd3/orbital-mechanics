import { Raycaster, Sphere, Vector2, Vector3, type Camera } from 'three';

const ray = new Raycaster();

/**
 * Where a screen point's ray first meets a sphere (a body's surface), in
 * render units relative to the sphere's center; null if it misses.
 * `x`, `y` are client pixels.
 */
export function pickSphere(camera: Camera, x: number, y: number, center: Vector3, radius: number): Vector3 | null {
  ray.setFromCamera(new Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
  const hit = ray.ray.intersectSphere(new Sphere(center, radius), new Vector3());
  return hit ? hit.sub(center) : null;
}
