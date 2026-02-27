import { EmotionMetrics } from './faceMesh';

/** Clamp a value to the [0, 100] range. */
const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

export class HeuristicTracker {
  private lastMousePos = { x: 0, y: 0 };
  private lastMouseTime = 0;
  private mouseVelocity = 0;
  private clickTimestamps: number[] = [];
  
  // Baseline tracking for NaN/gap fallback
  private baselineFrustration = 0;
  private baselineJoy = 0;
  private samples = 0;
  private currentGameState: string = 'idle';
  private lastComputeTime = 0;
  private cachedMetrics: EmotionMetrics | null = null;

  private mouseMoveListener: ((e: MouseEvent) => void);
  private clickListener: ((e: MouseEvent) => void);
  private touchStartListener: ((e: TouchEvent) => void);
  private touchMoveListener: ((e: TouchEvent) => void);
  private isTouchDevice: boolean;

  constructor() {
    this.isTouchDevice = navigator.maxTouchPoints > 0;

    this.mouseMoveListener = (e: MouseEvent) => {
      this.handlePointerMove(e.clientX, e.clientY);
    };

    this.clickListener = () => {
      this.handlePointerClick();
    };

    this.touchStartListener = (e: TouchEvent) => {
      if (e.touches[0]) {
        this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        this.handlePointerClick(); // Touch start counts as a click/tap
      }
    };

    this.touchMoveListener = (e: TouchEvent) => {
      if (e.touches[0]) {
        this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', this.mouseMoveListener);
    window.addEventListener('mousedown', this.clickListener);
    window.addEventListener('touchstart', this.touchStartListener, { passive: true });
    window.addEventListener('touchmove', this.touchMoveListener, { passive: true });
  }

  private handlePointerMove(x: number, y: number) {
    const now = performance.now();
    if (this.lastMouseTime > 0) {
      const dx = (x || 0) - this.lastMousePos.x;
      const dy = (y || 0) - this.lastMousePos.y;
      const dt = now - this.lastMouseTime;
      
      if (dt > 0) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const v = distance / dt; // px per ms
        this.mouseVelocity = (this.mouseVelocity * 0.8) + (v * 0.2);
      }
    }
    this.lastMousePos = { x: x || 0, y: y || 0 };
    this.lastMouseTime = now;
  }

  private handlePointerClick() {
    const now = performance.now();
    this.clickTimestamps.push(now);
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < 5000);
  }

  public getMetrics(): EmotionMetrics {
    const now = performance.now();
    
    // ── Ambiguity 2: Anti-Thrashing Heuristic Refs ──────────────────────────
    // Only recalculate heavy sentiment scores if throttle interval (500ms) has passed
    if (this.cachedMetrics && (now - this.lastComputeTime < 500)) {
      return this.cachedMetrics;
    }

    this.lastComputeTime = now;
    
    // Decay velocity if mouse stops
    if (now - this.lastMouseTime > 100) {
      this.mouseVelocity *= 0.9;
    }

    const v = Math.min(this.mouseVelocity, 10);
    
    // Rage clicks: multiple clicks in a short window
    const recentClicks = this.clickTimestamps.filter(t => now - t < 5000).length;
    const rageClickFactor = recentClicks > 2 ? (recentClicks - 2) * 15 : 0;

    // Erratic, rapid movement + rage clicks map to Frustration
    let frustration = (v > 2) ? clamp100((v - 2) * 12 + rageClickFactor) : 0;
    
    // Fast, smooth interactions (high velocity, few clicks = swift decisive action) map to Joy
    let joy = (v > 1 && recentClicks <= 2) ? clamp100(v * 8) : 0;

    // ── Contextual Context Layer ───────────────────────────────────────────
    if (this.currentGameState === 'wrong_answer_streak') {
      frustration = clamp100(frustration * 1.5); // Amplify frustration on failure
      joy = 0;
    } else if (this.currentGameState === 'correct_answer_streak') {
      joy = clamp100(joy * 1.4); // Reward fast correct streaks
      frustration = 0;
    } else if (this.currentGameState === 'idle' && !this.isTouchDevice) {
      // ── Ambiguity 1: Tablet Bypass ─────────────────────────────────────
      // Tablets have no hover/dwell state; bypass this logic for touch devices.
      if (v < 0.5 && now - this.lastMouseTime < 2000) {
        frustration = clamp100((now - this.lastMouseTime) / 100); 
      }
    }

    // Fallback to average baseline if calculation yields NaN (failsafe)
    if (isNaN(frustration)) {
      frustration = this.samples > 0 ? this.baselineFrustration / this.samples : 0;
    }
    if (isNaN(joy)) {
      joy = this.samples > 0 ? this.baselineJoy / this.samples : 0;
    }

    // Update baseline
    this.baselineFrustration += frustration;
    this.baselineJoy += joy;
    this.samples++;

    const pseudoGazeWander = clamp100(v * 15);
    const pseudoTension = clamp100(v * 8);

    this.cachedMetrics = {
      tension: pseudoTension,
      gazeWander: pseudoGazeWander,
      joy,
      frustration,
      confusion: 0,
      isHeuristic: true,
    };

    return this.cachedMetrics;
  }

  public setGameState(state: string) {
    this.currentGameState = state;
  }

  public destroy() {
    window.removeEventListener('mousemove', this.mouseMoveListener);
    window.removeEventListener('mousedown', this.clickListener);
    window.removeEventListener('touchstart', this.touchStartListener);
    window.removeEventListener('touchmove', this.touchMoveListener);
  }
}
