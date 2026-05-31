<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import AuthDivider from '$lib/components/blocks/auth/AuthDivider.svelte';
	import SocialLoginButtons from '$lib/components/blocks/auth/SocialLoginButtons.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import Users from '@lucide/svelte/icons/users';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let nameError = $state('');
	let emailError = $state('');
	let passwordError = $state('');

	let callbackUrl = $derived(page.url.searchParams.get('redirect') ?? resolve('/my-lists'));

	let passwordStrength = $derived.by(() => {
		if (!password) {
			return 0;
		}
		let score = 0;
		if (password.length >= 8) {
			score++;
		}
		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
			score++;
		}
		if (/\d/.test(password)) {
			score++;
		}
		if (/[^a-zA-Z0-9]/.test(password)) {
			score++;
		}
		return score;
	});

	let strengthLabel = $derived.by(() => {
		if (!password) {
			return '';
		}
		if (passwordStrength <= 1) {
			return 'Slabe heslo';
		}
		if (passwordStrength === 2) {
			return 'Prijatelne heslo';
		}
		if (passwordStrength === 3) {
			return 'Dobre heslo';
		}
		return 'Silne heslo';
	});

	let strengthColor = $derived.by(() => {
		if (passwordStrength <= 1) {
			return 'var(--destructive)';
		}
		if (passwordStrength === 2) {
			return 'var(--status-warning)';
		}
		return 'var(--status-success)';
	});

	function validateName(): boolean {
		if (name.trim().length < 2) {
			nameError = 'Jmeno musi mit alespon 2 znaky';
			return false;
		}
		nameError = '';
		return true;
	}

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

	function validatePassword(): boolean {
		if (password.length < 8) {
			passwordError = 'Heslo musi mit alespon 8 znaku';
			return false;
		}
		passwordError = '';
		return true;
	}

	function handleNameBlur() {
		if (name) {
			validateName();
		}
	}

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
	}

	function handlePasswordBlur() {
		if (password) {
			validatePassword();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		const nameValid = validateName();
		const emailValid = validateEmail();
		const passwordValid = validatePassword();
		if (!nameValid || !emailValid || !passwordValid) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signUp.email({
				name: name.trim(),
				email: email.trim(),
				password,
				callbackURL: callbackUrl,
			});

			if (result.error) {
				if (
					result.error.message?.includes('already exists') === true ||
					result.error.message?.includes('already') === true
				) {
					errorMessage = 'Ucet s timto emailem jiz existuje. Zkuste se prihlasit.';
				} else {
					errorMessage = 'Registrace se nezdarila. Zkuste to prosim znovu.';
				}
			} else {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(callbackUrl);
			}
		} catch {
			errorMessage = 'Doslo k chybe. Zkuste to prosim znovu.';
		} finally {
			loading = false;
		}
	}
</script>

<AuthBrandPanel>
	{#snippet tagline()}
		Zacnete vytvaret<br />seznamy prani
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={CircleCheck}
			title="Zdarma navzdy"
			description="Zadna platebni karta"
		/>
		<AuthBrandFeature
			icon={Clock}
			title="Za 3 minuty hotovo"
			description="Vas prvni seznam ihned"
		/>
		<AuthBrandFeature
			icon={Users}
			title="Sdilejte s rodinou"
			description="Bez registrace pro hosty"
		/>
	{/snippet}
</AuthBrandPanel>

<AuthFormCard title="Vytvorte si ucet" subtitle="Zacnete vytvaret seznamy prani">
	{#if errorMessage}
		<ErrorBanner message={errorMessage} />
	{/if}

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<div class="form-field">
				<Label for="reg-name">Jmeno</Label>
				<Input
					id="reg-name"
					type="text"
					placeholder="Jana Novakova"
					autocomplete="name"
					bind:value={name}
					onblur={handleNameBlur}
					aria-invalid={nameError ? true : undefined}
					aria-describedby={nameError ? 'reg-name-error' : undefined}
					disabled={loading}
					class={nameError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
				/>
				{#if nameError}
					<span class="form-error-text" id="reg-name-error">{nameError}</span>
				{/if}
			</div>

			<div class="form-field">
				<Label for="reg-email">Email</Label>
				<Input
					id="reg-email"
					type="email"
					placeholder="vas@email.cz"
					autocomplete="email"
					bind:value={email}
					onblur={handleEmailBlur}
					aria-invalid={emailError ? true : undefined}
					aria-describedby={emailError ? 'reg-email-error' : undefined}
					disabled={loading}
					class={emailError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
				/>
				{#if emailError}
					<span class="form-error-text" id="reg-email-error">{emailError}</span>
				{/if}
			</div>

			<div class="form-field">
				<Label for="reg-password">Heslo</Label>
				<div class="password-wrapper">
					<Input
						id="reg-password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="new-password"
						bind:value={password}
						onblur={handlePasswordBlur}
						aria-invalid={passwordError ? true : undefined}
						aria-describedby={passwordError ? 'reg-password-error' : undefined}
						disabled={loading}
						class="{passwordError
							? 'border-destructive! ring-destructive/20! ring-3!'
							: ''} pr-11!"
					/>
					<button
						class="password-toggle"
						type="button"
						aria-label={showPassword ? 'Skryt heslo' : 'Zobrazit heslo'}
						onclick={() => (showPassword = !showPassword)}
						tabindex={-1}
					>
						{#if showPassword}
							<EyeOff class="size-4" />
						{:else}
							<Eye class="size-4" />
						{/if}
					</button>
				</div>
				{#if password}
					<div
						class="strength-bar"
						role="progressbar"
						aria-label="Sila hesla: {strengthLabel}"
					>
						{#each [0, 1, 2, 3] as index (index)}
							<div
								class="strength-segment"
								style:background={index < passwordStrength
									? strengthColor
									: undefined}
							></div>
						{/each}
					</div>
					<span class="form-helper-text" style:color={strengthColor}>{strengthLabel}</span
					>
				{/if}
				{#if passwordError}
					<span class="form-error-text" id="reg-password-error">{passwordError}</span>
				{/if}
			</div>
		</div>

		<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			Vytvorit ucet
		</Button>
	</form>

	<AuthDivider />

	<SocialLoginButtons googleLabel="Registrovat pres Google" {callbackUrl} {loading} />

	<div class="auth-footer">
		Jiz mate ucet?&ensp;<a href={resolve('/login')}>Prihlaste se</a>
	</div>
</AuthFormCard>

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

	.password-wrapper {
		position: relative;
	}

	.password-toggle {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast);
		line-height: 1;
	}

	.password-toggle:hover {
		color: var(--foreground);
	}

	.form-error-text {
		font-size: var(--text-xs);
		color: var(--destructive);
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: var(--leading-snug);
	}

	.form-helper-text {
		font-size: var(--text-xs);
	}

	.strength-bar {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}

	.strength-segment {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: var(--border);
		transition: background var(--duration-normal);
	}

	.auth-footer {
		text-align: center;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.auth-footer :global(a) {
		color: var(--primary);
		text-decoration: none;
		font-weight: var(--weight-semibold);
	}

	.auth-footer :global(a:hover) {
		text-decoration: underline;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid oklch(from var(--primary-foreground) l c h / 35%);
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
