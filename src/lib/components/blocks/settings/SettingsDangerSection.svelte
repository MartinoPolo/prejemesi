<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { authClient } from '$lib/auth_client.js';
	import { deleteAccount } from '$lib/modules/settings/settings.remote.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let deleteDialogOpen = $state(false);
	let deleting = $state(false);

	async function handleDeleteAccount() {
		deleting = true;
		try {
			await deleteAccount();
			await authClient.signOut();
			window.location.href = resolve('/');
		} catch {
			deleting = false;
		}
	}
</script>

<Card.Root class="border-destructive/30">
	<Card.Header>
		<div class="flex items-center gap-2">
			<TriangleAlertIcon class="size-5 text-destructive" />
			<div>
				<Card.Title class="text-destructive">{m.settings_danger_title()}</Card.Title>
				<Card.Description>{m.settings_danger_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium">{m.settings_delete_account()}</p>
				<p class="text-xs text-muted-foreground">
					{m.settings_delete_account_description()}
				</p>
			</div>
			<Button intent="danger" size="sm" onclick={() => (deleteDialogOpen = true)}>
				{m.settings_delete_account()}
			</Button>
		</div>
	</Card.Content>
</Card.Root>

<!-- Delete account confirmation dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.settings_delete_confirm_title()}</Dialog.Title>
			<Dialog.Description>
				{m.settings_delete_confirm_description()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button intent="outline" onclick={() => (deleteDialogOpen = false)} disabled={deleting}>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleDeleteAccount} disabled={deleting}>
				{deleting ? m.deleting() : m.settings_delete_confirm_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
