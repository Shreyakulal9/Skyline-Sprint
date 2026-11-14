import type * as THREEType from 'three';
import { loadThreeFromCdn, type ThreeNS } from './threeLoader';
import { createGameMaterials, type GameMaterials } from './materials';
import { createPlayerCharacter, type PlayerCharacter } from './player';
import { createTrackWorld, type TrackWorld } from './world';
import { createObjectPools, type ObjectPools } from './pools';
import { SoundEngine } from './audio';
import {
  GAME_CONFIG,
  type GameStatus,
  type HudSnapshot,
  type ObstacleKind,
} from './types';

export class EndlessRunnerEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private sound = new SoundEngine();

  private THREE: ThreeNS | null = null;
  private renderer: THREEType.WebGLRenderer | null = null;
  private scene: THREEType.Scene | null = null;
  private camera: THREEType.PerspectiveCamera | null = null;
  private envRenderTarget: THREEType.WebGLRenderTarget | null = null;

  private materials: GameMaterials | null = null;
  private player: PlayerCharacter | null = null;
  private world: TrackWorld | null = null;
  private pools: ObjectPools | null = null;

  private isSoftwareGl = false;
  private frameId = 0;
  private isDisposed = false;
  private lastTimestamp = 0;
  private elapsed = 0;

  // --- Gameplay State ---
  private status: GameStatus = 'start';
  private score = 0;
  private distance = 0;
  private coins = 0;
  private highScore = 0;
  private isNewBest = false;
  private speed: number = GAME_CONFIG.BASE_SPEED;

  // Player Kinematics
  private currentLane = 1; // 0 = left, 1 = center, 2 = right
  private playerX = 0;
  private playerY = 0;
  private playerVy = 0;
  private isGrounded = true;
  private isSliding = false;
  private slideTimer = 0;
  private pendingSlide = false;

  // Power-ups & Safety
  private magnetRemaining = 0;
  private hasShield = false;
  private invulnTime = 0;

  // Spawner State
  private distanceToNextWave = 20;
  private wavesSpawned = 0;
  private lastOpenLane = 1;

  // Camera Dynamics
  private camShake = 0;
  private camRoll = 0;
  private camPosX = 0;
  private camPosY = 4.65;

  // Touch Swipe Tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchHandled = false;

  // Throttle HUD React updates to ~20Hz unless discrete event occurs
  private hudSyncAccum = 0;

  // Reusable lookAt vector (Zero GC in render loop)
  private lookTargetVec: THREEType.Vector3 | null = null;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.highScore = this.readHighScore();
  }

  private readHighScore(): number {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.HIGH_SCORE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    try {
      localStorage.setItem(GAME_CONFIG.HIGH_SCORE_KEY, String(val));
    } catch {
      // Ignore storage failures
    }
  }

  public async init(): Promise<void> {
    try {
      const { THREE, RoomEnvironment } = await loadThreeFromCdn();
      if (this.isDisposed) return;

      this.THREE = THREE;
      this.lookTargetVec = new THREE.Vector3();

      // Detect software WebGL (SwiftShader / llvmpipe / WARP) via renderer string
      this.isSoftwareGl = (() => {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      const renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      );
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !this.isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      this.container.appendChild(renderer.domElement);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 320);
      camera.position.set(0, 4.65, 8.4);
      camera.lookAt(0, 1.35, -12);
      this.camera = camera;

      // Studio environment reflection for metallic coins & shields
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      this.envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = this.envRenderTarget.texture;
      roomEnv.dispose();
      pmremGenerator.dispose();

      // Build scene modules
      this.materials = createGameMaterials(THREE, renderer);
      this.world = createTrackWorld(THREE, scene, this.materials, this.isSoftwareGl);
      this.player = createPlayerCharacter(THREE, this.materials);
      scene.add(this.player.root);
      this.pools = createObjectPools(THREE, scene, this.materials, this.isSoftwareGl);

      if (!this.isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      this.bindEvents(renderer.domElement);
      this.emitHud(true);

      this.lastTimestamp = performance.now();
      this.scheduleNextFrame();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL renderer.';
      this.onHudUpdate({
        ...this.buildSnapshot(),
        ready: false,
        webglError: msg,
      });
    }
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('touchstart', this.handleTouchStart);
      canvas.removeEventListener('touchmove', this.handleTouchMove);
      canvas.removeEventListener('touchend', this.handleTouchEnd);
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    if (this.status === 'playing') {
      this.pause();
    }
  };

  private handleContextRestored = (): void => {
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;

    const code = e.code;
    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      if (this.status === 'playing' || this.status === 'paused') {
        this.togglePause();
      }
      return;
    }

    if (this.status === 'start' || this.status === 'gameover') {
      if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        this.start();
      }
      return;
    }

    if (this.status !== 'playing') return;

    if (code === 'ArrowLeft' || code === 'KeyA') {
      e.preventDefault();
      this.switchLane(-1);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      e.preventDefault();
      this.switchLane(1);
    } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') {
      e.preventDefault();
      this.triggerJump();
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      e.preventDefault();
      this.triggerSlide();
    }
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    this.sound.unlock();
    const t = e.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchHandled = false;
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.status !== 'playing' || this.touchHandled || e.touches.length !== 1) return;
    e.preventDefault();

    const t = e.touches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const threshold = 26;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    this.touchHandled = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.switchLane(dx > 0 ? 1 : -1);
    } else {
      if (dy < 0) {
        this.triggerJump();
      } else {
        this.triggerSlide();
      }
    }
  };

  private handleTouchEnd = (): void => {
    this.touchHandled = false;
  };

  // --- Player Actions ---
  public switchLane(dir: -1 | 1): void {
    const next = Math.max(0, Math.min(2, this.currentLane + dir));
    if (next !== this.currentLane) {
      this.currentLane = next;
      this.sound.playLaneSwitch();
    }
  }

  public triggerJump(): void {
    if (this.isGrounded) {
      this.playerVy = GAME_CONFIG.JUMP_VELOCITY;
      this.isGrounded = false;
      this.isSliding = false;
      this.slideTimer = 0;
      this.pendingSlide = false;
      this.sound.playJump();
    }
  }

  public triggerSlide(): void {
    if (!this.isGrounded) {
      // Fast-fall mid-air and immediately enter slide on landing
      if (this.playerVy > -16) {
        this.playerVy = -18;
      }
      this.pendingSlide = true;
      return;
    }

    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = GAME_CONFIG.SLIDE_DURATION;
      this.sound.playSlide();
    } else {
      // Extend slide slightly if tapped again
      this.slideTimer = Math.max(this.slideTimer, GAME_CONFIG.SLIDE_DURATION * 0.75);
    }
  }

  // --- Game Lifecycle ---
  public start(): void {
    this.sound.unlock();
    this.resetRunState();
    this.status = 'playing';
    this.emitHud(true);
  }

  public pause(): void {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.emitHud(true);
  }

  public resume(): void {
    if (this.status !== 'paused') return;
    this.lastTimestamp = performance.now();
    this.status = 'playing';
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.status === 'playing') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  public toggleMute(): void {
    this.sound.unlock();
    this.sound.toggleMute();
    this.emitHud(true);
  }

  private resetRunState(): void {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.isNewBest = false;
    this.speed = GAME_CONFIG.BASE_SPEED;

    this.currentLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.pendingSlide = false;

    this.magnetRemaining = 0;
    this.hasShield = false;
    this.invulnTime = 0;

    this.distanceToNextWave = 14;
    this.wavesSpawned = 0;
    this.lastOpenLane = 1;

    this.camShake = 0;
    this.camRoll = 0;
    this.camPosX = 0;
    this.camPosY = 4.65;

    this.pools?.resetAll();
    this.world?.reset();
    if (this.player) {
      this.player.root.position.set(0, 0, GAME_CONFIG.PLAYER_Z);
      this.player.rig.position.set(0, 0, 0);
      this.player.rig.rotation.set(0, 0, 0);
      this.player.rig.visible = true;
    }

    // Seed an inviting initial coin trail straight ahead on run start
    if (this.pools) {
      for (let i = 0; i < 5; i++) {
        this.pools.spawnCoin(1, 0.85, -24 - i * 3.0);
      }
    }
  }

  // --- Wave Spawner (Guaranteed Passable Lane) ---
  private spawnNextWave(): void {
    if (!this.pools) return;

    this.wavesSpawned++;
    const spawnZ = -132;
    const difficulty = Math.min(
      1,
      (this.speed - GAME_CONFIG.BASE_SPEED) /
        (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED),
    );

    // Choose a guaranteed passable lane (adjacent or same as previous for fair flow)
    const laneChoices = [0, 1, 2].filter(
      (l) => Math.abs(l - this.lastOpenLane) <= 1 || difficulty < 0.35,
    );
    const openLane = laneChoices[Math.floor(Math.random() * laneChoices.length)];
    this.lastOpenLane = openLane;

    const patternRoll = Math.random();
    const obstacleTypes: ObstacleKind[] = ['low', 'tall', 'block'];

    if (patternRoll < 0.42) {
      // Pattern 1: Two lanes blocked, 1 guaranteed open lane with coin line
      for (let lane = 0; lane < 3; lane++) {
        if (lane === openLane) continue;
        const kind =
          obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        this.pools.spawnObstacle(kind, lane, spawnZ);
      }
      for (let i = 0; i < 5; i++) {
        this.pools.spawnCoin(openLane, 0.85, spawnZ - 6 + i * 3.0);
      }
    } else if (patternRoll < 0.68) {
      // Pattern 2: Low jump barrier in openLane with parabolic coin arc above it + blocks in other lanes
      const lowLane = openLane;
      this.pools.spawnObstacle('low', lowLane, spawnZ);

      // Keep at least one side lane open OR another jumpable low barrier so player always has options
      const otherLanes = [0, 1, 2].filter((l) => l !== lowLane);
      const blockedLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
      this.pools.spawnObstacle('block', blockedLane, spawnZ);

      // Parabolic coin arc guiding the jump over lowLane
      for (let i = -2; i <= 2; i++) {
        const t = (i + 2) / 4; // 0..1
        const arcY = 0.9 + Math.sin(t * Math.PI) * 1.65;
        this.pools.spawnCoin(lowLane, arcY, spawnZ + i * 2.4);
      }
    } else if (patternRoll < 0.88) {
      // Pattern 3: Overhead slide gantry with coins underneath + 1 side block
      this.pools.spawnObstacle('tall', openLane, spawnZ);
      const otherLanes = [0, 1, 2].filter((l) => l !== openLane);
      const blockedLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
      this.pools.spawnObstacle(Math.random() < 0.5 ? 'block' : 'low', blockedLane, spawnZ);

      // Coins lined up low underneath the overhead gantry
      for (let i = -2; i <= 2; i++) {
        this.pools.spawnCoin(openLane, 0.62, spawnZ + i * 2.5);
      }
    } else {
      // Pattern 4: Single obstacle + diagonal lane-switching coin trail
      const blockedLane = (openLane + 1) % 3;
      this.pools.spawnObstacle('block', blockedLane, spawnZ);
      const altLane = [0, 1, 2].find((l) => l !== blockedLane && l !== openLane) ?? openLane;

      for (let i = 0; i < 6; i++) {
        const laneForCoin = i < 3 ? openLane : altLane;
        this.pools.spawnCoin(laneForCoin, 0.85, spawnZ - 7 + i * 2.8);
      }
    }

    // Periodically spawn a Magnet or Shield power-up in a guaranteed safe lane
    if (this.wavesSpawned % 5 === 0) {
      const powerKind = Math.random() < 0.52 ? 'magnet' : 'shield';
      this.pools.spawnPowerUp(powerKind, openLane, spawnZ - 11);
    }

    // Fair spacing scales with speed so player always has reaction time
    const minSpacing = 22 + difficulty * 13;
    const extraSpacing = Math.random() * 6;
    this.distanceToNextWave = minSpacing + extraSpacing;
  }

  // --- Main Simulation Step ---
  private updatePlaying(dt: number): void {
    const THREE = this.THREE!;
    const pools = this.pools!;

    // Ramp up forward speed smoothly
    this.speed = Math.min(
      GAME_CONFIG.MAX_SPEED,
      this.speed + GAME_CONFIG.SPEED_RAMP_PER_SEC * dt,
    );

    // Distance & score accumulation
    const dz = this.speed * dt;
    this.distance += dz;
    this.score = Math.floor(this.distance);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewBest = true;
    }

    // Active power-up timers
    if (this.magnetRemaining > 0) {
      this.magnetRemaining = Math.max(0, this.magnetRemaining - dt);
    }
    if (this.invulnTime > 0) {
      this.invulnTime = Math.max(0, this.invulnTime - dt);
    }

    // Horizontal lane damping
    const targetX = GAME_CONFIG.LANE_POSITIONS[this.currentLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 16, dt);

    // Vertical jump / gravity physics
    if (!this.isGrounded) {
      const gravMult = this.pendingSlide ? GAME_CONFIG.FAST_FALL_MULTIPLIER : 1;
      this.playerVy += GAME_CONFIG.GRAVITY * gravMult * dt;
      this.playerY += this.playerVy * dt;

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.isGrounded = true;

        if (this.pendingSlide) {
          this.pendingSlide = false;
          this.isSliding = true;
          this.slideTimer = GAME_CONFIG.SLIDE_DURATION;
          this.sound.playSlide();
        }
      }
    }

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.slideTimer = 0;
      }
    }

    // Scroll world segments
    this.world?.update(dt, this.speed);

    // Spawn obstacle & coin waves
    this.distanceToNextWave -= dz;
    if (this.distanceToNextWave <= 0) {
      this.spawnNextWave();
    }

    // Player AABB bounds (tight & fair feel)
    const pMinX = this.playerX - 0.34;
    const pMaxX = this.playerX + 0.34;
    const pMinY = this.playerY;
    const pMaxY = this.playerY + (this.isSliding ? 0.88 : 1.72);
    const pMinZ = GAME_CONFIG.PLAYER_Z - 0.34;
    const pMaxZ = GAME_CONFIG.PLAYER_Z + 0.34;

    // Update & collide Obstacles
    for (let i = 0; i < pools.obstacles.length; i++) {
      const obs = pools.obstacles[i];
      if (!obs.active) continue;

      obs.mesh.position.z += dz;
      const oz = obs.mesh.position.z;

      if (oz > 16) {
        obs.active = false;
        obs.mesh.visible = false;
        continue;
      }

      // Broad-phase Z check before full AABB
      if (oz + obs.halfDepth >= pMinZ && oz - obs.halfDepth <= pMaxZ) {
        const ox = obs.mesh.position.x;
        const overlapX = pMaxX >= ox - obs.halfWidth && pMinX <= ox + obs.halfWidth;
        const overlapY = pMaxY >= obs.minY && pMinY <= obs.maxY;

        if (overlapX && overlapY) {
          if (this.hasShield) {
            // Absorb hit with shield!
            this.hasShield = false;
            this.invulnTime = GAME_CONFIG.INVULN_DURATION;
            obs.active = false;
            obs.mesh.visible = false;
            this.camShake = 0.45;
            this.sound.playShieldBreak();
            pools.emitBurst(ox, Math.max(0.8, pMinY + 0.8), oz, 0x22d3ee, 18);
            this.emitHud(true);
          } else if (this.invulnTime <= 0) {
            // Crash -> Game Over
            this.handleCrash(ox, oz);
            return;
          }
        }
      }
    }

    // Update & collect Coins (with Magnet attraction)
    const magnetActive = this.magnetRemaining > 0;
    const magnetTargetY = this.playerY + 0.95;

    for (let i = 0; i < pools.coins.length; i++) {
      const c = pools.coins[i];
      if (!c.active) continue;

      c.mesh.position.z += dz;
      const cx = c.mesh.position.x;
      const cy = c.mesh.position.y;
      const cz = c.mesh.position.z;

      if (cz > 14) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }

      if (magnetActive) {
        const dx = this.playerX - cx;
        const dy = magnetTargetY - cy;
        const dzPlayer = GAME_CONFIG.PLAYER_Z - cz;
        const distSq = dx * dx + dy * dy + dzPlayer * dzPlayer;
        if (c.magnetized || distSq < GAME_CONFIG.MAGNET_RADIUS * GAME_CONFIG.MAGNET_RADIUS) {
          c.magnetized = true;
          const dist = Math.sqrt(distSq) || 0.001;
          const pull = Math.min(1, (38 * dt) / dist);
          c.mesh.position.x += dx * pull;
          c.mesh.position.y += dy * pull;
          c.mesh.position.z += dzPlayer * pull;
        }
      }

      // Coin pickup collision
      const nx = c.mesh.position.x;
      const ny = c.mesh.position.y;
      const nz = c.mesh.position.z;
      if (
        Math.abs(nx - this.playerX) < 0.92 &&
        Math.abs(nz - GAME_CONFIG.PLAYER_Z) < 0.92 &&
        ny >= pMinY - 0.5 &&
        ny <= pMaxY + 0.55
      ) {
        c.active = false;
        c.mesh.visible = false;
        this.coins += 1;
        this.sound.playCoin();
        pools.emitBurst(nx, ny, nz, 0xfbbf24, 8);
        this.emitHud(true);
      }
    }

    // Update & collect Power-ups
    for (let i = 0; i < pools.powerUps.length; i++) {
      const p = pools.powerUps[i];
      if (!p.active) continue;

      p.mesh.position.z += dz;
      const px = p.mesh.position.x;
      const py = p.mesh.position.y;
      const pz = p.mesh.position.z;

      if (pz > 14) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (
        Math.abs(px - this.playerX) < 1.0 &&
        Math.abs(pz - GAME_CONFIG.PLAYER_Z) < 1.0 &&
        py >= pMinY - 0.6 &&
        py <= pMaxY + 0.65
      ) {
        p.active = false;
        p.mesh.visible = false;
        if (p.kind === 'magnet') {
          this.magnetRemaining = GAME_CONFIG.MAGNET_DURATION;
          pools.emitBurst(px, py, pz, 0xf43f5e, 14);
        } else {
          this.hasShield = true;
          pools.emitBurst(px, py, pz, 0x06b6d4, 14);
        }
        this.sound.playPowerUp();
        this.emitHud(true);
      }
    }

    // Update animated visuals
    pools.updateEffects(dt, this.elapsed, this.speed);
  }

  private handleCrash(ox: number, oz: number): void {
    this.status = 'gameover';
    this.camShake = 0.85;
    this.sound.playCrash();
    this.pools?.emitBurst(ox, 1.0, oz, 0xf97316, 22);
    this.pools?.emitBurst(this.playerX, this.playerY + 0.9, 0, 0xfbbf24, 12);

    if (this.score >= this.highScore) {
      this.highScore = this.score;
      this.saveHighScore(this.highScore);
    }
    this.emitHud(true);
  }

  private updateCameraAndPlayer(dt: number): void {
    const THREE = this.THREE!;
    const camera = this.camera!;

    if (this.player) {
      this.player.root.position.set(this.playerX, this.playerY, GAME_CONFIG.PLAYER_Z);
      const targetX = GAME_CONFIG.LANE_POSITIONS[this.currentLane];
      this.player.updateAnimation({
        dt,
        elapsed: this.elapsed,
        speed: this.speed,
        yPos: this.playerY,
        isGrounded: this.isGrounded,
        isSliding: this.isSliding,
        isIdle: this.status === 'start',
        isCrashed: this.status === 'gameover',
        laneDelta: targetX - this.playerX,
        hasShield: this.hasShield,
        hasMagnet: this.magnetRemaining > 0,
        invulnTime: this.invulnTime,
      });
    }

    // Smooth camera follow + lane tilt + FOV speed widening + impact shake
    const targetCamX = this.playerX * 0.56;
    const targetCamY = 4.65 + this.playerY * 0.3;
    this.camPosX = THREE.MathUtils.damp(this.camPosX, targetCamX, 10, dt);
    this.camPosY = THREE.MathUtils.damp(this.camPosY, targetCamY, 9, dt);

    let shakeX = 0;
    let shakeY = 0;
    if (this.camShake > 0.001) {
      shakeX = (Math.random() - 0.5) * this.camShake * 0.7;
      shakeY = (Math.random() - 0.5) * this.camShake * 0.55;
      this.camShake = THREE.MathUtils.damp(this.camShake, 0, 7.5, dt);
    } else {
      this.camShake = 0;
    }

    camera.position.set(this.camPosX + shakeX, this.camPosY + shakeY, 8.4);

    if (this.lookTargetVec) {
      this.lookTargetVec.set(this.camPosX * 0.65, 1.35 + this.playerY * 0.25, -13);
      camera.lookAt(this.lookTargetVec);
    }

    const targetX = GAME_CONFIG.LANE_POSITIONS[this.currentLane];
    const desiredRoll =
      this.status === 'playing'
        ? THREE.MathUtils.clamp((this.playerX - targetX) * 0.025, -0.06, 0.06)
        : 0;
    this.camRoll = THREE.MathUtils.damp(this.camRoll, desiredRoll, 11, dt);
    camera.rotation.z += this.camRoll;

    // Subtle FOV ramp with speed
    const speedRatio =
      (this.speed - GAME_CONFIG.BASE_SPEED) /
      (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED);
    const targetFov = 58 + THREE.MathUtils.clamp(speedRatio, 0, 1) * 10;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
      camera.updateProjectionMatrix();
    }
  }

  private tick = (): void => {
    if (this.isDisposed || !this.renderer || !this.scene || !this.camera) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.status === 'playing') {
      this.elapsed += dt;
      this.updatePlaying(dt);
      this.updateCameraAndPlayer(dt);

      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.05) {
        this.hudSyncAccum = 0;
        this.emitHud(false);
      }
    } else if (this.status === 'start') {
      this.elapsed += dt;
      // Gentle scenic scroll on start screen so the world feels alive
      this.world?.update(dt, 7.5);
      this.updateCameraAndPlayer(dt);
    } else if (this.status === 'gameover') {
      this.elapsed += dt;
      this.pools?.updateEffects(dt, this.elapsed, 0);
      this.updateCameraAndPlayer(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.isDisposed || !this.renderer) return;

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    if (!this.renderer || this.isDisposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private buildSnapshot(): HudSnapshot {
    return {
      status: this.status,
      score: this.score,
      coins: this.coins,
      highScore: this.highScore,
      isNewBest: this.isNewBest,
      magnetRemaining: this.magnetRemaining,
      magnetDuration: GAME_CONFIG.MAGNET_DURATION,
      hasShield: this.hasShield,
      speed: Math.round(this.speed),
      isMuted: this.sound.isMuted(),
      ready: true,
      webglError: null,
    };
  }

  private emitHud(force: boolean): void {
    if (force) this.hudSyncAccum = 0;
    this.onHudUpdate(this.buildSnapshot());
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.unbindEvents();

    this.pools?.dispose();
    this.player?.dispose();
    this.world?.dispose();
    this.materials?.dispose();
    this.envRenderTarget?.dispose();
    this.sound.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      const el = this.renderer.domElement;
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      this.renderer = null;
    }
  }
}
