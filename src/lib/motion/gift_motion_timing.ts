export const GIFT_MOTION_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

export function giftMotionDuration(distance: number): number {
	return Math.ceil(Math.max(325, (distance / 1500) * 1000));
}
