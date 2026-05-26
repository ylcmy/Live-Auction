import { useState, useEffect, useRef } from 'react';
export function useCountdown(initialMs) {
    const [remainingMs, setRemainingMs] = useState(initialMs || 0);
    const [isUrgent, setIsUrgent] = useState(false);
    const endTimeRef = useRef(null);
    const rafRef = useRef(null);
    const [synced, setSynced] = useState(false);
    useEffect(() => {
        if (endTimeRef.current === null)
            return;
        const tick = () => {
            const remaining = Math.max(0, endTimeRef.current - Date.now());
            setRemainingMs(remaining);
            setIsUrgent(remaining < 10000);
            if (remaining > 0)
                rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current)
                cancelAnimationFrame(rafRef.current);
        };
    }, [synced]);
    const sync = (cs) => {
        endTimeRef.current = cs.serverTime + cs.remainingMs;
        setSynced((s) => !s);
    };
    const extend = (newRemainingMs) => {
        endTimeRef.current = Date.now() + newRemainingMs;
        setSynced((s) => !s);
    };
    return { remainingMs, isUrgent, sync, extend };
}
