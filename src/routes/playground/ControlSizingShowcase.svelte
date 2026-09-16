<script lang="ts">
	import BellIcon from '@lucide/svelte/icons/bell';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { Button, BUTTON_INTENTS } from '$lib/components/base/button/index.js';
	import {
		Checkbox,
		CheckboxSurface,
		checkboxVariants,
	} from '$lib/components/base/checkbox/index.js';
	import { CONTROL_SIZES } from '$lib/components/base/control_sizing.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import { SearchField } from '$lib/components/base/search-field/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Toggle } from '$lib/components/base/toggle/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import LikeButton from '$lib/components/blocks/gift/LikeButton.svelte';
	import { NotificationBell } from '$lib/components/blocks/notification/index.js';
	import UserMenu from '$lib/components/blocks/navbar/UserMenu.svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';

	const LIKE_APPEARANCES = ['ghost', 'sticker'] as const;

	setLikesContext(
		() => [],
		() => false,
		() => {},
	);

	let selectedOption = $state('one');
	let selectedSegment = $state('one');
</script>

{#snippet selectOptions()}
	<Select.Content>
		<Select.Group>
			<Select.Item value="one" label="One">One</Select.Item>
			<Select.Item value="two" label="Two">Two</Select.Item>
		</Select.Group>
	</Select.Content>
{/snippet}

<section data-testid="control-sizing-showcase" class="flex flex-col gap-8">
	<div class="flex flex-col gap-2">
		<h3 class="text-2xl font-semibold tracking-tight">Control sizing</h3>
		<p class="text-sm text-muted-foreground">
			Canonical comparison of real controls. Explicit sizes stay fixed; the separate default
			row is 40 px on mobile and 32 px from the <code>sm</code> breakpoint.
		</p>
	</div>

	<div class="flex flex-col gap-6">
		{#each CONTROL_SIZES as size (size)}
			<section
				data-size-row={size}
				class="flex flex-col gap-3 rounded-panel border border-border p-4"
			>
				<div class="flex items-baseline gap-2">
					<h4 class="font-semibold uppercase">{size}</h4>
					<span class="text-xs text-muted-foreground"
						>Compatible peers, 8 px action gap</span
					>
				</div>

				<div data-peer-group="core" class="flex flex-wrap items-center gap-2">
					<Button {size} data-control-peer>Button</Button>
					<Button
						{size}
						format="icon"
						aria-label={`${size} icon button`}
						data-control-peer
					>
						<CheckIcon data-icon />
					</Button>
					<Input
						{size}
						class="w-40 min-w-0"
						aria-label={`${size} input`}
						placeholder="Input"
						data-control-peer
					/>
					<Select.Root type="single" bind:value={selectedOption}>
						<Select.Trigger
							{size}
							appearance="raised"
							class="w-40 min-w-0"
							aria-label={`${size} select`}
							data-control-peer
						>
							{selectedOption === 'two' ? 'Two' : 'One'}
						</Select.Trigger>
						{@render selectOptions()}
					</Select.Root>
					<Checkbox {size} aria-label={`${size} checkbox`} checked data-control-peer />
					<Toggle {size} format="icon" aria-label={`${size} toggle`} data-control-peer>
						<CheckIcon data-icon />
					</Toggle>
					{#each LIKE_APPEARANCES as appearance (appearance)}
						<span data-like-treatment={appearance} class="inline-flex">
							<LikeButton
								giftId={`showcase-${size}-${appearance}`}
								giftName={`${size} ${appearance} LikeButton`}
								likeCount={3}
								{size}
								{appearance}
							/>
						</span>
					{/each}
					<SegmentedToggle.Root
						{size}
						bind:value={selectedSegment}
						aria-label={`${size} segmented toggle`}
						data-control-peer
					>
						<SegmentedToggle.Item value="one">One</SegmentedToggle.Item>
						<SegmentedToggle.Item
							value="two"
							format="icon"
							aria-label={`${size} segment two`}
						>
							<CheckIcon data-icon />
						</SegmentedToggle.Item>
					</SegmentedToggle.Root>
				</div>

				<div data-peer-group="composed" class="flex flex-wrap items-center gap-2">
					<InputGroup.Root {size} class="w-40 min-w-0" data-control-peer>
						<InputGroup.Addon>@</InputGroup.Addon>
						<InputGroup.Input
							aria-label={`${size} input group`}
							placeholder="username"
						/>
					</InputGroup.Root>
					<SearchField
						{size}
						class="w-40 min-w-0"
						aria-label={`${size} search field`}
						placeholder="Search"
						data-control-peer
					/>
					<div data-shell-peers class="flex items-center gap-2">
						<NotificationBell {size} />
						<UserMenu
							{size}
							userName="Showcase User"
							userEmail="showcase@example.com"
							userInitials="SU"
						/>
					</div>
				</div>

				<div class="flex flex-col gap-3">
					<h5 class="text-sm font-semibold">All button treatments</h5>
					{#each BUTTON_INTENTS as intent (intent)}
						<div data-button-intent={intent} class="flex flex-wrap items-center gap-2">
							<span class="w-36 text-sm text-muted-foreground">{intent}</span>
							<Button {intent} {size}>{intent}</Button>
							<Button
								{intent}
								{size}
								format="icon"
								aria-label={`${size} ${intent} icon treatment`}
							>
								<BellIcon data-icon />
							</Button>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>

	<section data-default-responsive-row class="flex flex-col gap-3">
		<h4 class="font-semibold">Default responsive size</h4>
		<div class="flex flex-wrap items-center gap-2">
			<Button data-responsive-peer>Default button</Button>
			<Input
				class="w-40 min-w-0"
				aria-label="Default responsive input"
				placeholder="Default input"
				data-responsive-peer
			/>
			<Select.Root type="single" bind:value={selectedOption}>
				<Select.Trigger
					appearance="raised"
					class="w-40 min-w-0"
					aria-label="Default responsive select"
					data-responsive-peer
				>
					{selectedOption === 'two' ? 'Two' : 'One'}
				</Select.Trigger>
				{@render selectOptions()}
			</Select.Root>
			<Checkbox aria-label="Default responsive checkbox" data-responsive-peer />
			<Toggle aria-label="Default responsive toggle" data-responsive-peer>Toggle</Toggle>
			{#each LIKE_APPEARANCES as appearance (appearance)}
				<span data-like-treatment={appearance} class="inline-flex">
					<LikeButton
						giftId={`showcase-responsive-${appearance}`}
						giftName={`responsive ${appearance} LikeButton`}
						likeCount={3}
						{appearance}
					/>
				</span>
			{/each}
			<SegmentedToggle.Root
				bind:value={selectedSegment}
				aria-label="Default segmented toggle"
				data-responsive-peer
			>
				<SegmentedToggle.Item value="one">One</SegmentedToggle.Item>
				<SegmentedToggle.Item value="two">Two</SegmentedToggle.Item>
			</SegmentedToggle.Root>
			<div data-responsive-shell class="flex items-center gap-2">
				<NotificationBell />
				<UserMenu
					userName="Showcase User"
					userEmail="showcase@example.com"
					userInitials="SU"
				/>
			</div>
		</div>
	</section>

	<section data-state-examples class="flex flex-col gap-3">
		<h4 class="font-semibold">Interaction states</h4>
		<div class="flex flex-wrap items-center gap-2">
			<Checkbox size="md" checked aria-label="Checked checkbox" />
			<Checkbox size="md" indeterminate aria-label="Mixed checkbox" />
			<Checkbox size="md" disabled aria-label="Disabled checkbox" />
			<div
				class={checkboxVariants({ size: 'md' }).owner()}
				aria-label="Decorative checked surface"
			>
				<CheckboxSurface size="md" checked />
			</div>
			<Input size="md" state="error" aria-label="Error input" value="Invalid value" />
			<Button size="md" disabled>Disabled</Button>
			<Button size="md" disabled aria-label="Pending action">
				<LoaderIcon class="animate-spin" data-icon="inline-start" />
				Pending
			</Button>
			<Button size="md" data-focus-example>Focus with keyboard</Button>
		</div>
	</section>

	<section class="rounded-panel border border-border p-4 text-sm text-muted-foreground">
		<h4 class="mb-2 font-semibold text-foreground">Deliberate exceptions</h4>
		<p>
			Switches retain their compact track geometry, range inputs retain native
			continuous-control behavior, textareas remain rows-driven, and decorative checkbox
			surfaces are not standalone interactive controls. These exceptions are described rather
			than incorrectly scaled.
		</p>
	</section>
</section>
