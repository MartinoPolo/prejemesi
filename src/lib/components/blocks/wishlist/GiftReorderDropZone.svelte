<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';

	interface GiftReorderDropZoneProps {
		groupKey: string;
		class?: string;
	}

	let { groupKey, class: className = undefined }: GiftReorderDropZoneProps = $props();
</script>

<!-- An empty priority level or category still receives gifts while reordering. -->
<div
	data-gift-reorder-group={groupKey}
	data-testid="gift-reorder-drop-zone"
	class={cn(
		'flex min-h-16 items-center justify-center rounded-panel border-2 border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground',
		className,
	)}
>
	<!-- Pointer-only guidance; the section header already names the group for assistive tech. -->
	<span aria-hidden="true">{m.gift_reorder_drop_zone()}</span>
</div>
