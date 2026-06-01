<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { acceptModeratorInvite } from '$lib/modules/moderators/moderators.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toastSuccess } from '$lib/components/base/toast/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	const wishlistData = await getWishlistByShortId(page.params.id!);
	const token = page.params.token!;

	let isAccepting = $state(false);
	let errorMessage = $state<string | null>(null);
	let accepted = $state(false);

	async function handleAccept() {
		isAccepting = true;
		errorMessage = null;
		try {
			const result = await acceptModeratorInvite({ token });
			accepted = true;
			toastSuccess(m.invite_toast_accepted());
			// Redirect to the wishlist after a short delay
			setTimeout(() => {
				void goto(resolve('/(app)/w/[id]', { id: result.wishlistShortId }));
			}, 1500);
		} catch (thrown) {
			errorMessage = translateServerError(thrown, m.invite_error_generic());
		} finally {
			isAccepting = false;
		}
	}
</script>

<div class="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16">
	<Card.Root class="w-full">
		<Card.Header class="text-center">
			<div
				class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10"
			>
				{#if accepted}
					<CheckIcon class="size-7 text-primary" />
				{:else if errorMessage !== null}
					<XCircleIcon class="size-7 text-destructive" />
				{:else}
					<UsersIcon class="size-7 text-primary" />
				{/if}
			</div>
			<Card.Title class="text-xl">
				{#if accepted}
					{m.invite_accepted_title()}
				{:else if errorMessage !== null}
					{m.invite_error_title()}
				{:else}
					{m.invite_pending_title()}
				{/if}
			</Card.Title>
			<Card.Description>
				{#if accepted}
					{m.invite_accepted_description({ title: wishlistData.title })}
				{:else if errorMessage !== null}
					{errorMessage}
				{:else}
					{m.invite_pending_description({
						title: wishlistData.title,
						owner: wishlistData.ownerName,
					})}
				{/if}
			</Card.Description>
		</Card.Header>

		{#if !accepted && errorMessage === null}
			<Card.Content class="flex flex-col gap-3">
				<div
					class="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
				>
					<p class="font-medium text-foreground">{m.invite_moderator_can()}</p>
					<ul class="mt-2 flex flex-col gap-1">
						<li>{m.invite_can_see_reservations()}</li>
						<li>{m.invite_can_add_gifts()}</li>
						<li>{m.invite_can_manage()}</li>
					</ul>
				</div>
			</Card.Content>

			<Card.Footer class="flex justify-center gap-3">
				<Button
					intent="outline"
					onclick={() =>
						void goto(resolve('/(app)/w/[id]', { id: wishlistData.shortId }))}
				>
					{m.cancel()}
				</Button>
				<Button disabled={isAccepting} onclick={handleAccept}>
					{#if isAccepting}
						{m.invite_accepting()}
					{:else}
						{m.invite_accept_button()}
					{/if}
				</Button>
			</Card.Footer>
		{/if}

		{#if errorMessage !== null}
			<Card.Footer class="flex justify-center">
				<Button
					intent="outline"
					onclick={() =>
						void goto(resolve('/(app)/w/[id]', { id: wishlistData.shortId }))}
				>
					{m.invite_back_to_list()}
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>

<svelte:head>
	<title>{m.invite_page_title({ title: wishlistData.title })}</title>
</svelte:head>
