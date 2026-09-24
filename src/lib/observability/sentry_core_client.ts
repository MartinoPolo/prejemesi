import {
	captureException as sentryCaptureException,
	getClient as getSentryClient,
	handleErrorWithSentry as createSentryErrorHandler,
	init as initializeSentry,
} from '@sentry/sveltekit';

/** @public */
export const captureException = sentryCaptureException;
/** @public */
export const getClient = getSentryClient;
/** @public */
export const handleErrorWithSentry = createSentryErrorHandler;
/** @public */
export const init = initializeSentry;
