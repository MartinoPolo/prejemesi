// Vite serves a library file from its source path in tests and dev, and under a content hash in builds.
const LIBRARY_FILE_URL_SUFFIX = String.raw`(?:\.[\w-]+)?\.webp(?:\?no-inline)?`;

/** Matches a resolved library file URL by its file stem, e.g. `space-photo-light-1280`. */
export function libraryFileUrlPattern(fileStem: string): RegExp {
	return new RegExp(String.raw`/${fileStem}${LIBRARY_FILE_URL_SUFFIX}$`);
}

/** Matches a `srcset` listing exactly the given library files with their widths, in order. */
export function librarySrcsetPattern(files: readonly (readonly [string, number])[]): RegExp {
	const candidates = files.map(
		([fileStem, width]) =>
			String.raw`\S*/${fileStem}${LIBRARY_FILE_URL_SUFFIX} ${String(width)}w`,
	);
	return new RegExp(`^${candidates.join(', ')}$`);
}
