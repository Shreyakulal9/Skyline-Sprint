import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Magnet,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EndlessRunnerEngine } from './game/engine';
import { GAME_CONFIG, type HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  status: 'start',
  score: 0,
  coins: 0,
  highScore: 0,
  isNewBest: false,
  magnetRemaining: 0,
  magnetDuration: GAME_CONFIG.MAGNET_DURATION,
  hasShield: false,
  speed: GAME_CONFIG.BASE_SPEED,
  isMuted: false,
  ready: false,
  webglError: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EndlessRunnerEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new EndlessRunnerEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    void engine.init();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const magnetProgress = Math.max(
    0,
    Math.min(100, (hud.magnetRemaining / hud.magnetDuration) * 100),
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white select-none">
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Skyline Sprint 3D Game Viewport"
      />

      {/* Loading / WebGL Error Fallback */}
      {!hud.ready && !hud.webglError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 px-6 text-center">
          <h1
            className="text-3xl font-extrabold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Skyline Sprint
          </h1>
          <p className="mt-2 text-sm text-slate-300">Loading 3D skyway arena...</p>
        </div>
      )}

      {hud.webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6">
          <div className="max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 text-center shadow-2xl">
            <h2
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              3D Graphics Unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-300">{hud.webglError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {/* Top In-Game HUD */}
      {hud.ready && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
          {/* Score & Coins Readout */}
          <div className="pointer-events-auto flex items-center gap-5 rounded-2xl border border-white/15 bg-slate-950/82 px-4 py-2.5 shadow-lg">
            <div>
              <div className="text-[11px] font-medium tracking-wide text-slate-400">
                Distance
              </div>
              <div
                className="text-xl sm:text-2xl font-bold leading-tight text-white tabular-nums"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {hud.score.toLocaleString()} <span className="text-sm font-medium text-slate-400">m</span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/12" aria-hidden="true" />

            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
              <div>
                <div className="text-[11px] font-medium tracking-wide text-slate-400">
                  Coins
                </div>
                <div
                  className="text-xl sm:text-2xl font-bold leading-tight text-amber-300 tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {hud.coins.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Active Power-Up Status (Only visible when active) */}
          {(hud.magnetRemaining > 0 || hud.hasShield) && hud.status === 'playing' && (
            <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/82 px-4 py-2.5 shadow-lg">
              {hud.hasShield && (
                <div className="flex items-center gap-2 text-cyan-300">
                  <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    Shield Ready
                  </span>
                </div>
              )}

              {hud.hasShield && hud.magnetRemaining > 0 && (
                <div className="h-6 w-px bg-white/12" aria-hidden="true" />
              )}

              {hud.magnetRemaining > 0 && (
                <div className="flex items-center gap-2.5">
                  <Magnet className="h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
                  <div className="w-24">
                    <div className="flex items-center justify-between text-xs font-semibold text-rose-200">
                      <span>Magnet</span>
                      <span
                        className="tabular-nums"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {hud.magnetRemaining.toFixed(1)}s
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-rose-400 transition-[width] duration-75"
                        style={{ width: `${magnetProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Controls: Mute & Pause */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => engineRef.current?.toggleMute()}
              aria-label={hud.isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={hud.isMuted ? 'Unmute (M)' : 'Mute (M)'}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 cursor-pointer"
            >
              {hud.isMuted ? (
                <VolumeX className="h-5 w-5 text-slate-400" aria-hidden="true" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" aria-hidden="true" />
              )}
            </button>

            {(hud.status === 'playing' || hud.status === 'paused') && (
              <button
                type="button"
                onClick={() => engineRef.current?.togglePause()}
                aria-label={hud.status === 'paused' ? 'Resume game' : 'Pause game'}
                title={hud.status === 'paused' ? 'Resume (P)' : 'Pause (P)'}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 cursor-pointer"
              >
                {hud.status === 'paused' ? (
                  <Play className="h-5 w-5 text-amber-400" aria-hidden="true" />
                ) : (
                  <Pause className="h-5 w-5 text-white" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </header>
      )}

      {/* Mobile Compact Power-up Bar (Below Top HUD when active) */}
      {hud.ready &&
        hud.status === 'playing' &&
        (hud.magnetRemaining > 0 || hud.hasShield) && (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4 sm:hidden">
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-slate-950/85 px-3.5 py-2 shadow-lg">
              {hud.hasShield && (
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold">Shield</span>
                </div>
              )}
              {hud.magnetRemaining > 0 && (
                <div className="flex items-center gap-2 text-rose-300">
                  <Magnet className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {hud.magnetRemaining.toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Start Screen Overlay */}
      {hud.ready && hud.status === 'start' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/88 p-7 sm:p-8 text-center shadow-2xl">
            <h1
              className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Skyline Sprint
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-300">
              Dash across the elevated track, dodge barriers, and grab coins and power-ups.
            </p>

            {hud.highScore > 0 && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-amber-300">
                <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Best Run</span>
                <span aria-hidden="true">·</span>
                <span
                  className="font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {hud.highScore.toLocaleString()} m
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => engineRef.current?.start()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-400 px-6 py-4 text-lg font-extrabold text-slate-950 shadow-lg transition-transform duration-150 hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              Play
            </button>

            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400 space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <span>A / D or ← → Lanes</span>
                <span aria-hidden="true">·</span>
                <span>W / ↑ / Space Jump</span>
                <span aria-hidden="true">·</span>
                <span>S / ↓ Slide</span>
              </div>
              <div>Swipe in any direction on touch screens · P to Pause</div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {hud.ready && hud.status === 'paused' && (
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-950/92 p-7 text-center shadow-2xl">
            <h2
              className="text-3xl font-extrabold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Paused
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Press P or Resume to continue your run.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.resume()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 text-base font-bold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                Resume
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.start()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restart Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {hud.ready && hud.status === 'gameover' && (
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/92 p-7 sm:p-8 text-center shadow-2xl">
            <div className="text-xs font-semibold tracking-wider text-rose-400">
              {hud.isNewBest ? 'New Personal Best' : 'Run Complete'}
            </div>
            <h2
              className="mt-1 text-3xl sm:text-4xl font-extrabold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Game Over
            </h2>

            <div className="mt-6 grid grid-cols-3 gap-3 border-y border-white/10 py-5">
              <div>
                <div className="text-xs text-slate-400">Distance</div>
                <div
                  className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {hud.score.toLocaleString()}m
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Coins</div>
                <div
                  className="mt-1 text-xl sm:text-2xl font-bold text-amber-300 tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {hud.coins.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Best</div>
                <div
                  className="mt-1 text-xl sm:text-2xl font-bold text-cyan-300 tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {hud.highScore.toLocaleString()}m
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => engineRef.current?.start()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-400 px-6 py-4 text-lg font-extrabold text-slate-950 shadow-lg transition-transform duration-150 hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
