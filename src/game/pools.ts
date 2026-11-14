import type * as THREEType from 'three';
import type { ThreeNS } from './threeLoader';
import type { GameMaterials } from './materials';
import type { ObstacleKind, PowerUpKind } from './types';

export interface PooledObstacle {
  active: boolean;
  kind: ObstacleKind;
  lane: number;
  mesh: THREEType.Group;
  minY: number;
  maxY: number;
  halfWidth: number;
  halfDepth: number;
}

export interface PooledCoin {
  active: boolean;
  lane: number;
  magnetized: boolean;
  mesh: THREEType.Group;
  phase: number;
}

export interface PooledPowerUp {
  active: boolean;
  kind: PowerUpKind;
  lane: number;
  mesh: THREEType.Group;
  phase: number;
}

interface BurstParticle {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  mesh: THREEType.Mesh;
}

export interface ObjectPools {
  obstacles: PooledObstacle[];
  coins: PooledCoin[];
  powerUps: PooledPowerUp[];
  spawnObstacle: (kind: ObstacleKind, lane: number, z: number) => PooledObstacle | null;
  spawnCoin: (lane: number, y: number, z: number) => PooledCoin | null;
  spawnPowerUp: (kind: PowerUpKind, lane: number, z: number) => PooledPowerUp | null;
  emitBurst: (x: number, y: number, z: number, colorHex: number, count?: number) => void;
  updateEffects: (dt: number, elapsed: number, forwardSpeed: number) => void;
  resetAll: () => void;
  dispose: () => void;
}

/**
 * Pre-allocated object pools for obstacles, spinning coins, power-ups, and burst particles.
 * Eliminates runtime geometry/mesh allocation during gameplay for steady 60 FPS.
 */
