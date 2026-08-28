<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { onDestroy, tick } from 'svelte';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import * as m from '$lib/paraglide/messages.js';
	import { useLikes } from '$lib/modules/likes/likes.context.svelte.js';
	import { toggleLike } from '$lib/modules/likes/likes.remote.js';
	import {
		likeButtonVariants,
		type LikeButtonSize,
		type LikeButtonAppearance,
	} from './like_button_variants.js';
	import { cn } from '$lib/utils.js';

	interface LikeButtonProps {
		giftId: string;
		giftName: string;
		likeCount: number;
		size?: LikeButtonSize;
		appearance?: LikeButtonAppearance;
		showCount?: boolean;
		class?: string;
	}

	let {
		giftId,
		giftName,
		likeCount,
		size = 'md',
		appearance = 'ghost',
		showCount = true,
		class: className,
	}: LikeButtonProps = $props();

	const likesContext = useLikes();

	const liked = $derived(likesContext.isLiked(giftId));
	let displayCount = $derived(likeCount);
	let heartElement = $state<HTMLSpanElement>();
	let countElement = $state<HTMLSpanElement>();
	let run = 0;
	const activeAnimations = new SvelteSet<Animation>();

	const styles = $derived(likeButtonVariants({ liked, size, appearance }));

	function cancelAcknowledgement() {
		for (const animation of activeAnimations) {
			animation.cancel();
		}
		activeAnimations.clear();
	}

	function animateAcknowledgement() {
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			return;
		}

		if (!heartElement) {
			return;
		}
		activeAnimations.add(
			heartElement.animate(
				[
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.16)' },
					{ transform: 'scale(1)' },
				],
				{ duration: 160 },
			),
		);
		if (countElement) {
			activeAnimations.add(
				countElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 }),
			);
		}
	}

	async function handleClick(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();

		// Likes require an account (they drive notifications). Prompt anonymous
		// visitors to log in instead of firing a request that would 401.
		if (!likesContext.isAuthenticated()) {
			likesContext.requireAuth();
			return;
		}

		const currentRun = ++run;
		cancelAcknowledgement();

		// Optimistic update
		const wasLiked = liked;
		const previousCount = displayCount;
		likesContext.optimisticToggle(giftId);
		displayCount = wasLiked ? previousCount - 1 : previousCount + 1;

		// Start persistence immediately while allowing the optimistic DOM to settle
		// before binding the acknowledgement to its heart and count elements.
		const persistence =
			likesContext.toggleLike === undefined
				? toggleLike({ giftId })
				: likesContext.toggleLike(giftId);
		if (!wasLiked) {
			await tick();
			if (currentRun === run) {
				animateAcknowledgement();
			}
		}

		try {
			const result = await persistence;
			if (currentRun === run) {
				displayCount = result.likeCount;
			}
		} catch {
			if (currentRun !== run) {
				return;
			}
			cancelAcknowledgement();
			likesContext.revertToggle(giftId, wasLiked);
			displayCount = previousCount;
		}
	}

	onDestroy(() => {
		run += 1;
		cancelAcknowledgement();
	});
</script>

<button
	type="button"
	class={cn(styles.root(), className)}
	aria-label={liked
		? m.gift_like_remove_aria({ name: giftName })
		: m.gift_like_add_aria({ name: giftName })}
	aria-pressed={liked}
	onclick={handleClick}
>
	<span bind:this={heartElement} data-like-heart class="inline-flex">
		<HeartIcon class={styles.icon()} />
	</span>
	{#if showCount && displayCount > 0}
		<span bind:this={countElement} class={styles.count()}>{displayCount}</span>
	{/if}
</button>
