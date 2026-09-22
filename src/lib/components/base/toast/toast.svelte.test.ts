import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import Toast from './Toast.svelte';

const { expectPixelsNear } = createPixelAssertions(expect);

it('uses the shared small size for its dismiss action', async () => {
	const screen = await render(Toast, { title: 'Saved', onDismiss: vi.fn() });
	const dismiss = screen.getByRole('button', { name: 'Dismiss' });
	expectPixelsNear(dismiss.element().getBoundingClientRect().height, 26);
});

it('dismisses through the accessible action', async () => {
	const onDismiss = vi.fn();
	const screen = await render(Toast, { title: 'Saved', onDismiss });
	await screen.getByRole('button', { name: 'Dismiss' }).click();
	expect(onDismiss).toHaveBeenCalledOnce();
});
