<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import Mail from '@lucide/svelte/icons/mail';
	import Clock from '@lucide/svelte/icons/clock';
	import Send from '@lucide/svelte/icons/send';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let sentEmail = $state('');
	let errorMessage = $state('');
	let emailError = $state('');

	let callbackUrl = $derived(page.url.searchParams.get('redirect') ?? resolve('/my-lists'));

	function validateEmail(): boolean {
		if (!email.trim()) {
			emailError = 'Zadejte emailovou adresu';
			return false;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			emailError = 'Zadejte platnou emailovou adresu';
			return false;
		}
		emailError = '';
		return true;
	}

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		if (!validateEmail()) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signIn.magicLink({
				email: email.trim(),
				callbackURL: callbackUrl,
			});

			if (result.error) {
				errorMessage = 'Odeslani odkazu se nezdarilo. Zkuste to prosim znovu.';
			} else {
				sentEmail = email.trim();
				sent = true;
			}
		} catch {
			errorMessage = 'Doslo k chybe. Zkuste to prosim znovu.';
		} finally {
			loading = false;
		}
	}

	function handleReset() {
		sent = false;
		sentEmail = '';
		email = '';
		errorMessage = '';
	}
</script>

<AuthBrandPanel>
	{#snippet tagline()}
		{#if sent}
			Zkontrolujte<br />svuj email
		{:else}
			Prihlaste se<br />bez hesla
		{/if}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature icon={Mail} title="Bez hesla" description="Odkaz dorazi do emailu" />
		<AuthBrandFeature
			icon={Clock}
			title="Platny 15 minut"
			description="Bezpecny jednorazovy odkaz"
		/>
	{/snippet}
</AuthBrandPanel>

{#if sent}
	<AuthFormCard title="" subtitle="">
		<div class="success-state" role="status" aria-live="polite">
			<div class="success-icon-wrap" aria-hidden="true">
				<Mail class="size-9" />
			</div>
			<h2 class="success-title">Odkaz odeslan!</h2>
			<p class="success-body">
				Odkaz odeslan na <strong>{sentEmail}</strong>. Platnost <strong>15 minut</strong>.
			</p>
			<p class="success-body mt-hint">
				Zkontrolujte svou emailovou schranku.<br />
				Pokud email neprijde, podivejte se do spamu.
			</p>
			<a href={resolve('/login')} class="success-back" onclick={handleReset}>
				<ChevronLeft class="size-3.5" />
				Zpet na prihlaseni
			</a>
		</div>
	</AuthFormCard>
{:else}
	<AuthFormCard title="Prihlaseni odkazem" subtitle="Posleme vam prihlasovaci odkaz na email">
		{#if errorMessage}
			<ErrorBanner message={errorMessage} />
		{/if}

		<form onsubmit={handleSubmit} novalidate>
			<div class="form-stack">
				<div class="form-field">
					<Label for="magic-email">Email</Label>
					<Input
						id="magic-email"
						type="email"
						placeholder="vas@email.cz"
						autocomplete="email"
						bind:value={email}
						onblur={handleEmailBlur}
						aria-invalid={emailError ? true : undefined}
						aria-describedby={emailError ? 'magic-email-error' : undefined}
						disabled={loading}
						class={emailError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
					/>
					{#if emailError}
						<span class="form-error-text" id="magic-email-error">{emailError}</span>
					{/if}
				</div>
			</div>

			<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
				{#if loading}
					<span class="spinner"></span>
				{:else}
					<Send data-icon="inline-start" />
				{/if}
				Odeslat prihlasovaci odkaz
			</Button>
		</form>

		<div class="auth-footer">
			<a href={resolve('/login')}>
				<ChevronLeft class="inline size-3.5 align-[-2px]" />
				Zpet na prihlaseni
			</a>
		</div>
	</AuthFormCard>
{/if}

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-error-text {
		font-size: var(--text-xs);
		color: var(--destructive);
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: var(--leading-snug);
	}

	.auth-footer {
		text-align: center;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.auth-footer :global(a) {
		color: var(--muted-foreground);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.auth-footer :global(a:hover) {
		color: var(--primary);
	}

	/* Success state */
	.success-state {
		text-align: center;
		padding: var(--space-4) 0;
	}

	.success-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: oklch(from var(--status-success) l c h / 0.12);
		border-radius: 9999px;
		margin-bottom: var(--space-5);
		color: var(--status-success);
	}

	.success-title {
		font-family: var(--font-heading);
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: var(--foreground);
		margin-bottom: var(--space-2);
	}

	.success-body {
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.mt-hint {
		margin-top: var(--space-3);
	}

	.success-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.success-back:hover {
		color: var(--primary);
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid oklch(from var(--primary-foreground) l c h / 0.35);
		border-top-color: var(--primary-foreground);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
