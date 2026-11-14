import type * as THREEType from 'three';
import type { ThreeNS } from './threeLoader';
import type { GameMaterials } from './materials';
import { GAME_CONFIG } from './types';

export interface TrackWorld {
  skyDome: THREEType.Mesh;
  update: (dt: number, speed: number) => void;
  reset: () => void;
  dispose: () => void;
}

/**
 * Builds the sunlit sky dome, 3-point + hemisphere lighting rig, horizon fog,
 * and recyclable 3-lane track segments with looping trees, pillars, and towers.
 */
export function createTrackWorld(
  THREE: ThreeNS,
  scene: THREEType.Scene,
  materials: GameMaterials,
  isSoftwareGl: boolean,
): TrackWorld {
  const geometries: THREEType.BufferGeometry[] = [];
  const localMaterials: THREEType.Material[] = [];

  const trackGeo = <T extends THREEType.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREEType.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };

  // --- Horizon Fog & Gradient Sky Dome ---
  const horizonColor = new THREE.Color(0xcde8f9);
  scene.background = horizonColor;
  scene.fog = new THREE.Fog(0xcde8f9, 48, 160);

  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x1e6fb8) },
        uMidColor: { value: new THREE.Color(0x6ec6f5) },
        uHorizonColor: { value: new THREE.Color(0xfde3cc) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t1 = smoothstep(-0.08, 0.25, h);
          float t2 = smoothstep(0.18, 0.78, h);
          vec3 col = mix(uHorizonColor, uMidColor, t1);
          col = mix(col, uTopColor, t2);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );

  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(240, 24, 16)), skyMat);
  scene.add(skyDome);

  // --- Warm/Cool Lighting Rig ---
  const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x8b6f4e, 0.9);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
  sunLight.position.set(16, 28, 14);
  if (!isSoftwareGl) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 90;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 24;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
  }
  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.target.position.set(0, 0, -14);

  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
  rimLight.position.set(-14, 12, -26);
  scene.add(rimLight);

  // --- Lower Valley Ground Plane (prevents empty void below viaduct) ---
  const valleyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b6e5c,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  const valleyGround = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(360, 360)),
    valleyMat,
  );
  valleyGround.rotation.x = -Math.PI / 2;
  valleyGround.position.set(0, -8.5, -60);
  valleyGround.receiveShadow = false;
  scene.add(valleyGround);

  // --- Shared Scenery Geometries ---
  const deckGeo = trackGeo(
    new THREE.BoxGeometry(GAME_CONFIG.TRACK_WIDTH, 0.9, GAME_CONFIG.SEGMENT_LENGTH),
  );
  const curbGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.28, GAME_CONFIG.SEGMENT_LENGTH));
  const railPostGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.72, 0.18));
  const railBarGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.12, GAME_CONFIG.SEGMENT_LENGTH));
  const dashGeo = trackGeo(new THREE.PlaneGeometry(0.18, 2.2));
  const pierGeo = trackGeo(new THREE.BoxGeometry(1.5, 9, 1.8));
  const crossBeamGeo = trackGeo(new THREE.BoxGeometry(GAME_CONFIG.TRACK_WIDTH + 1.2, 0.7, 1.4));

  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.38, 2.2, 7));
  const coneLowerGeo = trackGeo(new THREE.ConeGeometry(1.65, 2.6, 7));
  const coneMidGeo = trackGeo(new THREE.ConeGeometry(1.28, 2.2, 7));
  const coneTopGeo = trackGeo(new THREE.ConeGeometry(0.85, 1.8, 7));

  const pillarBaseGeo = trackGeo(new THREE.BoxGeometry(1.7, 0.7, 1.7));
  const pillarShaftGeo = trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 5.2, 8));
  const pillarCapGeo = trackGeo(new THREE.BoxGeometry(1.85, 0.55, 1.85));

  const roofTrimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5, metalness: 0.25 }),
  );
  const towerAccentMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.2 }),
  );

  // --- Helper builders for multi-part low-poly scenery ---
  const createTree = (scale: number, colorIdx: number): THREEType.Group => {
    const g = new THREE.Group();
    const foliageMat = materials.foliagePalette[colorIdx % materials.foliagePalette.length];

    const trunk = new THREE.Mesh(trunkGeo, materials.trunkWood);
    trunk.position.y = 1.1;
    trunk.castShadow = !isSoftwareGl;
    g.add(trunk);

    const tier1 = new THREE.Mesh(coneLowerGeo, foliageMat);
    tier1.position.y = 2.9;
    tier1.castShadow = !isSoftwareGl;
    g.add(tier1);

    const tier2 = new THREE.Mesh(coneMidGeo, foliageMat);
    tier2.position.y = 4.25;
    tier2.rotation.y = 0.45;
    g.add(tier2);

    const tier3 = new THREE.Mesh(coneTopGeo, foliageMat);
    tier3.position.y = 5.4;
    tier3.rotation.y = 0.9;
    g.add(tier3);

    g.scale.setScalar(scale);
    return g;
  };

  const createTemplePillar = (heightScale: number): THREEType.Group => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(pillarBaseGeo, materials.pillarStone);
    base.position.y = 0.35;
    g.add(base);

    const shaft = new THREE.Mesh(pillarShaftGeo, materials.pillarStone);
    shaft.position.y = 3.3;
    shaft.castShadow = !isSoftwareGl;
    g.add(shaft);

    const cap = new THREE.Mesh(pillarCapGeo, materials.pillarStone);
    cap.position.y = 6.1;
    g.add(cap);

    const topBlock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.1, 0.55, 1.1)),
      towerAccentMat,
    );
    topBlock.position.y = 6.65;
    g.add(topBlock);

    g.scale.set(1, heightScale, 1);
    return g;
  };

  const createCityBuilding = (
    width: number,
    height: number,
    depth: number,
    facadeIdx: number,
  ): THREEType.Group => {
    const g = new THREE.Group();
    const bodyGeo = trackGeo(new THREE.BoxGeometry(width, height, depth));
    const body = new THREE.Mesh(
      bodyGeo,
      materials.buildingFacades[facadeIdx % materials.buildingFacades.length],
    );
    body.position.y = height / 2;
    g.add(body);

    const parapet = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width + 0.35, 0.5, depth + 0.35)),
      roofTrimMat,
    );
    parapet.position.y = height + 0.25;
    g.add(parapet);

    const penthouse = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width * 0.48, 1.3, depth * 0.48)),
      towerAccentMat,
    );
    penthouse.position.y = height + 1.1;
    g.add(penthouse);

    const spire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 6)),
      materials.metalSteel,
    );
    spire.position.y = height + 2.8;
    g.add(spire);

    return g;
  };

  // --- Build Recyclable Track Segments ---
  const segments: THREEType.Group[] = [];
  const segLen = GAME_CONFIG.SEGMENT_LENGTH;
  const segCount = GAME_CONFIG.SEGMENT_COUNT;

  for (let s = 0; s < segCount; s++) {
    const seg = new THREE.Group();

    // Main track deck (top surface at y = 0)
    const deck = new THREE.Mesh(deckGeo, materials.trackDeck);
    deck.position.y = -0.45;
    deck.receiveShadow = true;
    seg.add(deck);

    // Side curbs & guardrails
    for (const side of [-1, 1] as const) {
      const curbX = side * (GAME_CONFIG.TRACK_WIDTH / 2 + 0.15);
      const curb = new THREE.Mesh(curbGeo, materials.curbStone);
      curb.position.set(curbX, 0.08, 0);
      curb.receiveShadow = true;
      seg.add(curb);

      const railBar = new THREE.Mesh(railBarGeo, materials.metalSteel);
      railBar.position.set(curbX, 0.72, 0);
      seg.add(railBar);

      for (let p = -9; p <= 9; p += 6) {
        const post = new THREE.Mesh(railPostGeo, materials.metalDark);
        post.position.set(curbX, 0.42, p);
        post.castShadow = !isSoftwareGl;
        seg.add(post);
      }
    }

    // Dashed lane dividers between the 3 lanes
    const dividerXs = [-GAME_CONFIG.LANE_WIDTH / 2, GAME_CONFIG.LANE_WIDTH / 2];
    for (const dx of dividerXs) {
      for (let z = -segLen / 2 + 2; z < segLen / 2; z += 4.8) {
        const dash = new THREE.Mesh(dashGeo, materials.laneStripe);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, 0.02, z);
        dash.receiveShadow = true;
        seg.add(dash);
      }
    }

    // Under-track viaduct crossbeam & support columns
    const crossBeam = new THREE.Mesh(crossBeamGeo, materials.underDeck);
    crossBeam.position.set(0, -1.25, 0);
    seg.add(crossBeam);

    for (const side of [-1, 1] as const) {
      const pier = new THREE.Mesh(pierGeo, materials.underDeck);
      pier.position.set(side * 3.4, -5.8, 0);
      seg.add(pier);
    }

    // Side Scenery (placed along outer banks from y = -8.5 up to skyline)
    for (const side of [-1, 1] as const) {
      // Near embankment trees & temple pillars
      const nearZPositions = [-8, 0, 8];
      nearZPositions.forEach((nz, idx) => {
        if ((s + idx + (side > 0 ? 1 : 0)) % 3 === 0) {
          const pillar = createTemplePillar(0.95 + ((s + idx) % 3) * 0.22);
          pillar.position.set(side * (7.4 + (idx % 2) * 1.1), -2.6, nz);
          seg.add(pillar);
        } else {
          const tree = createTree(0.95 + ((s * 3 + idx) % 4) * 0.14, s + idx);
          tree.position.set(side * (7.2 + (idx % 2) * 1.8), -3.2, nz);
          seg.add(tree);
        }
      });

      // Mid-ground trees on valley floor
      const valleyTree = createTree(1.45 + (s % 3) * 0.25, s + 2);
      valleyTree.position.set(side * (12.5 + (s % 2) * 2.5), -8.5, -4);
      seg.add(valleyTree);

      // Outer skyline low-poly towers
      const bWidth = 5.4 + (s % 3) * 1.2;
      const bHeight = 16 + ((s * 7 + (side > 0 ? 3 : 0)) % 5) * 4.5;
      const bDepth = 5.8 + ((s + 1) % 2) * 1.5;
      const building = createCityBuilding(
        bWidth,
        bHeight,
        bDepth,
        s + (side > 0 ? 2 : 0),
      );
      building.position.set(side * (19 + (s % 3) * 2.4), -8.5, 2);
      seg.add(building);
    }

    seg.position.z = -s * segLen;
    scene.add(seg);
    segments.push(seg);
  }

  const reset = () => {
    segments.forEach((seg, idx) => {
      seg.position.z = -idx * segLen;
    });
  };

  const update = (dt: number, speed: number) => {
    const dz = speed * dt;
    const totalLength = segCount * segLen;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      seg.position.z += dz;
      if (seg.position.z > segLen * 1.15) {
        seg.position.z -= totalLength;
      }
    }
  };

  return {
    skyDome,
    update,
    reset,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
