<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
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
	const expiryDateLabel = $derived(
		new Date(expiresAt).toLocaleString(english ? 'en-GB' : 'cs-CZ'),
	);
	const catalogLocaleLabel = $derived(catalogLocale === 'cs' ? 'Čeština' : 'English');

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

	function changeCatalogLocale(value: string) {
		if (value === 'cs' || value === 'en') {
			catalogLocale = value;
		}
	}
</script>

{#if !expired}
	<div class={styles.root()} data-testid="demo-notice">
		<div class={styles.content()}>
			<p class="min-w-0 text-sm text-foreground">
				<strong>{m.demo_private()}</strong>
				· {m.demo_ends({
					date: expiryDateLabel,
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
					class="w-full text-sm text-status-danger-text"
				>
					{m.demo_exit_error()}
				</p>{/if}
		</div>
	</div>

	<!-- A pending reset or exit navigates away, so the dialog locks until the request settles. -->
	<ConfirmDialog
		bind:open={resetOpen}
		{pending}
		title={m.demo_reset_title()}
		description={m.demo_reset_description()}
		cancelLabel={m.demo_cancel()}
		confirmLabel={m.demo_reset_confirm()}
		pendingLabel={m.demo_reset_pending()}
		confirmIntent="primary-destructive"
		onconfirm={reset}
	>
		<div class="flex flex-col gap-2">
			<label for="demo-catalog-language" class="text-sm font-semibold"
				>{m.demo_catalog_language()}</label
			>
			<Select.Root type="single" value={catalogLocale} onValueChange={changeCatalogLocale}>
				<Select.Trigger id="demo-catalog-language" size="lg" disabled={pending}>
					{catalogLocaleLabel}
				</Select.Trigger>
				<Select.Content
					><Select.Group>
						<Select.Item value="cs" label="Čeština">Čeština</Select.Item>
						<Select.Item value="en" label="English">English</Select.Item>
					</Select.Group></Select.Content
				>
			</Select.Root>
		</div>
		{#if error === 'reset'}<p role="alert" class="text-sm text-status-danger-text">
				{m.demo_reset_error()}
			</p>{/if}
	</ConfirmDialog>

	<!-- Registering is the goal of the demo, so it stays a safe primary action. -->
	<ConfirmDialog
		bind:open={registerOpen}
		{pending}
		title={m.demo_register_title()}
		description={m.demo_register_description()}
		cancelLabel={m.demo_cancel()}
		confirmLabel={m.demo_continue()}
		confirmIntent="primary"
		onconfirm={() => leave(true)}
	>
		{#if error === 'exit'}<p role="alert" class="text-sm text-status-danger-text">
				{m.demo_exit_error()}
			</p>{/if}
	</ConfirmDialog>
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
			{#if error === 'exit'}<p role="alert" class="text-sm text-status-danger-text">
					{m.demo_exit_error()}
				</p>{/if}
		</div>
	</div>
{/if}
