/**
 * Chess clock hook.
 *  - Manages independent timers for white and black.
 *  - Active side ticks down every 100ms.
 *  - Adds increment to the side that just moved (Fischer-style).
 *  - Surfaces a `timeoutColor` when one side reaches zero.
 *
 * timeControl shape: { base: seconds, inc: seconds, label } | null (unlimited)
 */
import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 100;

export function useClock(timeControl) {
  const [white, setWhite] = useState(timeControl ? timeControl.base : 0);
  const [black, setBlack] = useState(timeControl ? timeControl.base : 0);
  const [active, setActive] = useState(null); // 'w' | 'b' | null
  const [timeoutColor, setTimeoutColor] = useState(null);
  const lastTickRef = useRef(null);
  const enabled = Boolean(timeControl);

  // Reset whenever the time control changes.
  useEffect(() => {
    setWhite(timeControl ? timeControl.base : 0);
    setBlack(timeControl ? timeControl.base : 0);
    setActive(null);
    setTimeoutColor(null);
    lastTickRef.current = null;
  }, [timeControl]);

  useEffect(() => {
    if (!enabled || !active || timeoutColor) return undefined;
    lastTickRef.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (active === "w") {
        setWhite((t) => {
          const nt = t - dt;
          if (nt <= 0) { setTimeoutColor("w"); return 0; }
          return nt;
        });
      } else if (active === "b") {
        setBlack((t) => {
          const nt = t - dt;
          if (nt <= 0) { setTimeoutColor("b"); return 0; }
          return nt;
        });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, active, timeoutColor]);

  /** Call after a successful move to apply increment + switch active side. */
  const onMove = useCallback((movedColor) => {
    if (!enabled) return;
    if (movedColor === "w") {
      setWhite((t) => t + (timeControl.inc || 0));
      setActive("b");
    } else {
      setBlack((t) => t + (timeControl.inc || 0));
      setActive("w");
    }
  }, [enabled, timeControl]);

  const start = useCallback((color = "w") => {
    if (!enabled) return;
    setActive(color);
  }, [enabled]);

  const stop = useCallback(() => setActive(null), []);

  const reset = useCallback(() => {
    setWhite(timeControl ? timeControl.base : 0);
    setBlack(timeControl ? timeControl.base : 0);
    setActive(null);
    setTimeoutColor(null);
  }, [timeControl]);

  /** Hard-set a side's remaining seconds (used when syncing from opponent). */
  const setRemaining = useCallback((color, seconds) => {
    if (color === "w") setWhite(Math.max(0, seconds));
    else setBlack(Math.max(0, seconds));
  }, []);

  return {
    enabled,
    white,
    black,
    active,
    timeoutColor,
    onMove,
    start,
    stop,
    reset,
    setRemaining,
  };
}

export const TIME_CONTROLS = [
  { label: "1+0",     base: 60,    inc: 0,  group: "Bullet"    },
  { label: "3+0",     base: 180,   inc: 0,  group: "Blitz"     },
  { label: "5+0",     base: 300,   inc: 0,  group: "Blitz"     },
  { label: "10+0",    base: 600,   inc: 0,  group: "Rapid"     },
  { label: "15+10",   base: 900,   inc: 10, group: "Rapid"     },
  { label: "30+0",    base: 1800,  inc: 0,  group: "Classical" },
];

export const UNLIMITED = { label: "∞", base: 0, inc: 0, group: "Unlimited" };

export function findTimeControl(label) {
  if (!label || label === "∞" || label === "unlimited") return null;
  return TIME_CONTROLS.find((tc) => tc.label === label) || null;
}

export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.ceil(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (seconds < 10) {
    // show one decimal in the last 10 seconds for urgency
    const tenths = Math.floor((seconds % 1) * 10);
    return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
