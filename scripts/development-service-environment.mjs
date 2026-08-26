function localService(port) {
	return { port: String(port), origin: `http://localhost:${String(port)}` };
}

export function assignedService(value, fallbackPort) {
	if (!value) {
		return localService(fallbackPort);
	}
	try {
		const assigned = new URL(value);
		if (
			assigned.protocol === 'http:' &&
			assigned.hostname === 'localhost' &&
			assigned.port !== ''
		) {
			return { port: assigned.port, origin: assigned.origin };
		}
	} catch {
		// Fall back to the repository's local preferred port below.
	}
	return localService(fallbackPort);
}
