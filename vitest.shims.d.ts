/// <reference types="@vitest/browser-playwright" />

declare module '*.css' {
	const content: string;
	export default content;
}
