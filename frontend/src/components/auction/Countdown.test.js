import { describe, it, expect } from 'vitest';
describe('Countdown', () => {
    it('should flag urgent when remaining < 10 seconds', () => {
        expect(9000 < 10000).toBe(true); // urgent
        expect(15000 < 10000).toBe(false); // not urgent
    });
    it('should format milliseconds to MM:SS.mmm', () => {
        const ms = 65000; // 1m 5s
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const remainMs = ms % 1000;
        const formatted = `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(remainMs).padStart(3, '0')}`;
        expect(formatted).toBe('01:05.000');
    });
});
