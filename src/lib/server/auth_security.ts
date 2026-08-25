export const AUTH_CAPTCHA_ENDPOINTS = [
	'/sign-up/email',
	'/sign-in/email',
	'/sign-in/magic-link',
	'/request-password-reset',
] as const;

// BetterAuth's built-in limiter runs in the Worker and must only identify clients
// from Cloudflare's trusted edge header, never a caller-controlled forwarding chain.
export const AUTH_RATE_LIMIT = { enabled: true } as const;
export const AUTH_IP_ADDRESS_HEADERS = ['cf-connecting-ip'] as const;
