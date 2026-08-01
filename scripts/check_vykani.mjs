/**
 * Vykání guard (issue #220).
 *
 * Czech distinguishes tykání (informal 2nd person singular — "Rezervuj", "přijde ti")
 * from vykání (formal plural — "Rezervujte", "přijde vám"). The product addresses every
 * user with vykání; mixing the two inside one screen reads as sloppy, and the landing page
 * had drifted into tykání before #220 normalised it.
 *
 * This script scans messages/cs.json for tykání markers and fails the build if any
 * reappear. Only the Czech catalog is checked — English has no T-V distinction.
 *
 * A genuine false positive (a noun that merely ends in -eš/-íš, "ti" as a demonstrative)
 * is silenced by adding its key to ALLOWED_KEYS below together with a reason.
 * Runs in check:all.
 */

import { readFileSync } from 'node:fs';

const CATALOG_PATH = 'messages/cs.json';

/**
 * Czech word boundaries: JavaScript's \b is ASCII-only and silently mis-fires on
 * diacritics, so every pattern is fenced with Unicode letter lookarounds instead.
 */
const NOT_LETTER_BEFORE = '(?<!\\p{L})';
const NOT_LETTER_AFTER = '(?!\\p{L})';

const TYKANI_PATTERNS = [
	{
		label: '2nd person singular verb ending',
		pattern: new RegExp(
			`${NOT_LETTER_BEFORE}\\p{L}{2,}(?:eš|íš|áš|uješ)${NOT_LETTER_AFTER}`,
			'u',
		),
	},
	{
		label: 'informal pronoun / reflexive',
		pattern: new RegExp(
			`${NOT_LETTER_BEFORE}(?:ti|tě|tebe|tobě|tvůj|tvoje|tvá|tvé|tvým|tvého|tvoji|sis|ses)${NOT_LETTER_AFTER}`,
			'iu',
		),
	},
	{
		label: 'singular imperative',
		pattern: new RegExp(
			`${NOT_LETTER_BEFORE}(?:Rezervuj|Vyzkoušej|Přidej|Sdílej|Klikni|Podívej|Zkus|Otevři|Pošli|Napiš|Ukaž|Pojmenuj|Přepni|Nastav|Mrkni|Koukni)${NOT_LETTER_AFTER}`,
			'u',
		),
	},
];

/** key -> reason the tykání-looking match is legitimate. */
const ALLOWED_KEYS = new Map();

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const violations = [];

for (const [key, value] of Object.entries(catalog)) {
	if (typeof value !== 'string' || ALLOWED_KEYS.has(key)) {
		continue;
	}
	const matchedLabels = TYKANI_PATTERNS.filter(({ pattern }) => pattern.test(value)).map(
		({ label }) => label,
	);
	if (matchedLabels.length > 0) {
		violations.push({ key, value, matchedLabels });
	}
}

if (violations.length > 0) {
	console.error(`Vykání check failed — ${String(violations.length)} message(s) use tykání.\n`);
	for (const { key, value, matchedLabels } of violations) {
		console.error(`  ${key}`);
		console.error(`    ${value}`);
		console.error(`    matched: ${matchedLabels.join(', ')}`);
	}
	console.error(
		[
			'',
			'Czech UI copy addresses the user formally (vykání): "Rezervujte", "přijde vám",',
			'"jste si oblíbili". Reword the message above, or — if this is a false positive',
			'(a noun that merely ends in -eš/-íš, "ti" as a demonstrative) — add the key to',
			`ALLOWED_KEYS in scripts/check_vykani.mjs with a reason.`,
			'',
		].join('\n'),
	);
	process.exit(1);
}

console.log(
	`Vykání check passed (${String(Object.keys(catalog).length)} Czech messages, 0 tykání).`,
);
