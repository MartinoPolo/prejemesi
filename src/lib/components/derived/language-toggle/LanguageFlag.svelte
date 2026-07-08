<script lang="ts">
	import type { Locale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';

	interface LanguageFlagProps {
		locale: Locale;
		class?: string;
	}

	let { locale, class: className }: LanguageFlagProps = $props();
</script>

{#if locale === 'cs'}
	<svg
		viewBox="0 0 18 12"
		class={cn('block !h-3.5 !w-5 shrink-0 overflow-hidden rounded-[1px]', className)}
		aria-hidden="true"
		focusable="false"
	>
		<path fill="#fff" d="M0 0h18v6H0z" />
		<path fill="#d7141a" d="M0 6h18v6H0z" />
		<path fill="#11457e" d="M0 0l9 6-9 6z" />
	</svg>
{:else}
	<svg
		viewBox="0 0 60 40"
		class={cn('block !h-3.5 !w-5 shrink-0 overflow-hidden rounded-[1px]', className)}
		aria-hidden="true"
		focusable="false"
	>
		<path fill="#012169" d="M0 0h60v40H0z" />
		<path stroke="#fff" stroke-width="8" d="M0 0l60 40M60 0 0 40" />
		<path stroke="#c8102e" stroke-width="4" d="M0 0l60 40M60 0 0 40" />
		<path stroke="#fff" stroke-width="13" d="M30 0v40M0 20h60" />
		<path stroke="#c8102e" stroke-width="8" d="M30 0v40M0 20h60" />
	</svg>
{/if}
