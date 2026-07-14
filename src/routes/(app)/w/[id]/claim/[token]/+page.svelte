<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { acceptClaimInvite } from '$lib/modules/claim/claim.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import { refreshWishlistDashboards } from '$lib/modules/wishlists/dashboard_refresh.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { toastSuccess } from '$lib/components/base/toast/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { onMount } from 'svelte';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import LogInIcon from '@lucide/svelte/icons/log-in';

	// Marker appended to the post-auth redirect target so we know the freshly
	// authenticated visitor came back to auto-claim the list.
	const AUTOACCEPT_PARAM = 'autoaccept';

	const wishlistData = await getWishlistByShortId(page.params.id!);
	const token = page.params.token!;

	// The claim route is public (/w/ prefix), so anonymous visitors reach this page.
	// When logged out we send them to auth first, then auto-claim on their return.
	const isAuthenticated = $derived(page.data.user != null);
	const shouldAutoAccept = $derived(page.url.searchParams.get(AUTOACCEPT_PARAM) === '1');

	// Localised claim path with the auto-accept marker, so returning from auth lands back
	// here and claims automatically. Localise the bare path first, then append the marker.
	const claimReturnHref = `${localizeInternalHref(
		resolve('/(app)/w/[id]/claim/[token]', {
			id: page.params.id!,
			token,
		}),
	)}?${AUTOACCEPT_PARAM}=1`;

	const registerHref = `${localizeInternalHref(resolve('/register'))}?${new URLSearchParams({
		redirect: claimReturnHref,
	})}`;
	const loginHref = `${localizeInternalHref(resolve('/login'))}?${new URLSearchParams({
		redirect: claimReturnHref,
	})}`;

	let isAccepting = $state(false);
	let errorMessage = $state<string | null>(null);
	let accepted = $state(false);

	// Fire-once guard so the auto-claim-on-return never runs twice.
	let hasAutoAccepted = false;

	async function handleAccept() {
		isAccepting = true;
		errorMessage = null;
		try {
			const result = await acceptClaimInvite({ token });
			accepted = true;
			toastSuccess(m.claim_toast_accepted());
			// The list moves into the claimer's Moje seznamy — refresh the dashboards so the
			// nav/list surfaces reflect it, then redirect to the wishlist.
			await refreshWishlistDashboards();
			setTimeout(() => {
				void goto(
					localizeInternalHref(resolve('/(app)/w/[id]', { id: result.wishlistShortId })),
				);
			}, 1500);
		} catch (thrown) {
			errorMessage = translateServerError(thrown, m.claim_error_generic());
		} finally {
			isAccepting = false;
		}
	}

	onMount(() => {
		if (isAuthenticated && shouldAutoAccept && !hasAutoAccepted) {
			hasAutoAccepted = true;
			void handleAccept();
		}
	});
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
				{:else if !isAuthenticated}
					<LogInIcon class="size-7 text-primary" />
				{:else}
					<GiftIcon class="size-7 text-primary" />
				{/if}
			</div>
			<Card.Title class="text-xl">
				{#if accepted}
					{m.claim_accepted_title()}
				{:else if errorMessage !== null}
					{m.claim_error_title()}
				{:else if !isAuthenticated}
					{m.claim_login_required_title()}
				{:else}
					{m.claim_prompt_title()}
				{/if}
			</Card.Title>
			<Card.Description>
				{#if accepted}
					{m.claim_accepted_description({ title: wishlistData.title })}
				{:else if errorMessage !== null}
					{errorMessage}
				{:else if !isAuthenticated}
					{m.claim_login_required_description({ title: wishlistData.title })}
				{:else}
					{m.claim_prompt_description({ title: wishlistData.title })}
				{/if}
			</Card.Description>
		</Card.Header>

		{#if !accepted && errorMessage === null}
			<Card.Content class="flex flex-col gap-3">
				<div
					class="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
				>
					<p class="font-medium text-foreground">{m.claim_recipient_can()}</p>
					<ul class="mt-2 flex flex-col gap-1">
						<li>{m.claim_can_manage()}</li>
						<li>{m.claim_can_add()}</li>
						<li>{m.claim_can_no_reservations()}</li>
					</ul>
				</div>
			</Card.Content>

			{#if !isAuthenticated}
				<Card.Footer class="flex flex-col gap-3">
					<Button class="w-full" href={registerHref}>
						{m.claim_register_and_accept()}
					</Button>
					<Button intent="outline" class="w-full" href={loginHref}>
						{m.claim_login_to_accept()}
					</Button>
				</Card.Footer>
			{:else}
				<Card.Footer class="flex justify-center gap-3">
					<Button
						intent="outline"
						onclick={() =>
							void goto(
								localizeInternalHref(
									resolve('/(app)/w/[id]', { id: wishlistData.shortId }),
								),
							)}
					>
						{m.cancel()}
					</Button>
					<Button disabled={isAccepting} onclick={handleAccept}>
						{#if isAccepting}
							{m.claim_accepting()}
						{:else}
							{m.claim_accept_button()}
						{/if}
					</Button>
				</Card.Footer>
			{/if}
		{/if}

		{#if errorMessage !== null}
			<Card.Footer class="flex justify-center">
				<Button
					intent="outline"
					onclick={() =>
						void goto(
							localizeInternalHref(
								resolve('/(app)/w/[id]', { id: wishlistData.shortId }),
							),
						)}
				>
					{m.claim_back_to_list()}
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>

<svelte:head>
	<title>{m.claim_page_title({ title: wishlistData.title })}</title>
</svelte:head>
