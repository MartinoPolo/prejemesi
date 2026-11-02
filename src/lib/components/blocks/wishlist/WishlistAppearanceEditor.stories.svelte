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
		const styleResetName = 'Styl: obnovit z motivu';

		await expect(canvas.getByRole('radio', { name: 'Bez motivu' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(canvas.queryAllByTestId('wishlist-motif-field-marker')).toHaveLength(0);

		await userEvent.click(christmas);
		await waitFor(() => expect(christmas).toHaveAttribute('aria-checked', 'true'));
		await expect(
			canvasElement.querySelector('[data-testid="story-draft-state"]'),
		).toHaveTextContent('dirty');
		await expect(canvas.getAllByTestId('wishlist-motif-field-marker')).toHaveLength(4);

		await userEvent.click(canvas.getByRole('radio', { name: 'Ostré' }));
		const styleReset = await canvas.findByRole('button', { name: styleResetName });
		await userEvent.click(styleReset);
		await waitFor(() =>
			expect(canvas.queryByRole('button', { name: styleResetName })).toBeNull(),
		);
	};
</script>

<script lang="ts">
	import type { WishlistAppearanceEditorDraft } from './wishlist_appearance_draft.js';

	let draftState = $state<WishlistAppearanceEditorDraft | null>(null);
</script>

<Story name="Unthemed [play: theme selection and field reset]" play={playThemeSelection}>
	{#snippet template(args: AppearanceEditorArgs)}
		<div class="max-w-5xl">
			<WishlistAppearanceEditor
				title="Vánoce 2026"
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

<!-- A stored corner override shows the Styl reset; custom mode without a stored photo shows
     the upload dropzone (stored photos resolve through the upload API, which Storybook lacks). -->
<Story name="Themed with custom background">
	{#snippet template(args: AppearanceEditorArgs)}
		<div class="max-w-5xl">
			<WishlistAppearanceEditor
				title="Vánoce 2026"
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
		<div class="max-w-5xl">
			<WishlistAppearanceEditor
				title="Vánoce 2026"
				palette="sky"
				appearance={{ themeId: 'toys', styleTokens: null, background: null }}
				allowCustomUpload={false}
				ondraftchange={() => {}}
				{...args}
			/>
		</div>
	{/snippet}
</Story>
