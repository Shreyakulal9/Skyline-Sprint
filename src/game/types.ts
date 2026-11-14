export type GameStatus = 'start' | 'playing' | 'paused' | 'gameover';

export type ObstacleKind = 'low' | 'tall' | 'block';

export type PowerUpKind = 'magnet' | 'shield';

export interface HudSnapshot {
  status: GameStatus;
  score: number;
  coins: number;
  highScore: number;
  isNewBest: boolean;
  magnetRemaining: number; // seconds (0 to 8)
  magnetDuration: number;
  hasShield: boolean;
  speed: number;
  isMuted: boolean;
  ready: boolean;
  webglError: string | null;
}

export const GAME_CONFIG = {
  LANE_WIDTH: 2.65,
  LANE_POSITIONS: [-2.65, 0, 2.65] as const,
  TRACK_WIDTH: 9.2,
  SEGMENT_LENGTH: 24,
  SEGMENT_COUNT: 8,
  PLAYER_Z: 0,
  BASE_SPEED: 19,
  MAX_SPEED: 44,
  SPEED_RAMP_PER_SEC: 0.36,
  JUMP_VELOCITY: 14.8,
  GRAVITY: -38,
  FAST_FALL_MULTIPLIER: 2.35,
  SLIDE_DURATION: 0.68,
  MAGNET_DURATION: 8.0,
  MAGNET_RADIUS: 11.5,
  INVULN_DURATION: 1.15,
  HIGH_SCORE_KEY: 'skyline_sprint_high_score_v1',
  MUTE_KEY: 'skyline_sprint_muted_v1',
} as const;
