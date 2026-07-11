<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface FilterChipProps {
		/** Toggle state, exposed to AT via aria-pressed and styled as the filled chip. */
		pressed: boolean;
		onclick: () => void;
		children: Snippet;
		class?: string;
	}

	let { pressed, onclick, children, class: className }: FilterChipProps = $props();
</script>

<!-- Anime-sky toggle chip (issue #102): ink-bordered pill, filled with the brand color when active. -->
<button
	type="button"
	class={cn(
		'rounded-full border-2 border-ink bg-card px-3.5 py-1.5 text-[13.5px] font-semibold text-foreground transition-[background-color,color,transform] aria-pressed:bg-primary aria-pressed:text-primary-foreground motion-safe:hover:-translate-y-px',
		className,
	)}
	aria-pressed={pressed}
	{onclick}
>
	{@render children()}
</button>
