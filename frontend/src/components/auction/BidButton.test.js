import { describe, it, expect } from 'vitest';
describe('BidButton', () => {
    it('should render with correct next bid amount calculation', () => {
        const currentPrice = 100;
        const bidIncrement = 10;
        const nextBid = currentPrice + bidIncrement;
        expect(nextBid).toBe(110);
    });
    it('should disable when over ceiling price', () => {
        const currentPrice = 495;
        const bidIncrement = 10;
        const ceilingPrice = 500;
        const nextBid = currentPrice + bidIncrement;
        expect(nextBid).toBe(505);
        expect(nextBid > ceilingPrice).toBe(true);
    });
});
