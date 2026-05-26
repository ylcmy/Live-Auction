import { useCallback, useRef } from 'react';
/**
 * Optional audio cue hook using Web Audio API.
 * Provides tick and ding sounds for bid feedback.
 * Marked as optional — the app works silently when AudioContext
 * is unavailable or the user has not interacted with the page.
 */
export function useAudio() {
    const ctxRef = useRef(null);
    const getContext = useCallback(() => {
        if (!ctxRef.current) {
            try {
                ctxRef.current = new AudioContext();
            }
            catch {
                return null;
            }
        }
        return ctxRef.current;
    }, []);
    /** Short tick (800 Hz, 50 ms) — suitable for countdown warning ticks. */
    const playTick = useCallback(() => {
        try {
            const ctx = getContext();
            if (!ctx)
                return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        }
        catch {
            /* Audio not supported */
        }
    }, [getContext]);
    /** Ding (1200 Hz, 300 ms with fade-out) — suitable for new bid / outbid. */
    const playDing = useCallback(() => {
        try {
            const ctx = getContext();
            if (!ctx)
                return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 1200;
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
        }
        catch {
            /* Audio not supported */
        }
    }, [getContext]);
    return { playTick, playDing };
}
