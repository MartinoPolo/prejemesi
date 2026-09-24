import { describe, expect, it } from 'vitest';
import { GIFT_MOTION_EASING, giftMotionDuration } from './gift_motion_timing.js';

describe('gift collection motion timing', () => {
	it('holds a minimum duration and leaves long distance travel uncapped', () => {
		expect(giftMotionDuration(0)).toBe(325);
		expect(giftMotionDuration(1500)).toBe(1000);
		expect(giftMotionDuration(3000)).toBe(2000);
		expect(giftMotionDuration(1000.1)).toBe(667);
		expect(GIFT_MOTION_EASING).toBe('cubic-bezier(0.2, 0.7, 0.3, 1)');
	});
});
