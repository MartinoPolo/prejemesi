import type { GiftIngestionRateLimit } from './http_handler.js';

interface GiftIngestionRouteEvent {
	request: Request;
	platform?: {
		env: { GIFT_INGESTION_RATE_LIMIT?: GiftIngestionRateLimit };
	};
}

type GiftIngestionHandler = (
	request: Request,
	rateLimit?: GiftIngestionRateLimit,
) => Promise<Response>;

export function createGiftIngestionPost(handler: GiftIngestionHandler) {
	return ({ request, platform }: GiftIngestionRouteEvent) =>
		handler(request, platform?.env.GIFT_INGESTION_RATE_LIMIT);
}
