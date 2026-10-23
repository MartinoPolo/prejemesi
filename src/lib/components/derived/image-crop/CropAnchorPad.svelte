<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { CropWindowPoint } from '$lib/modules/images/index.js';

	interface Props {
		disabled?: boolean;
		/** Called with the photo alignment (each axis 0, 0.5 or 1) the user picked. */
		onalign: (alignment: CropWindowPoint) => void;
		class?: string;
	}

	let { disabled = false, onalign, class: className }: Props = $props();

	const ANCHORS: ReadonlyArray<{ alignment: CropWindowPoint; label: () => string }> = [
		{ alignment: { x: 0, y: 0 }, label: m.image_crop_align_top_left },
		{ alignment: { x: 0.5, y: 0 }, label: m.image_crop_align_top },
		{ alignment: { x: 1, y: 0 }, label: m.image_crop_align_top_right },
		{ alignment: { x: 0, y: 0.5 }, label: m.image_crop_align_left },
		{ alignment: { x: 0.5, y: 0.5 }, label: m.image_crop_align_center },
		{ alignment: { x: 1, y: 0.5 }, label: m.image_crop_align_right },
		{ alignment: { x: 0, y: 1 }, label: m.image_crop_align_bottom_left },
		{ alignment: { x: 0.5, y: 1 }, label: m.image_crop_align_bottom },
		{ alignment: { x: 1, y: 1 }, label: m.image_crop_align_bottom_right },
	];
</script>

<div
	role="group"
	aria-label={m.image_crop_align_label()}
	data-testid="crop-anchor-pad"
	class={cn('grid shrink-0 grid-cols-3 gap-0.5 rounded-md border border-border p-0.5', className)}
>
	{#each ANCHORS as anchor (`${anchor.alignment.x}-${anchor.alignment.y}`)}
		<button
			type="button"
			{disabled}
			title={anchor.label()}
			aria-label={anchor.label()}
			class="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
			onclick={() => onalign(anchor.alignment)}
		>
			<span class="size-1.5 rounded-full bg-current"></span>
		</button>
	{/each}
</div>
