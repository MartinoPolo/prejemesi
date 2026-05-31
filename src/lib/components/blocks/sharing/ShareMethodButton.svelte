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

<a
	class="flex h-12 cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-border bg-muted/50 px-4 no-underline transition-all hover:translate-x-0.5 hover:border-border hover:bg-accent"
	{href}
	rel="external noopener noreferrer"
	aria-label={platform.label}
	onclick={handleClick}
>
	<div
		class="{platform.colorClass} flex size-8 items-center justify-center rounded-[9px] text-white"
	>
		{@render icon()}
	</div>
	<span class="flex-1 whitespace-nowrap text-sm font-medium text-foreground">
		{platform.label}
	</span>
	<ChevronRightIcon class="size-3.5 flex-shrink-0 text-muted-foreground" />
</a>
