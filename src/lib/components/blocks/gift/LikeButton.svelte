<script lang="ts">
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
	let animating = $state(false);
	let displayCount = $derived(likeCount);

	const styles = $derived(likeButtonVariants({ liked, size, appearance }));

	async function handleClick(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();

		// Likes require an account (they drive notifications). Prompt anonymous
		// visitors to log in instead of firing a request that would 401.
		if (!likesContext.isAuthenticated()) {
			likesContext.requireAuth();
			return;
		}

		// Optimistic update
		const wasLiked = liked;
		const previousCount = displayCount;
		likesContext.optimisticToggle(giftId);
		displayCount = wasLiked ? previousCount - 1 : previousCount + 1;

		// Animate on like
		if (!wasLiked) {
			animating = true;
			setTimeout(() => {
				animating = false;
			}, 300);
		}

		try {
			// The landing demo supplies its own persistence for fixture gifts; every other
			// surface has none and goes straight to the real remote function.
			const result =
				likesContext.toggleLike === undefined
					? await toggleLike({ giftId })
					: await likesContext.toggleLike(giftId);
			displayCount = result.likeCount;
		} catch {
			// Revert on error
			likesContext.revertToggle(giftId, wasLiked);
			displayCount = previousCount;
		}
	}
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
	<HeartIcon class={cn(styles.icon(), animating && 'scale-125')} />
	{#if showCount && displayCount > 0}
		<span class={styles.count()}>{displayCount}</span>
	{/if}
</button>
