import { existsSync, readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

for (const [artifact, stylesheet] of [
	['variants/variant-a.html', '../../../src/app.css'],
	['refined.html', '../../src/app.css'],
]) {
	const html = readFileSync(new URL(artifact, import.meta.url), 'utf8');
	if (!html.includes(`<link rel="stylesheet" href="${stylesheet}">`) ||
		!existsSync(new URL(stylesheet, new URL(artifact, import.meta.url))) ||
		/<link[^>]+designs\/tokens\.css/.test(html)) {
		throw new Error(`${artifact}: expected canonical stylesheet and no legacy override`);
	}
	const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
	if (!script) throw new Error(`${artifact}: missing prototype interaction script`);
	new Script(script);
	const translationSource = script.slice(script.indexOf('const words='), script.indexOf('\nconst lists='));
	const translations = runInNewContext(`${translationSource}; words`);
	for (const key of [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1])) {
		for (const locale of ['cs', 'en']) {
			if (translations[locale][key] === undefined) {
				throw new Error(`${artifact}: missing ${locale} translation for ${key}`);
			}
		}
	}
	for (const key of Object.keys(translations.cs)) {
		if (translations.en[key] === undefined) throw new Error(`${artifact}: missing English translation for ${key}`);
	}
	if (!translations.cs['reset-copy'].includes('Zvolte jazyk obnoveného ukázkového obsahu.')) {
		throw new Error(`${artifact}: reset copy must place language selection before confirmation`);
	}
	for (const id of [
		'preview-mobile', 'preview-reset-fail', 'reset-dialog', 'expired-cover',
		'error-cover', 'register-dialog', 'landing-example', 'sample-detail', 'demo-content',
	]) {
		if (!html.includes(`id="${id}"`)) throw new Error(`${artifact}: missing prototype region: ${id}`);
	}
	if (artifact === 'refined.html' &&
		!html.includes('Surrounding navigation, cards and landing are schematic')) {
		throw new Error('Refined prototype must label unapproved surrounding context');
	}
}
console.log('Both prototype scripts parse; translations, key states and stylesheet references are present.');
