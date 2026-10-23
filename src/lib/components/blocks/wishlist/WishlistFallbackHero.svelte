<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { WishlistThemeMotif } from './wishlist_theme_scope.js';

	interface Props {
		/** Theme-derived emoji shown large and centered (REQ-3). */
		emoji: string;
		/** The wishlist theme's motif (#535), shown on the image mat instead of the emoji. */
		themeMotif?: WishlistThemeMotif | null;
		/** Accessible label (defaults to the emoji). */
		label?: string;
		class?: string;
	}

	let { emoji, themeMotif = null, label, class: className }: Props = $props();
</script>

<!--
Theme-aware no-image fallback (REQ-3): a themed background with a large, scale-aware
emoji. Container-query units size the emoji relative to the slot so the same component
reads well from a tiny list thumbnail up to a full-width banner. Palette tokens
re-derive per [data-palette] subtree, so the tint follows the wishlist's palette.
-->
{#if themeMotif === null}
	<div
		class={cn(
			'flex size-full items-center justify-center bg-tint [container-type:size]',
			className,
		)}
		role="img"
		aria-label={label ?? emoji}
	>
		<span class="leading-none text-brand [font-size:40cqmin]" aria-hidden="true">{emoji}</span>
	</div>
{:else}
	<div
		class={cn(
			'flex size-full items-center justify-center bg-[color:var(--wishlist-image-mat,var(--secondary))] bg-dots',
			className,
		)}
		role="img"
		aria-label={label ?? emoji}
		data-testid="wishlist-fallback-motif"
		data-wishlist-theme={themeMotif.themeId}
	>
		{#if themeMotif.markup !== null}
			<svg class="size-[70%] overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted theme art -->
				{@html themeMotif.markup}
			</svg>
		{/if}
	</div>
{/if}
