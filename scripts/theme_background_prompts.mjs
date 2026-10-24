/**
 * Prompts for the curated wishlist background library (#531), kept free of side effects so a
 * test can check them against the theme and library registries.
 */

/** Keyed and ordered like `WISHLIST_THEME_IDS` in `src/lib/theme/wishlist_themes.ts`. */
export const THEME_PROMPTS = {
	toys: {
		subject: 'colorful wooden toys, building blocks, a spinning top, a toy train and balloons',
		palette: 'sky blue, sunny yellow and soft red on a pale blue-white ground',
	},
	kids_clothes: {
		subject: 'tiny folded sweaters, knitted socks, a small dress on a hanger and buttons',
		palette: 'cherry-blossom pink, cream and soft coral',
	},
	gamer: {
		subject: 'game controllers, a headset, pixel hearts and glowing neon shapes',
		palette: 'deep violet and near-black with magenta and cyan neon accents',
	},
	minimal: {
		subject: 'a few simple geometric objects, a ceramic vase and a single paper sheet',
		palette: 'graphite, warm white and light grey',
	},
	wedding: {
		subject: 'white roses, eucalyptus sprigs, satin ribbon and two gold rings',
		palette: 'ivory, champagne gold and blush',
	},
	christmas: {
		subject: 'fir branches, glass baubles, pine cones, wrapped gifts and warm fairy lights',
		palette: 'deep ruby red, pine green and gold on a dark evening ground',
	},
	outdoor: {
		subject: 'a hiking backpack, a tent, pine trees, a compass and a camping mug',
		palette: 'matcha green, earthy brown and misty sky blue',
	},
	books: {
		subject: 'stacked books, an open book, reading glasses and a cup of tea',
		palette: 'ocean blue, paper beige and warm brown',
	},
	baby: {
		subject: 'a soft teddy bear, a rattle, baby socks, clouds and little stars',
		palette: 'mint green, pale yellow and cream',
	},
	retro: {
		subject: 'a vinyl record player, a cassette tape, a rotary phone and seventies shapes',
		palette: 'peach, mustard and teal',
	},
	party: {
		subject: 'balloons, paper confetti, streamers, party hats and a cake',
		palette: 'pink, lilac and bright gold',
	},
	space: {
		subject: 'planets, a small rocket, stars, a comet and distant galaxies',
		palette: 'deep navy and black with sky-blue and white starlight',
	},
	music: {
		subject: 'an acoustic guitar, headphones, a vinyl record and drifting music notes',
		palette: 'ruby red, black and warm cream',
	},
	pets: {
		subject: 'a dog bed, a ball of yarn, paw prints, a food bowl and pet toys without animals',
		palette: 'honey yellow, warm brown and cream',
	},
	gourmet: {
		subject: 'fresh herbs, olive oil, cheese, artisan bread, spices and copper cookware',
		palette: 'peach, olive green and terracotta',
	},
	travel: {
		subject: 'a vintage suitcase, a map, a passport, postcards, a camera and paper planes',
		palette: 'ocean blue, sand and sunset orange',
	},
};

/** Ordered like `WISHLIST_LIBRARY_IMAGE_VARIANTS` in `src/lib/theme/wishlist_background_library.ts`. */
export const BACKGROUND_VARIANTS = ['illustrated', 'photo'];

const VARIANT_STYLES = {
	illustrated:
		'Flat hand-drawn illustration with clean outlines, gentle paper texture and soft shading.',
	photo: 'Realistic styled flat-lay product photography with soft natural light and shallow depth of field.',
};

/**
 * @param {keyof typeof THEME_PROMPTS} themeId
 * @param {keyof typeof VARIANT_STYLES} variant
 */
export function backgroundPrompt(themeId, variant) {
	const theme = THEME_PROMPTS[themeId];
	return [
		`A wide 16:9 landscape website background showing ${theme.subject}.`,
		VARIANT_STYLES[variant],
		`Color palette: ${theme.palette}.`,
		'Concentrate all decoration along the left and right edges; keep the center calm, plain and low-detail because content cards cover it.',
		'No text, no letters, no numbers, no logos, no watermarks, no people, no faces, no hands.',
	].join(' ');
}
