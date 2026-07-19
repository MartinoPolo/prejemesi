/**
 * Single source of truth for the paraglide compiler configuration, shared by
 * the Vite plugin (vite.config.ts) and the standalone compile script
 * (scripts/paraglide-compile.mjs) behind the `paraglide:compile` package script.
 *
 * `cleanOutdir: false` is load-bearing: hooks.server.ts and every *.remote.ts
 * module import $lib/paraglide/*, so wiping the outdir while a dev server is
 * running turns in-flight requests into raw Vite 500s ("Failed to load url ...
 * Does the file exist?"). Overwriting in place closes that window; stale files
 * from removed messages are unreferenced, the directory is gitignored, and CI
 * always compiles into a clean checkout.
 *
 * @type {import('@inlang/paraglide-js').CompilerOptions}
 */
export const paraglideCompilerOptions = {
	project: './project.inlang',
	outdir: './src/lib/paraglide',
	strategy: ['url', 'cookie', 'baseLocale'],
	urlPatterns: [
		{
			pattern: '/:path(.*)?',
			localized: [
				['en', '/en/:path(.*)?'],
				['cs', '/:path(.*)?'],
			],
		},
	],
	cleanOutdir: false,
	emitTsDeclarations: true,
};
