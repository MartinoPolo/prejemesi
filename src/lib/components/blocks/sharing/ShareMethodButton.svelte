<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { SharePlatformInfo } from '$lib/modules/sharing/types.js';
	import type { Snippet } from 'svelte';

	interface ShareMethodButtonProps {
		platform: SharePlatformInfo;
		shareUrl: string;
		message: string;
		icon: Snippet;
	}

	let { platform, shareUrl, message, icon }: ShareMethodButtonProps = $props();

	const href = $derived(platform.buildUrl(shareUrl, message));

	function handleClick(event: MouseEvent) {
		event.preventDefault();
		window.open(href, '_blank', 'noopener,noreferrer');
	}
</script>

<!-- Sticker share row (issue #102 REQ-16): ink border, hard shadow lift on hover. -->
<a
	class="flex h-12 cursor-pointer items-center gap-3 rounded-[10px] border-2 border-ink bg-card px-4 no-underline transition-[transform,box-shadow,background-color] hover:bg-panel-hover hover:shadow-sticker-sm motion-safe:hover:-translate-y-0.5"
	{href}
	rel="external noopener noreferrer"
	aria-label={platform.label}
	onclick={handleClick}
>
	<div
		class="{platform.colorClass} flex size-8 -rotate-3 items-center justify-center rounded-[9px] border-2 border-ink text-white"
	>
		{@render icon()}
	</div>
	<span class="flex-1 whitespace-nowrap text-sm font-semibold text-foreground">
		{platform.label}
	</span>
	<ChevronRightIcon class="size-3.5 flex-shrink-0 text-ink-soft" />
</a>
