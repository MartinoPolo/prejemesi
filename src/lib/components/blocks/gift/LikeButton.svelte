<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { useLikes } from '$lib/modules/likes/likes.context.svelte.js';
	import { toggleLike } from '$lib/modules/likes/likes.remote.js';
	import { likeButtonVariants, type LikeButtonSize } from './like_button_variants.js';
	import { cn } from '$lib/utils.js';

	interface LikeButtonProps {
		giftId: string;
		giftName: string;
		likeCount: number;
		size?: LikeButtonSize;
		class?: string;
	}

	let { giftId, giftName, likeCount, size = 'md', class: className }: LikeButtonProps = $props();

	const likesContext = useLikes();

	const liked = $derived(likesContext.isLiked(giftId));
	let animating = $state(false);
	let displayCount = $derived(likeCount);

	const styles = $derived(likeButtonVariants({ liked, size }));

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
			const result = await toggleLike({ giftId });
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
	aria-label={liked ? `Odebrat z oblibenych: ${giftName}` : `Pridat do oblibenych: ${giftName}`}
	aria-pressed={liked}
	onclick={handleClick}
>
	<HeartIcon class={cn(styles.icon(), animating && 'scale-125')} />
	{#if displayCount > 0}
		<span class={styles.count()}>{displayCount}</span>
	{/if}
</button>
