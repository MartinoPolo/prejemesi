import { describe, expect, it } from 'vitest';
import { GIFT_CROP_TARGET_SPECS } from './crop_targets.js';

describe('GIFT_CROP_TARGET_SPECS.square (issue #183)', () => {
	it('pins the gift card/list surface to the 4:3 family, not the retired 1:1 shape', () => {
		expect(GIFT_CROP_TARGET_SPECS.square.aspect).toBe(4 / 3);
		expect(GIFT_CROP_TARGET_SPECS.square.cssAspect).toBe('4 / 3');
	});
});
