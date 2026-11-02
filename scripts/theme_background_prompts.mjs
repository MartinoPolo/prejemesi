/**
 * Prompts for the curated wishlist background library (#531), kept free of side effects so a
 * test can check them against the theme and library registries. Every image has a light and a
 * dark file (#600): one is generated from its prompt and the other is an edit of it, so a pair
 * keeps one composition.
 */

/** Keyed and ordered like `WISHLIST_THEME_IDS` in `src/lib/theme/wishlist_themes.ts`. */
export const THEME_PROMPTS = {
	toys: {
		subject: 'colorful wooden toys, building blocks, a spinning top, a toy train and balloons',
		palette: {
			light: 'sky blue, sunny yellow and soft red on a pale blue-white ground',
			dark: 'sky blue, sunny yellow and soft red on a deep navy night ground',
		},
	},
	kids_clothes: {
		subject: 'tiny folded sweaters, knitted socks, a small dress on a hanger and buttons',
		palette: {
			light: 'cherry-blossom pink, cream and soft coral on a pale cream ground',
			dark: 'cherry-blossom pink, cream and soft coral on a deep plum ground',
		},
	},
	gamer: {
		subject: 'game controllers, a headset, pixel hearts and glowing neon shapes',
		palette: {
			light: 'violet, magenta and cyan accents on a pale lilac-white ground',
			dark: 'deep violet and near-black with magenta and cyan neon accents',
		},
	},
	minimal: {
		subject: 'a few simple geometric objects, a ceramic vase and a single paper sheet',
		palette: {
			light: 'graphite, warm white and light grey',
			dark: 'warm white and light grey accents on a deep graphite ground',
		},
	},
	wedding: {
		subject: 'white roses, eucalyptus sprigs, satin ribbon and two gold rings',
		palette: {
			light: 'ivory, champagne gold and blush',
			dark: 'champagne gold, ivory and blush on a deep warm charcoal ground by candlelight',
		},
	},
	christmas: {
		subject: 'fir branches, glass baubles, pine cones, wrapped gifts and warm fairy lights',
		palette: {
			light: 'ruby red, pine green and gold on a snowy white daylight ground',
			dark: 'deep ruby red, pine green and gold on a dark evening ground',
		},
	},
	outdoor: {
		subject: 'a hiking backpack, a tent, pine trees, a compass and a camping mug',
		palette: {
			light: 'matcha green, earthy brown and misty sky blue',
			dark: 'matcha green and earthy brown under a deep blue night sky',
		},
	},
	books: {
		subject: 'stacked books, an open book, reading glasses and a cup of tea',
		palette: {
			light: 'ocean blue, paper beige and warm brown',
			dark: 'ocean blue and warm brown on a deep navy ground in warm lamplight',
		},
	},
	baby: {
		subject: 'a soft teddy bear, a rattle, baby socks, clouds and little stars',
		palette: {
			light: 'mint green, pale yellow and cream',
			dark: 'mint green and pale yellow on a deep blue-grey night ground',
		},
	},
	retro: {
		subject: 'a vinyl record player, a cassette tape, a rotary phone and seventies shapes',
		palette: {
			light: 'peach, mustard and teal',
			dark: 'peach, mustard and teal on a deep brown evening ground',
		},
	},
	party: {
		subject: 'balloons, paper confetti, streamers, party hats and a cake',
		palette: {
			light: 'pink, lilac and bright gold',
			dark: 'pink, lilac and bright gold on a deep plum evening ground',
		},
	},
	space: {
		subject: 'planets, a small rocket, stars, a comet and distant galaxies',
		palette: {
			light: 'sky blue, white and soft lilac on a pale dawn-sky ground',
			dark: 'deep navy and black with sky-blue and white starlight',
		},
	},
	music: {
		subject: 'an acoustic guitar, headphones, a vinyl record and drifting music notes',
		palette: {
			light: 'ruby red, black and warm cream',
			dark: 'ruby red and warm cream on a near-black stage ground',
		},
	},
	pets: {
		subject: 'a dog bed, a ball of yarn, paw prints, a food bowl and pet toys without animals',
		palette: {
			light: 'honey yellow, warm brown and cream',
			dark: 'honey yellow and warm brown on a deep chocolate ground',
		},
	},
	gourmet: {
		subject: 'fresh herbs, olive oil, cheese, artisan bread, spices and copper cookware',
		palette: {
			light: 'peach, olive green and terracotta',
			dark: 'olive green and terracotta on a dark slate ground in warm kitchen light',
		},
	},
	travel: {
		subject: 'a vintage suitcase, a map, a passport, postcards, a camera and paper planes',
		palette: {
			light: 'ocean blue, sand and sunset orange',
			dark: 'ocean blue, sand and sunset orange on a deep twilight ground',
		},
	},
};

/** Ordered like `WISHLIST_LIBRARY_IMAGE_VARIANTS` in `src/lib/theme/wishlist_background_library.ts`. */
export const BACKGROUND_VARIANTS = ['illustrated', 'photo'];

/**
 * Ordered like `WISHLIST_LIBRARY_IMAGE_MODES`. Light comes first because light mode is the design
 * source of truth, so a fresh pair edits the light image into the dark one.
 */
export const BACKGROUND_MODES = ['light', 'dark'];

const VARIANT_STYLES = {
	illustrated:
		'Flat hand-drawn illustration with clean outlines, gentle paper texture and soft shading.',
	photo: 'Realistic styled flat-lay product photography with soft natural light and shallow depth of field.',
};

const MODE_SCENES = {
	light: 'A bright daytime scene on a pale, airy ground, so dark text reads well over it.',
	dark: 'A calm evening scene on a deep, dim ground close to charcoal, so light text reads well over it; the objects keep their colors under soft warm light.',
};

const LAYOUT_RULES = [
	'Concentrate all decoration along the left and right edges; keep the center calm, plain and low-detail because content cards cover it.',
	'No text, no letters, no numbers, no logos, no watermarks, no people, no faces, no hands.',
];

/** @param {keyof typeof MODE_SCENES} mode */
export function otherBackgroundMode(mode) {
	return mode === 'light' ? 'dark' : 'light';
}

/**
 * Generates one mode of an image from scratch.
 *
 * @param {keyof typeof THEME_PROMPTS} themeId
 * @param {keyof typeof VARIANT_STYLES} variant
 * @param {keyof typeof MODE_SCENES} mode
 */
export function backgroundPrompt(themeId, variant, mode) {
	const theme = THEME_PROMPTS[themeId];
	return [
		`A wide 16:9 landscape website background showing ${theme.subject}.`,
		VARIANT_STYLES[variant],
		MODE_SCENES[mode],
		`Color palette: ${theme.palette[mode]}.`,
		...LAYOUT_RULES,
	].join(' ');
}

/**
 * Edits the image of the other mode, attached to the request, into this mode, so both files of an
 * image keep one composition.
 *
 * @param {keyof typeof THEME_PROMPTS} themeId
 * @param {keyof typeof VARIANT_STYLES} variant
 * @param {keyof typeof MODE_SCENES} mode
 */
export function backgroundCounterpartPrompt(themeId, variant, mode) {
	const theme = THEME_PROMPTS[themeId];
	return [
		`Edit the attached ${otherBackgroundMode(mode)} website background into its ${mode} version.`,
		'Keep the exact composition, objects, positions, framing, 16:9 format and visual style; change only the ground and the lighting.',
		VARIANT_STYLES[variant],
		MODE_SCENES[mode],
		`Color palette: ${theme.palette[mode]}.`,
		...LAYOUT_RULES,
	].join(' ');
}
