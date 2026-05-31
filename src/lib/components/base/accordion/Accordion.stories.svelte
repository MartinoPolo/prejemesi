<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import * as Accordion from './index.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';

	const { Story } = defineMeta({
		title: 'Base/Accordion',
		component: Accordion.Root,
		tags: ['autodocs'],
	});

	/** Query only accordion trigger buttons via the bits-ui data attribute. */
	function getAccordionTriggers(canvasElement: HTMLElement): HTMLElement[] {
		return Array.from(canvasElement.querySelectorAll('[data-accordion-trigger]'));
	}

	const playSingleOpenSwitches = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const triggers = getAccordionTriggers(canvasElement);

		// Starts with item-1 expanded
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');
		await expect(triggers[1]).toHaveAttribute('data-state', 'closed');
		await expect(triggers[2]).toHaveAttribute('data-state', 'closed');

		// Click item-2 — should open it and close item-1 (single mode)
		await userEvent.click(triggers[1]);
		await expect(triggers[0]).toHaveAttribute('data-state', 'closed');
		await expect(triggers[1]).toHaveAttribute('data-state', 'open');

		// Click item-3 — should open it and close item-2
		await userEvent.click(triggers[2]);
		await expect(triggers[1]).toHaveAttribute('data-state', 'closed');
		await expect(triggers[2]).toHaveAttribute('data-state', 'open');
	};

	const playMultipleBothOpen = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const triggers = getAccordionTriggers(canvasElement);

		// "Multiple Open" starts with item-1 and item-2 expanded
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');
		await expect(triggers[1]).toHaveAttribute('data-state', 'open');
		await expect(triggers[2]).toHaveAttribute('data-state', 'closed');

		// Expand third item — all three should be open
		await userEvent.click(triggers[2]);
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');
		await expect(triggers[1]).toHaveAttribute('data-state', 'open');
		await expect(triggers[2]).toHaveAttribute('data-state', 'open');
	};

	const playDisabledNoChange = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const triggers = getAccordionTriggers(canvasElement);

		// "Disabled Item" — item-1 expanded, item-2 disabled, item-3 collapsed
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');
		await expect(triggers[1]).toBeDisabled();
		await expect(triggers[2]).toHaveAttribute('data-state', 'closed');

		// Disabled trigger should not be clickable (pointer-events: none)
		await expect(triggers[1]).toHaveAttribute('data-state', 'closed');

		// First item should still be expanded
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');
	};

	const playKeyboardToggle = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const triggers = getAccordionTriggers(canvasElement);

		// All start collapsed
		await expect(triggers[0]).toHaveAttribute('data-state', 'closed');

		// Focus first trigger and press Enter — should expand
		(triggers[0] as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');
		await expect(triggers[0]).toHaveAttribute('data-state', 'open');

		// Press Space on same trigger — should collapse
		await userEvent.keyboard(' ');
		await expect(triggers[0]).toHaveAttribute('data-state', 'closed');

		// Focus second trigger and press Space — should expand
		(triggers[1] as HTMLButtonElement).focus();
		await userEvent.keyboard(' ');
		await expect(triggers[1]).toHaveAttribute('data-state', 'open');
	};
</script>

<Story name="Single Open [play: switches items open]" play={playSingleOpenSwitches}>
	{#snippet template()}
		<div class="w-80">
			<Accordion.Root type="single" value="item-1">
				<Accordion.Item value="item-1">
					<Accordion.Trigger>What is Darecky?</Accordion.Trigger>
					<Accordion.Content>
						Darecky is a modern web application built with SvelteKit and a rich
						component library.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>How does it work?</Accordion.Trigger>
					<Accordion.Content>
						It uses SvelteKit for routing and server-side rendering, with Tailwind CSS
						for styling and Drizzle ORM for database access.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>Which technologies are used?</Accordion.Trigger>
					<Accordion.Content>
						SvelteKit, TypeScript, Tailwind CSS, Drizzle ORM, and Vitest for testing.
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	{/snippet}
</Story>

<Story name="Multiple Open [play: multiple items open]" play={playMultipleBothOpen}>
	{#snippet template()}
		<div class="w-80">
			<Accordion.Root type="multiple" value={['item-1', 'item-2']}>
				<Accordion.Item value="item-1">
					<Accordion.Trigger>What is Darecky?</Accordion.Trigger>
					<Accordion.Content>
						Darecky is a modern web application built with SvelteKit and a rich
						component library.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>How does it work?</Accordion.Trigger>
					<Accordion.Content>
						It uses SvelteKit for routing and server-side rendering, with Tailwind CSS
						for styling and Drizzle ORM for database access.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>Which technologies are used?</Accordion.Trigger>
					<Accordion.Content>
						SvelteKit, TypeScript, Tailwind CSS, Drizzle ORM, and Vitest for testing.
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	{/snippet}
</Story>

<Story name="Disabled Item [play: disabled no change]" play={playDisabledNoChange}>
	{#snippet template()}
		<div class="w-80">
			<Accordion.Root type="single" value="item-1">
				<Accordion.Item value="item-1">
					<Accordion.Trigger>What is Darecky?</Accordion.Trigger>
					<Accordion.Content>
						Darecky is a modern web application built with SvelteKit and a rich
						component library.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2" disabled>
					<Accordion.Trigger>How does it work? (disabled)</Accordion.Trigger>
					<Accordion.Content>
						It uses SvelteKit for routing and server-side rendering, with Tailwind CSS
						for styling and Drizzle ORM for database access.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>Which technologies are used?</Accordion.Trigger>
					<Accordion.Content>
						SvelteKit, TypeScript, Tailwind CSS, Drizzle ORM, and Vitest for testing.
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	{/snippet}
</Story>

<Story name="Keyboard Navigation [play: keyboard toggle]" play={playKeyboardToggle}>
	{#snippet template()}
		<div class="w-80">
			<StoryKeyboardHints>
				<KeyboardHint keys="Enter / Space" action="Toggle item" />
				<KeyboardHint keys="↓ / ↑" action="Move focus between items" />
				<KeyboardHint keys="Home / End" action="Jump to first / last item" />
			</StoryKeyboardHints>
			<Accordion.Root type="single">
				<Accordion.Item value="item-1">
					<Accordion.Trigger>What is Darecky?</Accordion.Trigger>
					<Accordion.Content>
						Darecky is a modern web application built with SvelteKit and a rich
						component library.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>How does it work?</Accordion.Trigger>
					<Accordion.Content>
						It uses SvelteKit for routing and server-side rendering, with Tailwind CSS
						for styling and Drizzle ORM for database access.
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>Which technologies are used?</Accordion.Trigger>
					<Accordion.Content>
						SvelteKit, TypeScript, Tailwind CSS, Drizzle ORM, and Vitest for testing.
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	{/snippet}
</Story>
