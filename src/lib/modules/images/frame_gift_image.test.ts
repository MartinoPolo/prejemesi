import { describe, expect, it } from 'vitest';
import { main } from '../../../../scripts/frame_gift_image.js';
import { FULL_CROP_RECT, framedGiftImageMeta } from './crop.js';

function runCommand(args: string[]) {
	const logged: string[] = [];
	const errors: string[] = [];
	const exitCode = main(args, {
		log: (message) => logged.push(message),
		error: (message) => errors.push(message),
	});
	return { exitCode, stdout: logged.join('\n'), stderr: errors.join('\n') };
}

describe('scripts/frame_gift_image.ts', () => {
	it('prints the default framing of the whole image on white', () => {
		const { exitCode, stdout } = runCommand(['--width', '800', '--height', '1141']);
		expect(exitCode).toBe(0);
		expect(JSON.parse(stdout)).toEqual(
			framedGiftImageMeta({
				width: 800,
				height: 1141,
				box: FULL_CROP_RECT,
				bgColor: '#ffffff',
			}),
		);
	});

	it('rejects a blank gap instead of treating it as no gap', () => {
		const { exitCode, stderr } = runCommand([
			'--width',
			'800',
			'--height',
			'1141',
			'--gap',
			' ',
		]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain('--gap');
	});

	it('reports a box outside the image as a usage error', () => {
		const { exitCode, stderr } = runCommand([
			'--width',
			'1500',
			'--height',
			'1000',
			'--box',
			'0.9,0,0.3,0.5',
		]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain('inside the image');
		expect(stderr).toContain('Usage:');
	});
});
