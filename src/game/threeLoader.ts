import type * as THREEType from 'three';
import type { RoomEnvironment as RoomEnvironmentType } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type ThreeNS = typeof THREEType;

export interface ThreeRuntime {
  THREE: ThreeNS;
  RoomEnvironment: typeof RoomEnvironmentType;
}

const THREE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/three@0.175.0';

let cachedRuntime: Promise<ThreeRuntime> | null = null;

/**
 * Loads Three.js and RoomEnvironment from jsDelivr CDN as ES modules.
 * The <script type="importmap"> in index.html maps bare "three" imports
 * inside addons to the exact same CDN module singleton.
 */
export function loadThreeFromCdn(): Promise<ThreeRuntime> {
  if (!cachedRuntime) {
    cachedRuntime = (async () => {
      const threeUrl = `${THREE_CDN_BASE}/build/three.module.js`;
      const roomEnvUrl = `${THREE_CDN_BASE}/examples/jsm/environments/RoomEnvironment.js`;

      const [THREE, envModule] = await Promise.all([
        import(/* @vite-ignore */ threeUrl) as Promise<ThreeNS>,
        import(/* @vite-ignore */ roomEnvUrl) as Promise<{
          RoomEnvironment: typeof RoomEnvironmentType;
        }>,
      ]);

      return {
        THREE,
        RoomEnvironment: envModule.RoomEnvironment,
      };
    })();
  }
  return cachedRuntime;
}
