import { describe, it, expect, expectTypeOf } from "vitest";

describe('Mocked Tests', () => {
    // Commit del test?
    describe('Mocked Tests for pipeline implementation.', () => {
        it('should Pass the test A', () => {
            const a = 1;
            const b = 2;
            expect(a).toBeDefined();
            expect(a).toBe(1);
            expectTypeOf(a).toBeNumber();

            expect(b).toBeDefined();
            expect(b).toBe(2);
            expectTypeOf(b).toBeNumber();

            expect(b).toBeGreaterThan(a);
        });
    });
});