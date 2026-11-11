<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import { SPINNER_SIZES, Spinner } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Spinner',
		component: Spinner,
		tags: ['autodocs'],
		argTypes: {
			size: { control: 'select', options: [...SPINNER_SIZES] },
		},
	});

	const playAccessibleName = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('img', { name: 'Loading gifts' })).toBeInTheDocument();
		const decorativeSpinners = canvasElement.querySelectorAll(
			'[data-slot="spinner"][aria-hidden="true"]',
		);
		await expect(decorativeSpinners.length).toBe(SPINNER_SIZES.length + 1);
	};

	const playRingShape = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const spinner = canvasElement.querySelector<SVGSVGElement>('svg[data-slot="spinner"]')!;
		const [track, arc] = Array.from(spinner.children) as SVGGeometryElement[];
		const spinnerColor = getComputedStyle(spinner).color;
		for (const part of [track, arc]) {
			await expect(getComputedStyle(part).stroke).toBe(spinnerColor);
			await expect(getComputedStyle(part).fill).toBe('none');
		}
		await expect(Number(getComputedStyle(track).strokeOpacity)).toBeCloseTo(0.35, 1);
		await expect(Number(getComputedStyle(arc).strokeOpacity)).toBe(1);

		const renderedPixelsPerUnit =
			spinner.getBoundingClientRect().width / spinner.viewBox.baseVal.width;
		const renderedStrokeWidth =
			parseFloat(getComputedStyle(arc).strokeWidth) * renderedPixelsPerUnit;
		await expect(spinner.getBoundingClientRect().width).toBe(16);
		await expect(renderedStrokeWidth).toBeCloseTo(2, 1);

		const trackBox = track.getBBox();
		const arcBox = arc.getBBox();
		const ringCentreX = trackBox.x + trackBox.width / 2;
		const ringCentreY = trackBox.y + trackBox.height / 2;
		await expect(trackBox.width).toBeCloseTo(trackBox.height, 3);
		await expect(arcBox.x + arcBox.width / 2).toBeCloseTo(ringCentreX, 1);
		await expect(arcBox.y).toBeCloseTo(trackBox.y, 1);
		await expect(arcBox.y + arcBox.height).toBeLessThan(ringCentreY);
		await expect(arc.getTotalLength()).toBeCloseTo(track.getTotalLength() / 4, 0);

		await expect(getComputedStyle(spinner).animationDuration).toBe('0.7s');
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
</script>

<Story name="Sizes And Labels" play={playAccessibleName}>
	{#snippet template(args)}
		<div class="flex flex-col gap-4">
			<div class="flex items-center gap-4">
				{#each SPINNER_SIZES as size (size)}
					<div class="flex flex-col items-center gap-1">
						<Spinner {...args} {size} />
						<span class="text-xs text-muted-foreground">{size}</span>
					</div>
				{/each}
			</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Spinner label="Loading gifts" />
				Labelled, for a spinner that stands alone
			</div>
			<Button disabled>
				<Spinner data-icon="inline-start" />
				Saving…
			</Button>
		</div>
	{/snippet}
</Story>

<Story name="Ring [play: quarter arc over a faint track]" play={playRingShape}>
	{#snippet template(args)}
		<div class="text-primary">
			<Spinner {...args} size="md" />
		</div>
	{/snippet}
</Story>
