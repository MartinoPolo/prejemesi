import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import InputGroupSegmentTestFixture from './input_group_segment_test_fixture.svelte';

const { expectPixelsNear } = createPixelAssertions(expect);

function joinedParts(container: HTMLElement) {
	const field = container.querySelector<HTMLElement>('[data-testid="copy-field"]')!;
	const segment = container.querySelector<HTMLElement>('[data-slot="input-group-segment"]')!;
	return { field, segment };
}

describe('InputGroup.Segment (issue #442)', () => {
	it('joins the filled copy segment inside the field border without its own elevation', async () => {
		const onCopy = vi.fn();
		const screen = await render(InputGroupSegmentTestFixture, { onCopy });
		const { field, segment } = joinedParts(screen.container);
		const fieldStyle = getComputedStyle(field);
		const segmentStyle = getComputedStyle(segment);
		const fieldBorder = Number.parseFloat(fieldStyle.borderTopWidth);
		const fieldRect = field.getBoundingClientRect();
		const segmentRect = segment.getBoundingClientRect();

		expectPixelsNear(segmentRect.top, fieldRect.top + fieldBorder);
		expectPixelsNear(segmentRect.bottom, fieldRect.bottom - fieldBorder);
		expectPixelsNear(segmentRect.right, fieldRect.right - fieldBorder);
		expect(segmentStyle.boxShadow).toBe('none');
		expect(segmentStyle.borderLeftWidth).toBe(fieldStyle.borderTopWidth);
		expect(segmentStyle.borderLeftColor).toBe(fieldStyle.borderTopColor);
		expectPixelsNear(
			Number.parseFloat(segmentStyle.borderTopRightRadius),
			Number.parseFloat(fieldStyle.borderTopRightRadius) - fieldBorder,
		);
		expect(segmentStyle.backgroundColor).not.toBe(fieldStyle.backgroundColor);
		for (const descendant of segment.querySelectorAll<HTMLElement>('*')) {
			expect(getComputedStyle(descendant).boxShadow).toBe('none');
		}

		await page.getByRole('button', { name: 'Kopírovat' }).click();
		expect(onCopy).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('renders a decorative segment that is neither focusable nor an exposed action', async () => {
		const screen = await render(InputGroupSegmentTestFixture, { decorative: true });
		const { segment } = joinedParts(screen.container);

		expect(segment.tagName.toLowerCase()).not.toBe('button');
		expect(segment.getAttribute('aria-hidden')).toBe('true');
		expect(segment.tabIndex).toBe(-1);
		expect(screen.container.querySelector('button')).toBeNull();
		await screen.unmount();
	});
});
