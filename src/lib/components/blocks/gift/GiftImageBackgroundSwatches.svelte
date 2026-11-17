<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';

	type ImageBackground = 'transparent' | '#ffffff' | '#000000';

	interface Props {
		/** The image's fill; `null` is the default dotted mat. */
		value: string | null;
		disabled: boolean;
		/** Accessible name of the group, such as „Pozadí obrázku 2“. */
		label: string;
		onchange: (value: ImageBackground) => void;
		/** Phones show the swatches alone; their names stay accessible. */
		compact?: boolean;
		class?: string;
	}

	let { value, disabled, label, onchange, compact = false, class: className }: Props = $props();

	const OPTIONS = [
		{ value: 'transparent', label: () => m.image_background_transparent() },
		{ value: '#ffffff', label: () => m.image_background_white() },
		{ value: '#000000', label: () => m.image_background_black() },
	] as const satisfies readonly { value: ImageBackground; label: () => string }[];

	function isImageBackground(candidate: string): candidate is ImageBackground {
		return OPTIONS.some((option) => option.value === candidate);
	}

	/** An unsupported historical fill stays untouched and selects no option. */
	function shownValue(fill: string | null): string {
		if (fill === null) {
			return 'transparent';
		}
		return isImageBackground(fill) ? fill : '';
	}

	let selected = $derived(shownValue(value));

	function choose(next: string) {
		if (disabled || !isImageBackground(next)) {
			selected = shownValue(value);
			return;
		}
		onchange(next);
	}
</script>

<SegmentedToggle.Root
	bind:value={selected}
	onValueChange={choose}
	aria-label={label}
	class={cn('max-w-full', className)}
	format={compact ? 'icon' : 'text'}
	data-testid="gift-image-background"
>
	{#each OPTIONS as option (option.value)}
		<SegmentedToggle.Item value={option.value} {disabled} aria-label={option.label()}>
			<span
				class={cn(
					'size-6 shrink-0 rounded-md border-2 border-edge sm:size-5',
					option.value === 'transparent' &&
						'bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[6px_6px]',
				)}
				style:background-color={option.value === 'transparent' ? undefined : option.value}
				aria-hidden="true"
			></span>
			{#if !compact}<span>{option.label()}</span>{/if}
		</SegmentedToggle.Item>
	{/each}
</SegmentedToggle.Root>
