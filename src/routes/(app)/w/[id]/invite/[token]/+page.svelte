<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { acceptModeratorInvite } from '$lib/modules/moderators/moderators.remote.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	let { data } = $props();

	let isAccepting = $state(false);
	let errorMessage = $state<string | null>(null);
	let accepted = $state(false);

	async function handleAccept() {
		isAccepting = true;
		errorMessage = null;
		try {
			const result = await acceptModeratorInvite({ token: data.token });
			accepted = true;
			toast.success('Pozvanka byla prijata!');
			// Redirect to the wishlist after a short delay
			setTimeout(() => {
				void goto(resolve('/(app)/w/[id]', { id: result.wishlistShortId }));
			}, 1500);
		} catch (thrown) {
			if (thrown instanceof Error) {
				errorMessage = thrown.message;
			} else {
				errorMessage = 'Nepodarilo se prijmout pozvanku';
			}
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
					Pozvanka prijata!
				{:else if errorMessage !== null}
					Chyba
				{:else}
					Pozvanka do seznamu
				{/if}
			</Card.Title>
			<Card.Description>
				{#if accepted}
					Nyni jste moderatorem seznamu "{data.wishlist.title}". Presmerovavame vas...
				{:else if errorMessage !== null}
					{errorMessage}
				{:else}
					Byli jste pozváni jako moderator seznamu prani "{data.wishlist.title}" od {data
						.wishlist.ownerName}.
				{/if}
			</Card.Description>
		</Card.Header>

		{#if !accepted && errorMessage === null}
			<Card.Content class="flex flex-col gap-3">
				<div
					class="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
				>
					<p class="font-medium text-foreground">Jako moderator budete moci:</p>
					<ul class="mt-2 flex flex-col gap-1">
						<li>Videt stav rezervaci</li>
						<li>Pridavat a upravovat darky</li>
						<li>Pomahat se spravou seznamu</li>
					</ul>
				</div>
			</Card.Content>

			<Card.Footer class="flex justify-center gap-3">
				<Button
					intent="outline"
					onclick={() =>
						void goto(resolve('/(app)/w/[id]', { id: data.wishlist.shortId }))}
				>
					Zrusit
				</Button>
				<Button disabled={isAccepting} onclick={handleAccept}>
					{#if isAccepting}
						Prijimam...
					{:else}
						Prijmout pozvanku
					{/if}
				</Button>
			</Card.Footer>
		{/if}

		{#if errorMessage !== null}
			<Card.Footer class="flex justify-center">
				<Button
					intent="outline"
					onclick={() =>
						void goto(resolve('/(app)/w/[id]', { id: data.wishlist.shortId }))}
				>
					Zpet na seznam
				</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>

<svelte:head>
	<title>Pozvanka — {data.wishlist.title} — Darecky</title>
</svelte:head>
