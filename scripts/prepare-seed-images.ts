import { prepareSeedImages } from '../src/lib/server/db/seed_images.js';

try {
	const result = await prepareSeedImages();
	console.log(
		`${String(result.downloaded)} downloaded, ${String(result.cached)} cached, ${String(result.total)} total`,
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
