<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import * as m from '$lib/paraglide/messages.js';
	import WishlistNote from './WishlistNote.svelte';

	interface PlayContext {
		canvasElement: HTMLElement;
	}

	const { Story } = defineMeta({
		title: 'Blocks/Gift/WishlistNote',
		component: WishlistNote,
		tags: ['autodocs'],
		args: {
			// Realistic owner message with a line break, which the note keeps.
			description:
				'Budu mít 30! Cokoliv z tohoto seznamu mě potěší. Nosím velikost M a boty 43.\nProsím žádné sladkosti, letos se snažím jíst zdravěji.',
			authorName: 'Martin',
		},
	});

	const playFoldAndCancelDismiss = async ({ canvasElement }: PlayContext) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: m.wishlist_note_fold() }));
		await expect(
			canvas.getByRole('button', { name: m.wishlist_note_unfold() }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('button', { name: m.wishlist_note_dismiss() }));
		await expect(canvas.getByText(m.wishlist_note_dismiss_title())).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('button', { name: m.wishlist_note_keep() }));
		await expect(
			canvas.getByRole('button', { name: m.wishlist_note_unfold() }),
		).toBeInTheDocument();
	};
</script>

<Story name="Open" />

<!-- Several správci of a list for someone else: no single author to name. -->
<Story name="Without Author" args={{ authorName: null }} />

<!-- A 90-character unbroken word proves long words wrap instead of overflowing. -->
<Story
	name="Long Word"
	args={{
		description:
			'Prosím-žádné-sladkosti-ani-bonbony-ani-čokoládu-ani-lízátka-letos-se-opravdu-snažím-jíst-zdravě',
	}}
/>

<Story name="Settings Preview" args={{ preview: true }} />

<Story name="Fold and Dismiss [play: fold then cancel dismiss]" play={playFoldAndCancelDismiss} />
