export function giftMotionDuration(distance: number): number {
	return Math.ceil(Math.max(325, (distance / 1500) * 1000));
}