export function createObjectPools(
  THREE: ThreeNS,
  scene: THREEType.Scene,
  materials: GameMaterials,
  isSoftwareGl: boolean,
): ObjectPools {
  const geometries: THREEType.BufferGeometry[] = [];
  const particleMaterials: THREEType.MeshBasicMaterial[] = [];

  const trackGeo = <T extends THREEType.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // --- Obstacle Builders (Multi-part composite models grounded at y = 0) ---
  const footGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.16, 0.65));
  const postGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.92, 0.18));
  const lowBarGeo = trackGeo(new THREE.BoxGeometry(2.15, 0.36, 0.24));
  const lowTrimGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.09, 0.28));

  const createLowBarrier = (): THREEType.Group => {
    const g = new THREE.Group();
    for (const sx of [-0.88, 0.88]) {
      const foot = new THREE.Mesh(footGeo, materials.metalDark);
      foot.position.set(sx, 0.08, 0);
      foot.castShadow = !isSoftwareGl;
      g.add(foot);

      const post = new THREE.Mesh(postGeo, materials.metalSteel);
      post.position.set(sx, 0.54, 0);
      post.castShadow = !isSoftwareGl;
      g.add(post);
    }

    const bar = new THREE.Mesh(lowBarGeo, materials.hazardStripe);
    bar.position.set(0, 0.86, 0);
    bar.castShadow = !isSoftwareGl;
    g.add(bar);

    const topTrim = new THREE.Mesh(lowTrimGeo, materials.barrierOrange);
    topTrim.position.set(0, 1.07, 0);
    g.add(topTrim);

    return g;
  };

  const tallPillarGeo = trackGeo(new THREE.BoxGeometry(0.24, 3.1, 0.32));
  const tallFootGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.22, 0.68));
  const tallHeaderGeo = trackGeo(new THREE.BoxGeometry(2.35, 1.35, 0.42));
  const tallSignGeo = trackGeo(new THREE.BoxGeometry(2.15, 0.36, 0.46));

  const createTallBarrier = (): THREEType.Group => {
    const g = new THREE.Group();
    for (const sx of [-0.98, 0.98]) {
      const foot = new THREE.Mesh(tallFootGeo, materials.metalDark);
      foot.position.set(sx, 0.11, 0);
      g.add(foot);

      const pillar = new THREE.Mesh(tallPillarGeo, materials.metalSteel);
      pillar.position.set(sx, 1.55, 0);
      pillar.castShadow = !isSoftwareGl;
      g.add(pillar);
    }

    // Overhead gantry leaving clearance underneath (y = 0 to y = 1.25 open for sliding!)
    const header = new THREE.Mesh(tallHeaderGeo, materials.barrierOrange);
    header.position.set(0, 2.02, 0);
    header.castShadow = !isSoftwareGl;
    g.add(header);

    const sign = new THREE.Mesh(tallSignGeo, materials.hazardStripe);
    sign.position.set(0, 1.55, 0);
    g.add(sign);

    const topCap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.45, 0.16, 0.5)),
      materials.metalDark,
    );
    topCap.position.set(0, 2.75, 0);
    g.add(topCap);

    return g;
  };

  const blockCoreGeo = trackGeo(new THREE.BoxGeometry(2.05, 2.65, 1.45));
  const blockFrameGeo = trackGeo(new THREE.BoxGeometry(2.16, 0.24, 1.54));
  const blockFrontPlateGeo = trackGeo(new THREE.BoxGeometry(1.65, 1.5, 1.52));
  const blockBeaconGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.24, 0.26, 8));

  const createFullBlock = (): THREEType.Group => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(blockCoreGeo, materials.crateBody);
    core.position.set(0, 1.325, 0);
    core.castShadow = !isSoftwareGl;
    core.receiveShadow = true;
    g.add(core);

    const baseFrame = new THREE.Mesh(blockFrameGeo, materials.crateAccent);
    baseFrame.position.set(0, 0.12, 0);
    g.add(baseFrame);

    const topFrame = new THREE.Mesh(blockFrameGeo, materials.crateAccent);
    topFrame.position.set(0, 2.55, 0);
    g.add(topFrame);

    const frontPlate = new THREE.Mesh(blockFrontPlateGeo, materials.hazardStripe);
    frontPlate.position.set(0, 1.35, 0);
    g.add(frontPlate);

    const beacon = new THREE.Mesh(blockBeaconGeo, materials.barrierOrange);
    beacon.position.set(0, 2.8, 0);
    g.add(beacon);

    return g;
  };

  // --- Coin Builder ---
  const coinOuterGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14));
  coinOuterGeo.rotateX(Math.PI / 2);
  const coinInnerGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.13, 6));
  coinInnerGeo.rotateX(Math.PI / 2);

  const createCoinMesh = (): THREEType.Group => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(coinOuterGeo, materials.coinGold);
    outer.castShadow = !isSoftwareGl;
    g.add(outer);

    const inner = new THREE.Mesh(coinInnerGeo, materials.coinRim);
    g.add(inner);
    return g;
  };

  // --- Power-Up Builders ---
  const magArcGeo = trackGeo(new THREE.TorusGeometry(0.36, 0.11, 8, 16, Math.PI));
  const magTipGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10));
  const haloGeo = trackGeo(new THREE.TorusGeometry(0.66, 0.04, 6, 20));

  const createMagnetMesh = (): THREEType.Group => {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(magArcGeo, materials.magnetRed);
    arc.position.y = 0.08;
    arc.castShadow = !isSoftwareGl;
    g.add(arc);

    for (const sx of [-0.36, 0.36]) {
      const tip = new THREE.Mesh(magTipGeo, materials.magnetSilver);
      tip.position.set(sx, -0.06, 0);
      g.add(tip);
    }

    const halo = new THREE.Mesh(haloGeo, materials.coinRim);
    halo.rotation.x = Math.PI / 3;
    g.add(halo);
    return g;
  };

  const shieldCoreGeo = trackGeo(new THREE.OctahedronGeometry(0.48, 0));
  const shieldRingGeo = trackGeo(new THREE.TorusGeometry(0.66, 0.05, 6, 18));

  const createShieldMesh = (): THREEType.Group => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(shieldCoreGeo, materials.shieldCyan);
    core.castShadow = !isSoftwareGl;
    g.add(core);

    const ring = new THREE.Mesh(shieldRingGeo, materials.magnetSilver);
    ring.rotation.x = Math.PI / 2.4;
    g.add(ring);
    return g;
  };

  // --- Allocate Pools ---
  const obstacles: PooledObstacle[] = [];
  const addObstacles = (kind: ObstacleKind, count: number) => {
    for (let i = 0; i < count; i++) {
      let mesh: THREEType.Group;
      let minY = 0;
      let maxY = 1.05;
      let halfWidth = 0.92;
      let halfDepth = 0.25;

      if (kind === 'low') {
        mesh = createLowBarrier();
        minY = 0;
        maxY = 1.05;
        halfWidth = 0.92;
        halfDepth = 0.26;
      } else if (kind === 'tall') {
        mesh = createTallBarrier();
        minY = 1.25; // Open underneath for sliding!
        maxY = 2.85;
        halfWidth = 0.96;
        halfDepth = 0.32;
      } else {
        mesh = createFullBlock();
        minY = 0;
        maxY = 2.85;
        halfWidth = 0.95;
        halfDepth = 0.72;
      }

      mesh.visible = false;
      scene.add(mesh);
      obstacles.push({
        active: false,
        kind,
        lane: 1,
        mesh,
        minY,
        maxY,
        halfWidth,
        halfDepth,
      });
    }
  };

  addObstacles('low', 16);
  addObstacles('tall', 14);
  addObstacles('block', 16);

  const coins: PooledCoin[] = [];
  for (let i = 0; i < 120; i++) {
    const mesh = createCoinMesh();
    mesh.visible = false;
    scene.add(mesh);
    coins.push({
      active: false,
      lane: 1,
      magnetized: false,
      mesh,
      phase: (i * 0.45) % (Math.PI * 2),
    });
  }

  const powerUps: PooledPowerUp[] = [];
  for (let i = 0; i < 6; i++) {
    const mag = createMagnetMesh();
    mag.visible = false;
    scene.add(mag);
    powerUps.push({ active: false, kind: 'magnet', lane: 1, mesh: mag, phase: i * 0.7 });

    const shd = createShieldMesh();
    shd.visible = false;
    scene.add(shd);
    powerUps.push({ active: false, kind: 'shield', lane: 1, mesh: shd, phase: i * 1.1 });
  }

  // --- Pooled 3D Burst Particles ---
  const particleGeo = trackGeo(new THREE.OctahedronGeometry(0.14, 0));
  const particles: BurstParticle[] = [];
  for (let i = 0; i < 96; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 1,
    });
    particleMaterials.push(mat);
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({
      active: false,
      life: 0,
      maxLife: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      mesh,
    });
  }

  const LANE_X = [-2.65, 0, 2.65];

  const spawnObstacle = (
    kind: ObstacleKind,
    lane: number,
    z: number,
  ): PooledObstacle | null => {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs.active && obs.kind === kind) {
        obs.active = true;
        obs.lane = lane;
        obs.mesh.position.set(LANE_X[lane], 0, z);
        obs.mesh.visible = true;
        return obs;
      }
    }
    return null;
  };

  const spawnCoin = (lane: number, y: number, z: number): PooledCoin | null => {
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (!c.active) {
        c.active = true;
        c.lane = lane;
        c.magnetized = false;
        c.mesh.position.set(LANE_X[lane], y, z);
        c.mesh.rotation.y = c.phase;
        c.mesh.visible = true;
        return c;
      }
    }
    return null;
  };

  const spawnPowerUp = (
    kind: PowerUpKind,
    lane: number,
    z: number,
  ): PooledPowerUp | null => {
    for (let i = 0; i < powerUps.length; i++) {
      const p = powerUps[i];
      if (!p.active && p.kind === kind) {
        p.active = true;
        p.lane = lane;
        p.mesh.position.set(LANE_X[lane], 1.15, z);
        p.mesh.visible = true;
        return p;
      }
    }
    return null;
  };

  const emitBurst = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 10,
  ): void => {
    let spawned = 0;
    for (let i = 0; i < particles.length && spawned < count; i++) {
      const p = particles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.36 + Math.random() * 0.25;
        const angle = Math.random() * Math.PI * 2;
        const radialSpeed = 2.5 + Math.random() * 5.2;
        p.vx = Math.cos(angle) * radialSpeed;
        p.vy = 2.2 + Math.random() * 5.5;
        p.vz = Math.sin(angle) * radialSpeed;

        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.7);
        const mat = p.mesh.material as THREEType.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 1;
        p.mesh.visible = true;
        spawned++;
      }
    }
  };

  const updateEffects = (dt: number, elapsed: number, forwardSpeed: number): void => {
    // Rotate active coins
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (c.active) {
        c.mesh.rotation.y += dt * 4.2;
      }
    }

    // Float & spin active power-ups
    for (let i = 0; i < powerUps.length; i++) {
      const p = powerUps[i];
      if (p.active) {
        p.mesh.rotation.y += dt * 2.8;
        p.mesh.position.y = 1.18 + Math.sin(elapsed * 4.5 + p.phase) * 0.16;
      }
    }

    // Update burst particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += (p.vz + forwardSpeed * 0.25) * dt;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.05, t));
      (p.mesh.material as THREEType.MeshBasicMaterial).opacity = t;
    }
  };

  const resetAll = (): void => {
    obstacles.forEach((o) => {
      o.active = false;
      o.mesh.visible = false;
    });
    coins.forEach((c) => {
      c.active = false;
      c.magnetized = false;
      c.mesh.visible = false;
    });
    powerUps.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
    particles.forEach((pt) => {
      pt.active = false;
      pt.mesh.visible = false;
    });
  };

  return {
    obstacles,
    coins,
    powerUps,
    spawnObstacle,
    spawnCoin,
    spawnPowerUp,
    emitBurst,
    updateEffects,
    resetAll,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      particleMaterials.forEach((m) => m.dispose());
    },
  };
}
