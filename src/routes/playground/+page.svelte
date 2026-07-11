<script lang="ts">
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import {
		StatusBadge,
		STATUS_BADGE_STATUSES,
	} from '$lib/components/derived/status-badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import MailIcon from '@lucide/svelte/icons/mail';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

	let switchChecked = $state(false);
	let selectValue = $state('');
</script>

<main class="min-h-screen bg-background text-foreground">
	<header class="border-b border-border">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<h1 class="text-xl font-bold tracking-tight">Component Playground</h1>
			<DarkModeToggle />
		</div>
	</header>

	<div class="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12">
		<section class="flex flex-col gap-3 text-center">
			<h2 class="text-4xl font-extrabold tracking-tight">Component Showcase</h2>
			<p class="text-lg text-muted-foreground">
				Přejeme si component library with theme, light, and dark mode states.
			</p>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Buttons</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Button>Default</Button>
				<Button intent="secondary">Secondary</Button>
				<Button intent="outline">Outline</Button>
				<Button intent="ghost">Ghost</Button>
				<Button intent="link">Link</Button>
				<Button intent="danger">Destructive</Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button size="sm">Small</Button>
				<Button size="md">Default</Button>
				<Button size="lg">Large</Button>
				<Button size="icon" aria-label="Send email"><MailIcon data-icon /></Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button disabled>Disabled</Button>
				<Button disabled>
					<LoaderIcon class="animate-spin" data-icon="inline-start" />
					Loading...
				</Button>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Badges</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Badge>Default</Badge>
				<Badge tone="neutral" badgeStyle="subtle">Secondary</Badge>
				<Badge tone="neutral" badgeStyle="outlined">Outline</Badge>
				<Badge tone="danger">Destructive</Badge>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Status Badges</h3>
			<div class="flex flex-wrap items-center gap-3">
				{#each STATUS_BADGE_STATUSES as status (status)}
					<StatusBadge {status}>{status}</StatusBadge>
				{/each}
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Cards &amp; Form Elements</h3>
			<div class="grid gap-6 md:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title>Text Inputs</Card.Title>
						<Card.Description>Standard input fields and textarea.</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-4">
						<div class="flex flex-col gap-2">
							<Label for="name">Name</Label>
							<Input id="name" placeholder="Enter your name" />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="email">Email</Label>
							<Input id="email" type="email" placeholder="you@example.com" />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="bio">Bio</Label>
							<Textarea id="bio" placeholder="Tell us about yourself…" />
						</div>
					</Card.Content>
					<Card.Footer>
						<Button class="w-full">Submit</Button>
					</Card.Footer>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Controls</Card.Title>
						<Card.Description>Switches and checkboxes.</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-6">
						<div class="flex items-center justify-between">
							<Label for="notifications">Enable notifications</Label>
							<Switch id="notifications" />
						</div>
						<div class="flex items-center justify-between">
							<Label for="marketing">Marketing emails</Label>
							<Switch id="marketing" />
						</div>
						<Separator />
						<div class="flex flex-col gap-3">
							<span class="text-sm font-medium">Interests</span>
							<div class="flex items-center gap-2">
								<Checkbox id="frontend" />
								<Label for="frontend" class="font-normal">Frontend</Label>
							</div>
							<div class="flex items-center gap-2">
								<Checkbox id="backend" />
								<Label for="backend" class="font-normal">Backend</Label>
							</div>
							<div class="flex items-center gap-2">
								<Checkbox id="devops" />
								<Label for="devops" class="font-normal">DevOps</Label>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Alerts</h3>
			<div class="flex flex-col gap-3">
				<Alert.Root>
					<InfoIcon size={16} />
					<Alert.Title>Information</Alert.Title>
					<Alert.Description
						>This is an informational alert using the default variant.</Alert.Description
					>
				</Alert.Root>
				<Alert.Root tone="destructive">
					<TriangleAlertIcon size={16} />
					<Alert.Title>Error</Alert.Title>
					<Alert.Description
						>Something went wrong. Please try again later.</Alert.Description
					>
				</Alert.Root>
				<Alert.Root class="border-primary/50 text-primary [&>svg]:text-primary">
					<CircleCheckIcon size={16} />
					<Alert.Title>Success</Alert.Title>
					<Alert.Description>Your changes have been saved successfully.</Alert.Description
					>
				</Alert.Root>
			</div>
		</section>

		<Separator />

		<!-- ═══════════════ TOKEN REVIEW SECTIONS ═══════════════ -->
		<section class="flex flex-col gap-3 text-center">
			<h2 class="text-4xl font-extrabold tracking-tight">Token Review</h2>
			<p class="text-lg text-muted-foreground">
				New semantic tokens for dark mode. Toggle dark mode above to compare.
			</p>
		</section>

		<Separator />

		<!-- C1: Status Colors -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C1: Status Colors</h3>
			<p class="text-sm text-muted-foreground">
				These tokens had no dark mode overrides. Light-mode values were used in dark mode,
				causing poor contrast. New dark values increase lightness for readability.
			</p>

			<div class="grid grid-cols-4 gap-3">
				{#each [{ name: '--status-success', label: 'Success', light: 'L=66%', dark: 'L=72%' }, { name: '--status-warning', label: 'Warning', light: 'L=77%', dark: 'L=82%' }, { name: '--status-danger', label: 'Danger', light: 'L=62%', dark: 'L=68%' }, { name: '--status-info', label: 'Info', light: 'L=66%', dark: 'L=72%' }] as swatch (swatch.name)}
					<div class="flex flex-col gap-1">
						<div
							class="h-12 rounded-md border border-border"
							style="background: var({swatch.name})"
						></div>
						<span class="text-xs font-medium">{swatch.label}</span>
						<span class="text-[10px] text-muted-foreground"
							>Light: {swatch.light} / Dark: {swatch.dark}</span
						>
					</div>
				{/each}
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Real usage: Badges</span>
				<div class="flex flex-wrap gap-2">
					<Badge tone="success">Success</Badge>
					<Badge tone="warning">Warning</Badge>
					<Badge tone="danger">Danger</Badge>
					<Badge tone="info">Info</Badge>
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
				<span class="text-sm font-medium">As text on card surface</span>
				<span class="text-status-success font-medium">Payment completed</span>
				<span class="text-status-warning font-medium">Awaiting review</span>
				<span class="text-status-danger font-medium">Error occurred</span>
				<span class="text-status-info font-medium">Processing</span>
			</div>
		</section>

		<Separator />

		<!-- C1: Domain Colors -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C1: Domain Colors</h3>
			<p class="text-sm text-muted-foreground">
				Reserved, liked, and archived colors had no dark overrides. Now slightly brighter in
				dark mode.
			</p>

			<div class="grid grid-cols-3 gap-3">
				{#each [{ name: '--reserved', label: 'Reserved', light: 'L=62%', dark: 'L=68%' }, { name: '--liked', label: 'Liked', light: 'L=64%', dark: 'L=70%' }, { name: '--archived', label: 'Archived', light: 'L=55%', dark: 'L=65%' }] as swatch (swatch.name)}
					<div class="flex flex-col gap-1">
						<div
							class="h-12 rounded-md border border-border"
							style="background: var({swatch.name})"
						></div>
						<span class="text-xs font-medium">{swatch.label}</span>
						<span class="text-[10px] text-muted-foreground"
							>Light: {swatch.light} / Dark: {swatch.dark}</span
						>
					</div>
				{/each}
			</div>

			<div class="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
				<span class="text-reserved font-medium">Reserved by someone</span>
				<span class="text-liked font-medium">You liked this gift</span>
				<span class="text-archived font-medium">Archived wishlist</span>
			</div>
		</section>

		<Separator />

		<!-- C1: Per-wishlist palette (Redesign 2026) -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C1: Per-wishlist palette</h3>
			<p class="text-sm text-muted-foreground">
				A <code class="rounded bg-muted px-1 text-xs">data-palette</code> wrapper re-derives every
				semantic token for its subtree, giving each wishlist its own identity with zero JS. The
				same mock card is shown below under three palettes.
			</p>

			<div class="grid gap-4 md:grid-cols-3">
				{#each ['sky', 'sakura', 'honey'] as demoPalette (demoPalette)}
					<div
						data-palette={demoPalette}
						class="overflow-hidden rounded-lg border-2 border-border-strong bg-background"
					>
						<div
							class="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground"
						>
							<span class="font-semibold capitalize">{demoPalette}</span>
							<span class="text-xs opacity-80">3 gifts</span>
						</div>
						<div class="border-t border-border bg-card px-4 py-3">
							<p class="text-sm text-muted-foreground">
								Example content on a themed surface with a themed border.
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<Separator />

		<!-- C2: Form Control Surfaces -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C2: Form Control Surfaces</h3>
			<p class="text-sm text-muted-foreground">
				Checkbox, Select, and InputGroup used <code class="rounded bg-muted px-1 text-xs"
					>dark:bg-input/30</code
				>
				for subtle dark backgrounds. Now uses
				<code class="rounded bg-muted px-1 text-xs">--input-surface</code> (transparent in light,
				5% white in dark).
			</p>

			<div class="grid gap-4 md:grid-cols-3">
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Checkbox</span
					>
					<div class="flex items-center gap-2">
						<Checkbox />
						<span class="text-sm">Accept terms</span>
					</div>
				</div>

				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Select</span
					>
					<Select.Root type="single" bind:value={selectValue}>
						<Select.Trigger>
							{selectValue || 'Choose...'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Item value="a" label="Option A" />
								<Select.Item value="b" label="Option B" />
								<Select.Item value="c" label="Option C" />
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>InputGroup</span
					>
					<InputGroup.Root>
						<InputGroup.Addon>https://</InputGroup.Addon>
						<InputGroup.Input placeholder="example.com" />
					</InputGroup.Root>
				</div>
			</div>
		</section>

		<Separator />

		<!-- C2: Validation Emphasis -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C2: Validation Emphasis</h3>
			<p class="text-sm text-muted-foreground">
				Invalid states used <code class="rounded bg-muted px-1 text-xs"
					>dark:ring-destructive/40</code
				>
				and
				<code class="rounded bg-muted px-1 text-xs">dark:border-destructive/50</code>. Now
				uses <code class="rounded bg-muted px-1 text-xs">--invalid-ring</code> and
				<code class="rounded bg-muted px-1 text-xs">--invalid-border</code> tokens.
			</p>

			<div class="grid gap-4 md:grid-cols-3">
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Checkbox (invalid)</span
					>
					<div class="flex items-center gap-2">
						<Checkbox aria-invalid="true" />
						<span class="text-sm text-destructive">Required</span>
					</div>
				</div>

				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Input (invalid)</span
					>
					<Input aria-invalid="true" placeholder="Invalid input" />
				</div>

				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Switch (invalid)</span
					>
					<Switch aria-invalid="true" />
				</div>
			</div>
		</section>

		<Separator />

		<!-- C2: Switch Tokens -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">C2: Switch Tokens</h3>
			<p class="text-sm text-muted-foreground">
				Switch track/thumb used mode-specific dark: overrides. Now uses
				<code class="rounded bg-muted px-1 text-xs">--switch-track</code>,
				<code class="rounded bg-muted px-1 text-xs">--switch-thumb</code>, and
				<code class="rounded bg-muted px-1 text-xs">--switch-thumb-active</code>.
			</p>

			<div class="grid gap-4 md:grid-cols-5">
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Off</span
					>
					<Switch />
				</div>
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>On</span
					>
					<Switch checked={true} />
				</div>
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Interactive</span
					>
					<div class="flex items-center gap-2">
						<Switch bind:checked={switchChecked} />
						<span class="text-sm">{switchChecked ? 'On' : 'Off'}</span>
					</div>
				</div>
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Invalid</span
					>
					<Switch aria-invalid="true" />
				</div>
				<div class="flex flex-col gap-3 rounded-lg bg-secondary p-4">
					<span
						class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Small</span
					>
					<Switch size="sm" />
				</div>
			</div>
		</section>

		<Separator />

		<!-- Token Reference Table -->
		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Token Reference</h3>
			<p class="text-sm text-muted-foreground">
				All new semantic tokens. Swatches auto-switch with dark mode.
			</p>

			<div class="overflow-hidden rounded-lg border border-border">
				<table class="w-full text-xs">
					<thead>
						<tr class="bg-muted text-left text-muted-foreground">
							<th class="px-3 py-2 font-semibold">Token</th>
							<th class="px-3 py-2 font-semibold">Swatch</th>
							<th class="px-3 py-2 font-semibold">Light</th>
							<th class="px-3 py-2 font-semibold">Dark</th>
						</tr>
					</thead>
					<tbody>
						{#each [{ token: '--input-surface', light: 'transparent', dark: '5% white' }, { token: '--input-surface-hover', light: 'transparent', dark: '8% white' }, { token: '--invalid-ring', light: 'destructive 20%', dark: 'destructive 40%' }, { token: '--invalid-border', light: 'destructive 100%', dark: 'destructive 50%' }, { token: '--switch-track', light: 'var(--input)', dark: '12% white' }, { token: '--switch-thumb', light: 'var(--background)', dark: 'var(--foreground)' }, { token: '--switch-thumb-active', light: 'var(--background)', dark: 'var(--primary-fg)' }] as row (row.token)}
							<tr class="border-t border-border">
								<td class="px-3 py-2"><code>{row.token}</code></td>
								<td class="px-3 py-2">
									<div
										class="h-6 w-12 rounded border border-border"
										style="background: var({row.token})"
									></div>
								</td>
								<td class="px-3 py-2 text-muted-foreground">{row.light}</td>
								<td class="px-3 py-2 text-muted-foreground">{row.dark}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<Separator />
		<footer class="pb-8 text-center text-sm text-muted-foreground">
			Přejeme si design system playground
		</footer>
	</div>
</main>
