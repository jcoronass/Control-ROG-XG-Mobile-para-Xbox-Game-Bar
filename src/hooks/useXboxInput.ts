import { useEffect, useRef, useState } from 'react';

export interface XboxInputCallbacks {
  onButtonX?: () => void;
  onButtonY?: () => void;
  onButtonB?: () => void;
  onToggleCompact?: () => void;
  enabled?: boolean;
}

export function useXboxInput({
  onButtonX,
  onButtonY,
  onButtonB,
  onToggleCompact,
  enabled = true,
}: XboxInputCallbacks) {
  const [connectedControllerName, setConnectedControllerName] = useState<string | null>(null);
  const prevButtonsRef = useRef<boolean[]>([]);
  const callbacksRef = useRef({ onButtonX, onButtonY, onButtonB, onToggleCompact });

  useEffect(() => {
    callbacksRef.current = { onButtonX, onButtonY, onButtonB, onToggleCompact };
  }, [onButtonX, onButtonY, onButtonB, onToggleCompact]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        callbacksRef.current.onButtonX?.();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        callbacksRef.current.onButtonY?.();
      } else if (e.key === 'Escape') {
        callbacksRef.current.onButtonB?.();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        callbacksRef.current.onToggleCompact?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;

    let rafId = 0;

    const pollGamepads = () => {
      const pads = navigator.getGamepads();
      const activePad = pads.find((p) => p && p.connected) ?? null;

      if (activePad) {
        setConnectedControllerName((prev) => (prev === activePad.id ? prev : activePad.id));

        const buttons = activePad.buttons.map((b) => b.pressed);
        const prev = prevButtonsRef.current;

        // Standard Gamepad Mapping:
        // 1: B, 2: X, 3: Y, 4: LB, 5: RB
        if (buttons[2] && !prev[2]) {
          callbacksRef.current.onButtonX?.();
        }
        if (buttons[3] && !prev[3]) {
          callbacksRef.current.onButtonY?.();
        }
        if (buttons[1] && !prev[1]) {
          callbacksRef.current.onButtonB?.();
        }
        if ((buttons[4] && !prev[4]) || (buttons[5] && !prev[5])) {
          callbacksRef.current.onToggleCompact?.();
        }

        prevButtonsRef.current = buttons;
      } else {
        setConnectedControllerName((prev) => (prev === null ? prev : null));
        prevButtonsRef.current = [];
      }

      rafId = requestAnimationFrame(pollGamepads);
    };

    rafId = requestAnimationFrame(pollGamepads);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return { connectedControllerName };
}
