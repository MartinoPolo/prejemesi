<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import Gift from '@lucide/svelte/icons/gift';
	import Check from '@lucide/svelte/icons/check';
	import List from '@lucide/svelte/icons/list';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Palette from '@lucide/svelte/icons/palette';
	import Heart from '@lucide/svelte/icons/heart';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Lock from '@lucide/svelte/icons/lock';
	import Link from '@lucide/svelte/icons/link';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserCheck from '@lucide/svelte/icons/user-check';
</script>

<svelte:head>
	<title>Darecky — Sdílejte svá přání</title>
	<meta
		name="description"
		content="Vytvořte si přehledný seznam přání a sdílejte ho s rodinou a přáteli. Nikdy neuvidíte, kdo co rezervoval — překvapení je zachováno."
	/>
	<meta property="og:title" content="Darecky — Sdílejte svá přání" />
	<meta
		property="og:description"
		content="Vytvořte si seznam přání, sdílejte ho jedním odkazem. Dárci rezervují anonymně — překvapení zůstane překvapením."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://darecky.cz" />
</svelte:head>

<!-- ═══════════════════════════════════════════════════
     TOP NAVIGATION
     ═══════════════════════════════════════════════════ -->
<nav
	class="sticky top-0 z-30 flex h-[var(--nav-height)] items-center justify-between border-b border-border bg-background/92 px-6 backdrop-blur-lg md:px-8"
	aria-label="Veřejná navigace"
>
	<LogoMark />
	<div class="flex items-center gap-2">
		<DarkModeToggle />
		<Button intent="ghost" href={resolve('/login')}>Přihlásit se</Button>
		<Button href={resolve('/register')}>Začít zdarma</Button>
	</div>
</nav>

<!-- ═══════════════════════════════════════════════════
     HERO
     ═══════════════════════════════════════════════════ -->
<section
	class="hero-gradient relative overflow-hidden border-b border-border"
	aria-label="Hlavní sekce"
