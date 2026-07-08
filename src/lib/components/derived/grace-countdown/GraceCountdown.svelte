<script lang="ts">
	import * as Alert from '$lib/components/base/alert/index.js';
	import TimerIcon from '@lucide/svelte/icons/timer';
	import { formatGraceCountdown } from '$lib/modules/sharing/grace_window.js';

	interface Props {
		/** When the post-share grace window closes (server-derived authority). */
		expiresAt: Date;
		/** Reactive "now" owned by the parent page clock – keeps the countdown ticking live. */
		now: Date;
		/** Sentence builder receiving the formatted `m:ss` remaining time (a paraglide message fn). */
		message: (inputs: { time: string }) => string;
	}

	let { expiresAt, now, message }: Props = $props();

	const remainingMs = $derived(expiresAt.getTime() - now.getTime());
	const time = $derived(formatGraceCountdown(remainingMs));
</script>

{#if remainingMs > 0}
	<Alert.Root tone="warning">
		<TimerIcon class="size-4" />
		<Alert.Description>{message({ time })}</Alert.Description>
	</Alert.Root>
{/if}
