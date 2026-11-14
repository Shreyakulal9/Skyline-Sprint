import type * as THREEType from 'three';
import type { ThreeNS } from './threeLoader';
import type { GameMaterials } from './materials';

export interface PlayerCharacter {
  root: THREEType.Group;
  rig: THREEType.Group;
  contactShadow: THREEType.Mesh;
  shieldAura: THREEType.Mesh;
  magnetRing: THREEType.Mesh;
  updateAnimation: (params: {
    dt: number;
    elapsed: number;
    speed: number;
    yPos: number;
    isGrounded: boolean;
    isSliding: boolean;
    isIdle: boolean;
    isCrashed: boolean;
    laneDelta: number;
    hasShield: boolean;
    hasMagnet: boolean;
    invulnTime: number;
  }) => void;
  dispose: () => void;
}

/**
 * Builds a composite low-poly athletic runner character (10+ articulated parts)
 * grounded cleanly at y = 0 when standing.
 */
export function createPlayerCharacter(
  THREE: ThreeNS,
  materials: GameMaterials,
): PlayerCharacter {
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

  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.45,
      metalness: 0.1,
    }),
  );
  const shirtAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.35,
      metalness: 0.25,
    }),
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.05,
    }),
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      roughness: 0.65,
      metalness: 0.0,
    }),
  );
  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.42,
      metalness: 0.15,
    }),
  );
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.85,
    }),
  );
  const capMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.55,
      metalness: 0.05,
    }),
  );
  const magnetRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // Pelvis / Hip base (center of articulation at y = 0.88)
  const hipGroup = new THREE.Group();
  hipGroup.position.set(0, 0.88, 0);
  rig.add(hipGroup);

  const pelvis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.18, 0.28)), pantsMat);
  pelvis.castShadow = true;
  hipGroup.add(pelvis);

  // Torso group
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.08, 0);
  hipGroup.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.52, 0.62, 0.32)),
    jacketMat,
  );
  torsoMesh.position.set(0, 0.31, 0);
  torsoMesh.castShadow = true;
  torsoGroup.add(torsoMesh);

  // Chest racing stripe
  const stripe = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.54, 0.12, 0.34)),
    shirtAccentMat,
  );
  stripe.position.set(0, 0.36, 0);
  torsoGroup.add(stripe);

  // Athletic backpack
  const backpack = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.36, 0.44, 0.18)),
    materials.metalDark,
  );
  backpack.position.set(0, 0.32, 0.22);
  backpack.castShadow = true;
  torsoGroup.add(backpack);

  const packStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.08, 0.2)),
    shirtAccentMat,
  );
  packStrip.position.set(0, 0.42, 0.22);
  torsoGroup.add(packStrip);

  // Head group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0);
  torsoGroup.add(headGroup);

  const headMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.36, 0.36, 0.36)),
    skinMat,
  );
  headMesh.position.set(0, 0.18, 0);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Sleek sports visor facing forward (-Z)
  const visor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.38, 0.1, 0.12)),
    visorMat,
  );
  visor.position.set(0, 0.21, -0.15);
  headGroup.add(visor);

  // Cap + backward/forward brim
  const capCrown = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.39, 0.13, 0.39)),
    capMat,
  );
  capCrown.position.set(0, 0.36, 0);
  capCrown.castShadow = true;
  headGroup.add(capCrown);

  const capBrim = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.36, 0.04, 0.18)),
    capMat,
  );
  capBrim.position.set(0, 0.32, -0.24);
  headGroup.add(capBrim);

  // Helper to build articulated arm
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.35, 0.56, 0);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.15, 0.32, 0.16)),
      jacketMat,
    );
    upperArm.position.set(0, -0.14, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.13, 0.28, 0.14)),
      skinMat,
    );
    forearm.position.set(0, -0.13, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    const glove = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.14, 0.12, 0.15)),
      shirtAccentMat,
    );
    glove.position.set(0, -0.28, 0);
    elbow.add(glove);

    torsoGroup.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Helper to build articulated leg (hip -> thigh -> knee -> shin -> sneaker)
  const buildLeg = (side: -1 | 1) => {
    const hipJoint = new THREE.Group();
    hipJoint.position.set(side * 0.15, -0.05, 0);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.19, 0.4, 0.2)),
      pantsMat,
    );
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    hipJoint.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.4, 0);
    hipJoint.add(knee);

    const shin = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.16, 0.36, 0.17)),
      pantsMat,
    );
    shin.position.set(0, -0.18, 0);
    shin.castShadow = true;
    knee.add(shin);

    const sneaker = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.19, 0.13, 0.3)),
      shoeMat,
    );
    sneaker.position.set(0, -0.37, -0.05);
    sneaker.castShadow = true;
    knee.add(sneaker);

    hipGroup.add(hipJoint);
    return { hipJoint, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Ground contact shadow plane (stays anchored on track y = 0.03 while player jumps)
  const contactShadow = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.35, 1.35)),
    materials.contactShadow,
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.03, 0);
  root.add(contactShadow);

  // Protective Shield energy dome
  const shieldAura = new THREE.Mesh(
    trackGeo(new THREE.IcosahedronGeometry(1.28, 1)),
    materials.shieldGlow,
  );
  shieldAura.position.set(0, 1.05, 0);
  shieldAura.visible = false;
  rig.add(shieldAura);

  // Magnet ring pulse around waist
  const magnetRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.85, 1.05, 24)),
    magnetRingMat,
  );
  magnetRing.rotation.x = -Math.PI / 2;
  magnetRing.position.set(0, 0.85, 0);
  magnetRing.visible = false;
  rig.add(magnetRing);

  let runCycle = 0;

  const updateAnimation: PlayerCharacter['updateAnimation'] = ({
    dt,
    elapsed,
    speed,
    yPos,
    isGrounded,
    isSliding,
    isIdle,
    isCrashed,
    laneDelta,
    hasShield,
    hasMagnet,
    invulnTime,
  }) => {
    // Contact shadow tracks player height gracefully
    const heightFactor = Math.max(0.28, 1 - yPos * 0.22);
    contactShadow.scale.setScalar(heightFactor);
    contactShadow.position.y = 0.03 - yPos;

    // Blink visibility briefly during post-shield-hit invulnerability
    if (invulnTime > 0) {
      rig.visible = Math.floor(invulnTime * 18) % 2 === 0;
    } else {
      rig.visible = true;
    }

    // Power-up visual auras
    shieldAura.visible = hasShield && !isCrashed;
    if (shieldAura.visible) {
      shieldAura.rotation.y += dt * 1.4;
      shieldAura.rotation.x = Math.sin(elapsed * 2) * 0.15;
    }

    magnetRing.visible = hasMagnet && !isCrashed;
    if (magnetRing.visible) {
      const pulse = 0.9 + Math.sin(elapsed * 8) * 0.14;
      magnetRing.scale.setScalar(pulse);
      magnetRing.rotation.z += dt * 3;
    }

    if (isCrashed) {
      rig.rotation.x = THREE.MathUtils.damp(rig.rotation.x, -1.25, 10, dt);
      rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, 0.35, 10, dt);
      rig.position.y = THREE.MathUtils.damp(rig.position.y, -0.35, 10, dt);
      return;
    }

    // Bank into lane changes smoothly
    const targetRoll = THREE.MathUtils.clamp(-laneDelta * 0.24, -0.38, 0.38);
    rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, targetRoll, 14, dt);

    if (isIdle) {
      // Energetic ready-to-sprint idle bob
      const bob = Math.sin(elapsed * 5.2) * 0.04;
      rig.position.y = bob;
      rig.rotation.x = 0.08;
      hipGroup.rotation.x = 0;
      torsoGroup.rotation.x = 0.08;
      leftLeg.hipJoint.rotation.x = 0.15;
      rightLeg.hipJoint.rotation.x = -0.15;
      leftLeg.knee.rotation.x = -0.25;
      rightLeg.knee.rotation.x = -0.15;
      leftArm.shoulder.rotation.x = -0.35;
      rightArm.shoulder.rotation.x = 0.35;
      leftArm.elbow.rotation.x = 0.9;
      rightArm.elbow.rotation.x = 0.9;
      return;
    }

    if (isSliding) {
      // Low baseball/parkour slide pose: drops total height below 0.95m
      rig.position.y = THREE.MathUtils.damp(rig.position.y, -0.46, 18, dt);
      rig.rotation.x = THREE.MathUtils.damp(rig.rotation.x, 0.88, 18, dt);
      torsoGroup.rotation.x = THREE.MathUtils.damp(torsoGroup.rotation.x, 0.25, 16, dt);
      leftLeg.hipJoint.rotation.x = THREE.MathUtils.damp(leftLeg.hipJoint.rotation.x, 0.45, 16, dt);
      rightLeg.hipJoint.rotation.x = THREE.MathUtils.damp(rightLeg.hipJoint.rotation.x, -0.15, 16, dt);
      leftLeg.knee.rotation.x = THREE.MathUtils.damp(leftLeg.knee.rotation.x, -0.1, 16, dt);
      rightLeg.knee.rotation.x = THREE.MathUtils.damp(rightLeg.knee.rotation.x, -1.1, 16, dt);
      leftArm.shoulder.rotation.x = THREE.MathUtils.damp(leftArm.shoulder.rotation.x, -0.7, 16, dt);
      rightArm.shoulder.rotation.x = THREE.MathUtils.damp(rightArm.shoulder.rotation.x, 0.5, 16, dt);
      return;
    }

    // Reset slide transforms smoothly
    rig.rotation.x = THREE.MathUtils.damp(rig.rotation.x, 0, 16, dt);

    if (!isGrounded) {
      // Dynamic mid-air athletic jump pose
      rig.position.y = THREE.MathUtils.damp(rig.position.y, 0, 14, dt);
      torsoGroup.rotation.x = THREE.MathUtils.damp(torsoGroup.rotation.x, 0.2, 12, dt);
      leftLeg.hipJoint.rotation.x = THREE.MathUtils.damp(leftLeg.hipJoint.rotation.x, 0.85, 12, dt);
      leftLeg.knee.rotation.x = THREE.MathUtils.damp(leftLeg.knee.rotation.x, -1.15, 12, dt);
      rightLeg.hipJoint.rotation.x = THREE.MathUtils.damp(rightLeg.hipJoint.rotation.x, -0.45, 12, dt);
      rightLeg.knee.rotation.x = THREE.MathUtils.damp(rightLeg.knee.rotation.x, -0.55, 12, dt);
      leftArm.shoulder.rotation.x = THREE.MathUtils.damp(leftArm.shoulder.rotation.x, 1.35, 12, dt);
      rightArm.shoulder.rotation.x = THREE.MathUtils.damp(rightArm.shoulder.rotation.x, -0.75, 12, dt);
      leftArm.elbow.rotation.x = 0.7;
      rightArm.elbow.rotation.x = 0.9;
      return;
    }

    // Full sprint cycle proportional to forward speed
    runCycle += dt * (speed * 0.62);
    const swing = Math.sin(runCycle);
    const stride = 0.95;

    rig.position.y = Math.abs(Math.cos(runCycle)) * 0.09;
    torsoGroup.rotation.x = 0.22 + Math.sin(runCycle * 2) * 0.04;
    torsoGroup.rotation.y = -swing * 0.14;

    leftLeg.hipJoint.rotation.x = swing * stride;
    rightLeg.hipJoint.rotation.x = -swing * stride;

    // Bend trailing knee naturally
    leftLeg.knee.rotation.x = swing < 0 ? swing * 1.15 : -0.18;
    rightLeg.knee.rotation.x = swing > 0 ? -swing * 1.15 : -0.18;

    // Opposite arm swing
    leftArm.shoulder.rotation.x = -swing * 0.85;
    rightArm.shoulder.rotation.x = swing * 0.85;
    leftArm.elbow.rotation.x = 1.05;
    rightArm.elbow.rotation.x = 1.05;
  };

  return {
    root,
    rig,
    contactShadow,
    shieldAura,
    magnetRing,
    updateAnimation,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
