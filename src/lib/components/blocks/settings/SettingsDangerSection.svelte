<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
	import { authClient } from '$lib/auth_client.js';
	import { deleteAccount } from '$lib/modules/settings/settings.remote.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import DangerActionCard from './DangerActionCard.svelte';

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

<DangerActionCard
	icon={TriangleAlertIcon}
	title={m.settings_danger_title()}
	description={m.settings_danger_description()}
	actionTitle={m.settings_delete_account()}
	actionDescription={m.settings_delete_account_description()}
>
	{#snippet action()}
		<Button intent="danger" size="sm" onclick={() => (deleteDialogOpen = true)}>
			{m.settings_delete_account()}
		</Button>
	{/snippet}
</DangerActionCard>

<ConfirmDialog
	bind:open={deleteDialogOpen}
	title={m.settings_delete_confirm_title()}
	description={m.settings_delete_confirm_description()}
	confirmLabel={m.settings_delete_confirm_button()}
	pendingLabel={m.deleting()}
	confirmIntent="primary-destructive"
	pending={deleting}
	onconfirm={handleDeleteAccount}
/>
