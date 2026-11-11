<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button, type ButtonSize } from '$lib/components/base/button/index.js';

	/**
	 * Zamítnout vše and Přijmout vše over a whole proposal, rendered as two siblings so the host
	 * lays them out beside its Použít.
	 */
	let {
		testIdPrefix,
		size,
		disabled = false,
		onrejectall,
		onacceptall,
		onpointerdown,
	}: {
		/** Prefix of the `-reject-all` and `-accept-all` test ids, one per surface. */
		testIdPrefix: 'change-review' | 'chat-proposal';
		size?: ButtonSize;
		disabled?: boolean;
		onrejectall: () => void;
		onacceptall: () => void;
		/** Lets a host keep the composer focused, so the phone keyboard stays open. */
		onpointerdown?: (event: PointerEvent) => void;
	} = $props();

	const rejectAllTestId = $derived(`${testIdPrefix}-reject-all`);
	const acceptAllTestId = $derived(`${testIdPrefix}-accept-all`);
</script>

<Button
	intent="secondary"
	{size}
	{disabled}
	data-testid={rejectAllTestId}
	{onpointerdown}
	onclick={onrejectall}
>
	{m.change_review_reject_all()}
</Button>
<Button
	intent="secondary"
	{size}
	{disabled}
	data-testid={acceptAllTestId}
	{onpointerdown}
	onclick={onacceptall}
>
	{m.change_review_accept_all()}
</Button>
