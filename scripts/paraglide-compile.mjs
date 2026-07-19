import { compile } from '@inlang/paraglide-js';
import { paraglideCompilerOptions } from './paraglide-options.mjs';

// Replaces `paraglide-js compile` (CLI): the CLI hardcodes its destructive
// defaults (cleanOutdir: true, message-modules layout) with no flags to change
// them, so every `pnpm run check` wiped src/lib/paraglide under running dev
// servers. Match the dev server's layout (the bundler plugin picks
// locale-modules outside production builds) so alternating check/dev compiles
// rewrite identical files instead of flip-flopping between layouts.
await compile({
	...paraglideCompilerOptions,
	outputStructure: 'locale-modules',
});

// The inlang project can leave live handles behind; exit explicitly like the
// upstream CLI does so check scripts never hang on a stray watcher.
process.exit(0);
