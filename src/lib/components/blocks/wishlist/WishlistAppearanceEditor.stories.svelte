<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import WishlistAppearanceEditor from './WishlistAppearanceEditor.svelte';

	type AppearanceEditorArgs = Partial<ComponentProps<typeof WishlistAppearanceEditor>>;

	interface PlayContext {
		canvasElement: HTMLElement;
	}

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/AppearanceEditor',
		component: WishlistAppearanceEditor,
		tags: ['autodocs'],
	});

	const playThemeSelection = async ({ canvasElement }: PlayContext) => {
		const canvas = within(canvasElement);
		const christmas = canvas.getByRole('radio', { name: 'Vánoce' });
		const reset = canvas.getByRole('button', { name: 'Obnovit styl podle motivu' });

		await expect(canvas.getByRole('radio', { name: 'Bez motivu' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(reset).toBeDisabled();

		await userEvent.click(christmas);
		await waitFor(() => expect(christmas).toHaveAttribute('aria-checked', 'true'));
		await expect(
			canvasElement.querySelector('[data-testid="story-draft-state"]'),
		).toHaveTextContent('dirty');

		await userEvent.click(canvas.getByRole('radio', { name: 'Ostré' }));
		await waitFor(() => expect(reset).toBeEnabled());
		await userEvent.click(reset);
		await waitFor(() => expect(reset).toBeDisabled());
	};
</script>

<script lang="ts">
	import type { WishlistAppearanceEditorDraft } from './wishlist_appearance_draft.js';

	let draftState = $state<WishlistAppearanceEditorDraft | null>(null);
</script>

<Story name="Unthemed [play: theme selection and style reset]" play={playThemeSelection}>
	{#snippet template(args: AppearanceEditorArgs)}
		<div class="max-w-3xl">
			<WishlistAppearanceEditor
				palette="sky"
				appearance={{ themeId: null, styleTokens: null, background: null }}
				allowCustomUpload
				ondraftchange={(draft) => (draftState = draft)}
				{...args}
			/>
			<p class="sr-only" data-testid="story-draft-state">
				{draftState?.appearanceDirty === true ? 'dirty' : 'clean'}
			</p>
		</div>
	{/snippet}
</Story>

<!-- A stored corner override enables the reset button; custom mode without a stored photo shows
     the upload dropzone (stored photos resolve through the upload API, which Storybook lacks). -->
<Story name="Themed with custom background">
	{#snippet template(args: AppearanceEditorArgs)}
		<div class="max-w-3xl">
			<WishlistAppearanceEditor
				palette="ruby"
				appearance={{
					themeId: 'christmas',
					styleTokens: { corners: 'sharp' },
					background: { mode: 'custom', imageKey: null, placement: 'full', dim: 35 },
				}}
				allowCustomUpload
				ondraftchange={() => {}}
				{...args}
			/>
		</div>
	{/snippet}
</Story>

<!-- Demo playground lists may not upload, so the custom photo option is disabled. -->
<Story name="Demo playground">
	{#snippet template(args: AppearanceEditorArgs)}
		<div class="max-w-3xl">
			<WishlistAppearanceEditor
				palette="sky"
				appearance={{ themeId: 'toys', styleTokens: null, background: null }}
				allowCustomUpload={false}
				ondraftchange={() => {}}
				{...args}
			/>
		</div>
	{/snippet}
</Story>
