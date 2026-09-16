export const PREFERRED_APPLICATION_PORT = 8300;
export const PREVIEW_PORT = 4173;
export const PARALLEL_APPLICATION_PORT_COUNT = 5;

export const PREFERRED_APPLICATION_ORIGIN = `http://localhost:${PREFERRED_APPLICATION_PORT}`;
export const PREVIEW_ORIGIN = `http://localhost:${PREVIEW_PORT}`;
export const PARALLEL_APPLICATION_ORIGINS = Object.freeze(
	Array.from(
		{ length: PARALLEL_APPLICATION_PORT_COUNT },
		(_, offset) => `http://localhost:${PREFERRED_APPLICATION_PORT + offset}`,
	),
);
