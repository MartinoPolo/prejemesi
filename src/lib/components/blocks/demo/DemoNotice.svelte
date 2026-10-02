<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { demoNoticeVariants } from './demo_notice_variants.js';

	let { expiresAt, onexpired }: { expiresAt: string; onexpired: () => void } = $props();
	const styles = demoNoticeVariants();
	let resetOpen = $state(false);
	let registerOpen = $state(false);
	let pending = $state(false);
	let error = $state<'reset' | 'exit' | null>(null);
	let catalogLocale = $state<'cs' | 'en'>(getLocale() === 'en' ? 'en' : 'cs');
	let now = $state(Date.now());
	let heading = $state<HTMLHeadingElement>();
	const expiryTime = $derived(new Date(expiresAt).getTime());
	const expired = $derived(now >= expiryTime);
	const hoursLeft = $derived(Math.max(0, Math.ceil((expiryTime - now) / 3_600_000)));
	const english = $derived(getLocale() === 'en');

	$effect(() => {
		const delay = Math.max(0, expiryTime - Date.now());
		const timeout = setTimeout(() => (now = Date.now()), Math.min(delay, 2_147_483_647));
		const interval = setInterval(() => (now = Date.now()), 60_000);
		return () => {
			clearTimeout(timeout);
			clearInterval(interval);
		};
	});

	$effect(() => {
		if (!expired) {
			return;
		}
		onexpired();
		resetOpen = false;
		registerOpen = false;
		void tick().then(() => heading?.focus());
	});

	async function reset() {
		if (pending || expired) {
			return;
		}
		pending = true;
		error = null;
		try {
			const response = await fetch(localizeInternalHref(resolve('/demo/reset')), {
				method: 'POST',
				body: new URLSearchParams({ locale: catalogLocale }),
			});
			if (!response.ok) {
				throw new Error('Reset failed');
			}
			window.location.assign(response.url);
		} catch {
			error = 'reset';
			pending = false;
		}
	}

	async function leave(register: boolean) {
		if (pending) {
			return;
		}
		pending = true;
		error = null;
		try {
			const response = await fetch(localizeInternalHref(resolve('/demo/exit')), {
				method: 'POST',
			});
			if (!response.ok) {
				throw new Error('Exit failed');
			}
			window.location.assign(
				register ? localizeInternalHref(resolve('/register')) : response.url,
			);
		} catch {
			pending = false;
			error = 'exit';
		}
	}
</script>

{#if !expired}
	<div class={styles.root()} data-testid="demo-notice">
		<div class={styles.content()}>
			<p class="min-w-0 text-sm text-foreground">
				<strong>{m.demo_private()}</strong>
				· {m.demo_ends({
					date: new Date(expiresAt).toLocaleString(english ? 'en-GB' : 'cs-CZ'),
					hours: String(hoursLeft),
				})}
			</p>
			<div class={styles.actions()}>
				<Button
					intent="secondary"
					disabled={pending}
					onclick={() => {
						error = null;
						resetOpen = true;
					}}>{m.demo_reset()}</Button
				>
				<Button intent="ghost" disabled={pending} onclick={() => leave(false)}
					>{m.demo_exit()}</Button
				>
				<Button
					intent="outline"
					disabled={pending}
					onclick={() => {
						error = null;
						registerOpen = true;
					}}>{m.demo_register()}</Button
				>
			</div>
			{#if error === 'exit' && !registerOpen}<p
					role="alert"
					class="w-full text-sm text-destructive"
				>
					{m.demo_exit_error()}
				</p>{/if}
		</div>
	</div>

	<Dialog.Root
		bind:open={resetOpen}
		onOpenChange={(open) => {
			if (!pending) resetOpen = open;
		}}
	>
		<Dialog.Content
			size="lg"
			showCloseButton={!pending}
			onEscapeKeydown={(event) => {
				if (pending) event.preventDefault();
			}}
			onInteractOutside={(event) => {
				if (pending) event.preventDefault();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>{m.demo_reset_title()}</Dialog.Title>
				<Dialog.Description>{m.demo_reset_description()}</Dialog.Description>
			</Dialog.Header>
			<label for="demo-catalog-language" class="text-sm font-semibold"
				>{m.demo_catalog_language()}</label
			>
			<Select.Root
				type="single"
				value={catalogLocale}
				onValueChange={(value) => {
					if (value === 'cs' || value === 'en') catalogLocale = value;
				}}
			>
				<Select.Trigger id="demo-catalog-language" size="lg" disabled={pending}>
					{catalogLocale === 'cs' ? 'Čeština' : 'English'}
				</Select.Trigger>
				<Select.Content
					><Select.Group>
						<Select.Item value="cs" label="Čeština">Čeština</Select.Item>
						<Select.Item value="en" label="English">English</Select.Item>
					</Select.Group></Select.Content
				>
			</Select.Root>
			{#if error === 'reset'}<p role="alert" class="text-sm text-destructive">
					{m.demo_reset_error()}
				</p>{/if}
			<Dialog.Footer>
				<Button intent="outline" disabled={pending} onclick={() => (resetOpen = false)}
					>{m.demo_cancel()}</Button
				>
				<Button
					intent="primary-destructive"
					disabled={pending}
					aria-busy={pending}
					onclick={reset}
					>{pending ? m.demo_reset_pending() : m.demo_reset_confirm()}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root
		bind:open={registerOpen}
		onOpenChange={(open) => {
			if (!pending) registerOpen = open;
		}}
	>
		<Dialog.Content
			size="lg"
			showCloseButton={!pending}
			onEscapeKeydown={(event) => {
				if (pending) event.preventDefault();
			}}
			onInteractOutside={(event) => {
				if (pending) event.preventDefault();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>{m.demo_register_title()}</Dialog.Title>
				<Dialog.Description>{m.demo_register_description()}</Dialog.Description>
			</Dialog.Header>
			{#if error === 'exit'}<p role="alert" class="text-sm text-destructive">
					{m.demo_exit_error()}
				</p>{/if}
			<Dialog.Footer>
				<Button intent="outline" disabled={pending} onclick={() => (registerOpen = false)}
					>{m.demo_cancel()}</Button
				>
				<Button disabled={pending} aria-busy={pending} onclick={() => leave(true)}
					>{m.demo_continue()}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-background p-6"
		data-testid="demo-expired"
	>
		<div class="flex max-w-lg flex-col items-center gap-4 text-center">
			<h1 tabindex="-1" bind:this={heading} class="text-2xl font-semibold">
				{m.demo_expired_title()}
			</h1>
			<p>{m.demo_expired_description()}</p>
			<div class="flex flex-wrap justify-center gap-2">
				<Button href={localizeInternalHref(resolve('/demo'))}>{m.demo_expired_new()}</Button
				>
				<Button intent="outline" disabled={pending} onclick={() => leave(false)}
					>{m.demo_exit()}</Button
				>
			</div>
			{#if error === 'exit'}<p role="alert" class="text-sm text-destructive">
					{m.demo_exit_error()}
				</p>{/if}
		</div>
	</div>
{/if}
