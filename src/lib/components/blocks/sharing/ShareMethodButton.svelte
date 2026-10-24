<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';

	interface ShareMethodButtonProps {
		methodId: string;
		label: string;
		colorClass: string;
		icon: Snippet;
		/** Intent URL methods render a link; the native share sheet passes `onclick` instead. */
		href?: string;
		opensInNewTab?: boolean;
		onclick?: () => void;
	}

	let {
		methodId,
		label,
		colorClass,
		icon,
		href,
		opensInNewTab,
		onclick,
	}: ShareMethodButtonProps = $props();
</script>

<!-- Sticker share row (issue #102 REQ-16): ink border, hard shadow lift on hover. -->
<Button
	intent="secondary"
	size="xl"
	class="w-full"
	surfaceClass="justify-start gap-3 no-underline"
	{href}
	{onclick}
	target={opensInNewTab === true ? '_blank' : undefined}
	rel={href === undefined ? undefined : 'external noopener noreferrer'}
	aria-label={label}
	data-share-platform={methodId}
>
	<span
		class="{colorClass} flex size-8 -rotate-3 items-center justify-center rounded-[9px] border-2 border-ink text-white"
	>
		{@render icon()}
	</span>
	<span class="flex-1 whitespace-nowrap text-left font-semibold text-foreground">
		{label}
	</span>
	<ChevronRightIcon class="size-3.5 flex-shrink-0 text-muted-foreground" />
</Button>