>
	<!-- Decorative blob -->
	<div
		class="pointer-events-none absolute -right-24 -top-28 h-[600px] w-[600px] rounded-full opacity-70"
		style="background: radial-gradient(ellipse, oklch(52.7% 0.154 150deg / 7%) 0%, transparent 70%)"
		aria-hidden="true"
	></div>

	<div
		class="relative z-[1] mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
	>
		<!-- Text column -->
		<div class="flex flex-col gap-6">
			<div class="flex flex-wrap items-center gap-3">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
				>
					<Check class="size-3" />
					Zdarma navždy
				</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
				>
					Vánoce, narozeniny, výročí
				</span>
			</div>

			<h1
				class="font-heading text-4xl font-extrabold leading-tight tracking-tight md:text-5xl md:leading-[1.05]"
			>
				Překvapení zůstane překvapením
			</h1>

			<p class="max-w-[520px] text-lg leading-relaxed text-muted-foreground md:text-xl">
				Vytvořte si přehledný seznam přání a sdílejte ho s rodinou a přáteli. Nikdy
				neuvidíte, kdo co rezervoval.
			</p>

			<div class="flex flex-wrap items-center gap-4">
				<Button size="lg" href={resolve('/register')} class="rounded-lg">
					<Gift data-icon="inline-start" />
					Vytvořit seznam přání
				</Button>
				<a
					href="#jak-to-funguje"
					class="inline-flex items-center gap-1.5 px-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Jak to funguje?
					<ArrowDown class="size-4" />
				</a>
			</div>

			<p class="text-sm text-muted-foreground/70">
				Žádná platební karta. Žádný háček. Navždy zdarma.
			</p>
		</div>

		<!-- Visual column — floating wishlist card -->
		<div class="relative">
			<div class="overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
				<!-- Card header -->
				<div class="hero-card-header border-b border-border px-6 pb-5 pt-6">
					<div
						class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70"
					>
						Přání pro
					</div>
					<div class="font-heading text-2xl font-bold">Tereza Nováková</div>
					<div class="mt-3 flex items-center gap-3">
						<span
							class="hero-badge-event rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
						>
							Narozeniny
						</span>
						<span
							class="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
						>
							8 přání
						</span>
					</div>
				</div>

				<!-- Gift rows -->
				{#each [{ emoji: '📗', hue: '150', name: 'Kniha Atomové návyky', price: '349 Kč · alza.cz', status: 'free' }, { emoji: '🎧', hue: '200', name: 'Bezdrátová sluchátka Sony', price: '2 490 Kč · mall.cz', status: 'reserved' }, { emoji: '🕯️', hue: '60', name: 'Sada vonných svíček', price: '650 Kč · notino.cz', status: 'free' }, { emoji: '🧴', hue: '330', name: 'Kosmetická sada La Mer', price: '1 890 Kč · sephora.cz', status: 'reserved' }] as gift (gift.name)}
					<div
						class="flex items-center gap-4 border-b border-border px-6 py-3.5 last:border-b-0"
					>
						<div
							class="gift-icon-bg flex size-11 shrink-0 items-center justify-center rounded-lg text-[22px]"
							style="--gift-hue: {gift.hue}deg"
						>
							{gift.emoji}
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">{gift.name}</div>
							<div class="mt-0.5 text-xs text-muted-foreground/70">{gift.price}</div>
						</div>
						{#if gift.status === 'free'}
							<span
								class="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
							>
								Volné
							</span>
						{:else}
							<span
								class="hero-badge-reserved shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
							>
								Rezervováno
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Floating note -->
			<div
				class="absolute -bottom-5 -right-3 max-w-[210px] rounded-2xl bg-primary px-5 py-4 text-sm font-semibold leading-snug text-primary-foreground shadow-lg md:-right-6"
				aria-hidden="true"
				style="box-shadow: 0 8px 24px oklch(52.7% 0.154 150deg / 40%)"
			>
				<Lock class="mb-2 size-5" />
				Tereza nevidí, kdo co rezervoval
			</div>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════
     HOW IT WORKS
     ═══════════════════════════════════════════════════ -->
<section
	class="border-b border-border bg-background"
	id="jak-to-funguje"
	aria-label="Jak to funguje"
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-20">
		<span class="section-eyebrow">Jak to funguje</span>
		<h2 class="section-headline">Čtyři kroky k dokonalému překvapení</h2>

		<div class="how-steps relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each [{ icon: List, title: 'Vytvořte seznam', description: 'Pojmenujte seznam, nastavte téma a event — za minutu je připravený.' }, { icon: Gift, title: 'Přidejte přání', description: 'Vložte odkaz z e-shopu nebo popište přání vlastními slovy s cenou.' }, { icon: Share2, title: 'Sdílejte odkaz', description: 'Pošlete jeden odkaz přes WhatsApp, email nebo SMS. Dárci nepotřebují účet.' }, { icon: Sparkles, title: 'Překvapení!', description: 'Dárky přijdou — a vy opravdu nevíte od koho. Přesně tak to má být.' }] as step, index (step.title)}
				<div class="flex flex-col items-center gap-4 text-center">
					<div
						class="group relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background text-primary transition-all hover:border-primary hover:bg-primary/10"
					>
						<span
							class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
						>
							{index + 1}
						</span>
						<step.icon class="size-6" />
					</div>
					<div class="font-heading text-lg font-semibold tracking-snug">{step.title}</div>
					<div class="text-sm leading-relaxed text-muted-foreground">
						{step.description}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════
     FEATURES HEADER
     ═══════════════════════════════════════════════════ -->
<div class="border-b border-border bg-muted">
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 pb-8 pt-16 md:px-8 md:pt-20">
		<span class="section-eyebrow">Funkce</span>
		<h2 class="section-headline !mb-0">Vše, co potřebujete pro bezstarostné dárky</h2>
	</div>
</div>

<!-- ═══════════════════════════════════════════════════
     FEATURE 1 — Tajné rezervace
     ═══════════════════════════════════════════════════ -->
<div class="border-b border-border">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label="Tajné rezervace"
	>
		<div class="flex flex-col gap-5">
			<div class="feat-number" aria-hidden="true">01</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<EyeOff class="size-3.5" />
				Tajné rezervace
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				Vlastník seznamu nikdy neuvidí, kdo co rezervoval
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				Překvapení je zachováno. Systém zaručuje, že vlastník nemůže vidět stav rezervací —
				ani když se pokusí.
			</p>
			<ul class="flex flex-col gap-3">
				{#each ['Rezervace vidí jen dárci — nikdy vlastník', 'Po sdílení vlastník nemůže editovat stávající přání', 'Moderátor vidí plný stav a koordinuje nákupy za vás'] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<Check class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>

		<!-- Visual: owner vs. gifter view -->
		<div class="feat-visual">
			<div class="mb-1 text-sm font-semibold">Vánoční přání 2026 — Martina</div>

			<!-- Owner view -->
			<div class="flex flex-col gap-2">
				<span class="view-label">Pohled vlastníka</span>
				{#each [{ emoji: '🎧', name: 'Bezdrátová sluchátka Sony', sub: '7 490 Kč · alza.cz' }, { emoji: '📖', name: 'Sapiens — Y.N. Harari', sub: '399 Kč' }] as gift (gift.name)}
					<div
						class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
					>
						<div
							class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
							style="--icon-hue: 240deg"
						>
							{gift.emoji}
						</div>
						<div class="flex-1">
							<div class="text-sm font-semibold">{gift.name}</div>
							<div class="mt-0.5 text-xs text-muted-foreground/70">{gift.sub}</div>
						</div>
						<span
							class="feat-status-badge shrink-0 select-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium blur-[5px]"
							aria-hidden="true"
						>
							Skryto
						</span>
					</div>
				{/each}
				<div
					class="flex items-center justify-center gap-1.5 p-2 text-xs text-muted-foreground/70"
				>
					<Lock class="size-3.5" />
					Kdo co rezervoval zůstává skryto
				</div>
			</div>

			<!-- Gifter view -->
			<div class="mt-2 flex flex-col gap-2">
				<span class="view-label view-label-visitor">Pohled dárce</span>
				<div
					class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
				>
					<div
						class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
						style="--icon-hue: 240deg"
					>
						🎧
					</div>
					<div class="flex-1">
						<div class="text-sm font-semibold">Bezdrátová sluchátka Sony</div>
						<div class="mt-0.5 text-xs text-muted-foreground/70">
							7 490 Kč · alza.cz
						</div>
					</div>
					<span
						class="feat-status-badge shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
					>
						Rezervováno
					</span>
				</div>
				<div
					class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
				>
					<div
						class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
						style="--icon-hue: 55deg"
					>
						📖
					</div>
					<div class="flex-1">
						<div class="text-sm font-semibold">Sapiens — Y.N. Harari</div>
						<div class="mt-0.5 text-xs text-muted-foreground/70">399 Kč</div>
					</div>
					<Button size="sm" class="shrink-0 rounded-md">Rezervovat</Button>
				</div>
			</div>
		</div>
	</section>
</div>

<!-- ═══════════════════════════════════════════════════
     FEATURE 2 — Sdílení jedním odkazem
     ═══════════════════════════════════════════════════ -->
<div class="border-b border-border bg-muted">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label="Sdílení jedním odkazem"
	>
		<!-- Visual first on desktop (reversed order) -->
		<div class="feat-visual order-2 md:order-1">
			<div class="mb-1 text-sm font-semibold">Odkaz pro dárce</div>
			<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
				<Link class="size-4 shrink-0 text-muted-foreground/70" />
				<span class="flex-1 truncate font-mono text-sm text-primary">
					darecky.cz/w/martina-vanocni-2026
				</span>
				<Button intent="secondary" size="sm" class="shrink-0 rounded-md">Kopírovat</Button>
			</div>

			<div class="mt-1 text-sm font-semibold">Sdílet přes</div>
			<div class="grid grid-cols-4 gap-2">
				{#each [{ label: 'WhatsApp', emoji: '💬' }, { label: 'Email', emoji: '✉️' }, { label: 'Messenger', emoji: '📱' }, { label: 'Telegram', emoji: '✈️' }] as app (app.label)}
					<div
						class="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 text-xs font-medium text-muted-foreground transition-all hover:border-border hover:bg-muted"
					>
						<span class="text-[22px]">{app.emoji}</span>
						<span>{app.label}</span>
					</div>
				{/each}
			</div>

			<div
				class="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary"
			>
				<UserCheck class="size-4 shrink-0" />
				Dárci nepotřebují účet — stačí zadat jméno
			</div>
		</div>

		<!-- Text -->
		<div class="order-1 flex flex-col gap-5 md:order-2">
			<div class="feat-number" aria-hidden="true">02</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<Share2 class="size-3.5" />
				Sdílení jedním odkazem
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				Pošlete odkaz přes WhatsApp, email nebo SMS
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				Kdokoli může rezervovat. Jeden odkaz pro celou rodinu — dárci nepotřebují vytvářet
				účet.
			</p>
			<ul class="flex flex-col gap-3">
				{#each ['Anonymní mód — dárce zadá jen jméno', 'Sdílet přes WhatsApp, email, Messenger nebo Telegram', 'Trvalý odkaz — funguje po celou dobu události'] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<Check class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

<!-- ═══════════════════════════════════════════════════
     FEATURE 3 — Tematické seznamy
     ═══════════════════════════════════════════════════ -->
<div class="border-b border-border">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label="Tematické seznamy"
	>
		<div class="flex flex-col gap-5">
			<div class="feat-number" aria-hidden="true">03</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<Palette class="size-3.5" />
				Tematické seznamy
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				Vánoce, narozeniny, svatba — každý seznam má svůj styl
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				Každý seznam může mít svůj vlastní vzhled. Vyberte z pěti témat nebo nastavte
				vlastní barvu.
			</p>
			<ul class="flex flex-col gap-3">
				{#each ['Pět připravených témat: Výchozí, Vánoce, Narozeniny, Elegantní, Zábava', 'Vlastní barva s automaticky odvozenou paletou', 'Téma se změní pro všechny návštěvníky okamžitě'] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<Check class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>

		<!-- Visual: theme swatches -->
		<div class="feat-visual">
			<div class="mb-2 text-sm font-semibold">Vyberte téma</div>
			<div class="grid grid-cols-3 gap-3">
				{#each [{ name: 'Výchozí', emoji: '🌿', hue: '150', active: true }, { name: 'Vánoce', emoji: '🎄', hue: '20', active: false }, { name: 'Narozeniny', emoji: '🎂', hue: '55', active: false }, { name: 'Elegantní', emoji: '💍', hue: '270', active: false }, { name: 'Zábava', emoji: '🎉', hue: '340', active: false }, { name: 'Vlastní', emoji: '🎨', hue: '', active: false }] as theme (theme.name)}
					<div
						class="flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all {theme.active
							? 'border-primary shadow-[0_0_0_3px_oklch(from_var(--primary)_l_c_h_/_0.2)]'
							: theme.name === 'Vlastní'
								? 'border-dashed border-border'
								: 'border-transparent'} {theme.hue ? 'theme-swatch' : 'bg-muted'}"
						style={theme.hue ? `--swatch-hue: ${theme.hue}deg` : ''}
					>
						<span class="text-[22px]">{theme.emoji}</span>
						<span class="text-xs font-semibold">{theme.name}</span>
					</div>
				{/each}
			</div>

			<!-- Theme preview -->
			<div class="theme-preview-card mt-4 rounded-xl p-4">
				<div class="theme-preview-title font-heading text-lg font-extrabold">
					Martina — Vánoční přání
				</div>
				<div class="theme-preview-subtitle mt-1 text-sm">
					Tady jsou věci, které by mě letos potěšily :)
				</div>
			</div>
		</div>
	</section>
</div>

<!-- ═══════════════════════════════════════════════════
     FEATURE 4 — Zdarma navždy
     ═══════════════════════════════════════════════════ -->
<div class="border-b border-border bg-muted">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label="Zdarma navždy"
	>
		<!-- Visual first on desktop (reversed) -->
		<div class="feat-visual order-2 md:order-1">
			<div class="flex flex-col gap-4">
				{#each [{ icon: ShieldCheck, title: 'Zdarma navždy', sub: 'Žádná platební karta. Žádný háček. Žádné trial období.' }, { icon: EyeOff, title: 'Žádné reklamy, žádné sledování', sub: 'Žádná data třetím stranám. Vaše přání jsou vaše.' }, { icon: UserCheck, title: 'Dárci bez registrace', sub: 'Stačí zadat jméno. Bez stahování aplikace.' }, { icon: Lock, title: 'Překvapení zaručeno', sub: 'Vlastník nikdy neuvidí, kdo co rezervoval.' }] as trust (trust.title)}
					<div
						class="flex items-start gap-4 rounded-xl border border-border bg-background p-4 transition-all hover:border-border hover:shadow-md"
					>
						<div
							class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<trust.icon class="size-5" />
						</div>
						<div class="flex-1">
							<div class="font-semibold">{trust.title}</div>
							<div class="mt-0.5 text-sm leading-relaxed text-muted-foreground">
								{trust.sub}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Text -->
		<div class="order-1 flex flex-col gap-5 md:order-2">
			<div class="feat-number" aria-hidden="true">04</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<Heart class="size-3.5" />
				Zdarma navždy
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				Žádné poplatky, žádné reklamy
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				Darecky je a vždy bude zdarma. Žádná platební karta, žádné skryté poplatky, žádná
				reklama.
			</p>
			<ul class="flex flex-col gap-3">
				{#each ['Zdarma pro vlastníky i dárce — navždy', 'Žádná reklama, žádné sledování třetí stranou', 'Bez limitu na počet seznamů nebo přání'] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<Check class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

<!-- ═══════════════════════════════════════════════════
     FINAL CTA
     ═══════════════════════════════════════════════════ -->
<section
	class="relative overflow-hidden border-t border-border bg-background"
	aria-label="Výzva k akci"
>
	<!-- Decorative blob -->
	<div
		class="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2"
		style="background: radial-gradient(ellipse, oklch(52.7% 0.154 150deg / 6%) 0%, transparent 70%)"
		aria-hidden="true"
	></div>

	<div
		class="relative z-[1] mx-auto flex max-w-[680px] flex-col items-center gap-6 px-4 py-16 text-center md:px-8 md:py-20"
	>
		<span class="section-eyebrow">Začněte dnes</span>
		<h2 class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl">
			Vytvořte svůj první seznam přání
		</h2>
		<p class="text-lg leading-relaxed text-muted-foreground md:text-xl">
			Registrace jedním klikem. Žádná platební karta. Váš první seznam hotový za minutu.
		</p>
		<div class="flex flex-wrap justify-center gap-4">
			<Button size="lg" href={resolve('/register')} class="min-w-[220px] rounded-lg">
				Začít zdarma
			</Button>
			<Button intent="secondary" size="lg" href={resolve('/login')} class="rounded-lg">
				Přihlásit se
			</Button>
		</div>
		<div
			class="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground/70"
		>
			<span>Zdarma navždy</span>
			<span class="opacity-35" aria-hidden="true">·</span>
			<span>Žádná platební karta</span>
			<span class="opacity-35" aria-hidden="true">·</span>
			<span>Překvapení zaručeno</span>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════════════════ -->
<footer class="border-t border-border bg-muted" aria-label="Zápatí stránky">
	<div
		class="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between md:px-8"
	>
		<!-- Logo -->
		<a
			class="flex items-center gap-2 font-heading font-bold text-primary no-underline hover:opacity-80"
			href={resolve('/')}
			aria-label="Darecky — domovská stránka"
		>
			<span
				class="flex size-6 items-center justify-center rounded-sm bg-primary/10 text-primary"
			>
				<Gift class="size-3.5" />
			</span>
			<span>darecky<span class="font-medium opacity-40">.cz</span></span>
		</a>

		<!-- Links -->
		<nav class="flex items-center gap-1" aria-label="Navigace zápatí">
			<a
				href={resolve('/login')}
				class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-all hover:bg-accent hover:text-foreground"
			>
				Přihlásit se
			</a>
			<span class="text-sm text-border" aria-hidden="true">·</span>
			<a
				href={resolve('/register')}
				class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-all hover:bg-accent hover:text-foreground"
			>
				Vytvořit účet
			</a>
		</nav>

		<!-- Love stamp -->
		<div class="text-sm text-muted-foreground/70">
			&copy; {new Date().getFullYear()} Darecky
		</div>
	</div>
</footer>

<style>
	/* Hero gradient background */
	.hero-gradient {
		background: linear-gradient(
			160deg,
			oklch(98.8% 0.004 150deg) 0%,
			oklch(96% 0.016 150deg) 50%,
			oklch(98.5% 0.006 150deg) 100%
		);
	}

	:global(.dark) .hero-gradient {
		background: linear-gradient(
			160deg,
			oklch(15.3% 0.006 107deg) 0%,
			oklch(18% 0.012 150deg) 50%,
			oklch(15.3% 0.006 107deg) 100%
		);
	}

	/* Section eyebrow */
	.section-eyebrow {
		display: block;
		font-size: 11px;
		font-weight: var(--weight-semibold);
		letter-spacing: var(--tracking-wider);
		text-transform: uppercase;
		color: var(--primary);
		margin-bottom: var(--space-3);
	}

	/* Section headline */
	.section-headline {
		font-family: var(--font-heading);
		font-size: var(--text-4xl);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-snug);
		color: var(--foreground);
		margin-bottom: var(--space-12);
	}

	/* Feature number watermark */
	.feat-number {
		font-family: var(--font-heading);
		font-size: 80px;
		font-weight: 800;
		line-height: 1;
		color: oklch(from var(--primary) l c h / 15%);
		letter-spacing: -0.04em;
		user-select: none;
	}

	/* Feature visual card */
	.feat-visual {
		border-radius: var(--radius-3xl);
		overflow: hidden;
		background: oklch(from var(--primary) 94% 0.035 h);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-xl);
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	:global(.dark) .feat-visual {
		background: oklch(from var(--primary) 22% 0.015 h);
	}

	/* View labels (owner/gifter) */
	.view-label {
		font-size: 10px;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--muted);
		border: 1px solid var(--border);
		padding: 4px 10px;
		border-radius: var(--radius-full);
		display: inline-block;
		width: fit-content;
	}

	.view-label-visitor {
		color: var(--primary);
		background: oklch(from var(--primary) l c h / 10%);
		border-color: oklch(from var(--primary) l c h / 25%);
	}

	/* How-it-works connecting line on desktop */
	@media (width >= 1024px) {
		.how-steps::before {
			content: '';
			position: absolute;
			top: 28px;
			left: calc(12.5% + 28px);
			right: calc(12.5% + 28px);
			height: 2px;
			background: linear-gradient(
				90deg,
				var(--border) 0%,
				var(--primary) 40%,
				var(--primary) 60%,
				var(--border) 100%
			);
		}
	}

	/* Hero card header */
	.hero-card-header {
		background: linear-gradient(135deg, oklch(97% 0.016 150deg), oklch(99% 0.006 150deg));
	}

	:global(.dark) .hero-card-header {
		background: linear-gradient(135deg, oklch(22% 0.02 150deg), oklch(18% 0.01 150deg));
	}

	/* Hero badge - event type */
	.hero-badge-event {
		background: oklch(94% 0.05 60deg);
		color: oklch(42% 0.09 60deg);
	}

	:global(.dark) .hero-badge-event {
		background: oklch(30% 0.04 60deg);
		color: oklch(78% 0.08 60deg);
	}

	/* Gift icon background — uses --gift-hue custom property */
	.gift-icon-bg {
		background: oklch(94% 0.04 var(--gift-hue));
	}

	:global(.dark) .gift-icon-bg {
		background: oklch(30% 0.03 var(--gift-hue));
	}

	/* Hero reserved badge */
	.hero-badge-reserved {
		background: oklch(90% 0.05 200deg / 35%);
		color: oklch(38% 0.1 200deg);
	}

	:global(.dark) .hero-badge-reserved {
		background: oklch(30% 0.06 200deg / 40%);
		color: oklch(72% 0.08 200deg);
	}

	/* Feature 1 — emoji icon dark bg */
	.feat-emoji-icon {
		background: linear-gradient(
			135deg,
			oklch(92% 0.03 var(--icon-hue)),
			oklch(95% 0.02 var(--icon-hue))
		);
	}

	:global(.dark) .feat-emoji-icon {
		background: linear-gradient(
			135deg,
			oklch(25% 0.02 var(--icon-hue)),
			oklch(30% 0.03 var(--icon-hue))
		);
	}

	/* Feature 1 — status badge (green "reserved") */
	.feat-status-badge {
		background: oklch(62% 0.13 145deg / 14%);
		color: oklch(62% 0.13 145deg);
		border-color: oklch(62% 0.13 145deg / 28%);
	}

	:global(.dark) .feat-status-badge {
		background: oklch(62% 0.13 145deg / 20%);
		color: oklch(72% 0.1 145deg);
		border-color: oklch(62% 0.13 145deg / 35%);
	}

	/* Feature 3 — theme swatch card */
	.theme-swatch {
		background: linear-gradient(
			135deg,
			oklch(92% 0.04 var(--swatch-hue)),
			oklch(96% 0.02 var(--swatch-hue))
		);
	}

	:global(.dark) .theme-swatch {
		background: linear-gradient(
			135deg,
			oklch(25% 0.03 var(--swatch-hue)),
			oklch(30% 0.02 var(--swatch-hue))
		);
	}

	/* Feature 3 — theme preview card */
	.theme-preview-card {
		background: linear-gradient(135deg, oklch(92% 0.04 150deg), oklch(96% 0.02 150deg));
	}

	:global(.dark) .theme-preview-card {
		background: linear-gradient(135deg, oklch(25% 0.03 150deg), oklch(30% 0.02 150deg));
	}

	.theme-preview-title {
		color: oklch(35% 0.08 150deg);
	}

	:global(.dark) .theme-preview-title {
		color: oklch(78% 0.06 150deg);
	}

	.theme-preview-subtitle {
		color: oklch(45% 0.06 150deg);
	}

	:global(.dark) .theme-preview-subtitle {
		color: oklch(68% 0.04 150deg);
	}
</style>
