<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';

	interface AccessTokenCloseGuardProps {
		open: boolean;
		/** Closes the token dialog even though the token was never copied. */
		onconfirm: () => void;
	}

	let { open = $bindable(false), onconfirm }: AccessTokenCloseGuardProps = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content size="md" showCloseButton={false} data-testid="access-token-close-guard">
		<Dialog.Header>
			<Dialog.Title>{m.access_tokens_close_guard_title()}</Dialog.Title>
			<Dialog.Description class="text-(length:--text-base) text-foreground">
				{m.access_tokens_close_guard_description()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button intent="secondary" onclick={() => (open = false)}>
				{m.access_tokens_back()}
			</Button>
			<Button onclick={onconfirm}>{m.access_tokens_close_guard_confirm()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
