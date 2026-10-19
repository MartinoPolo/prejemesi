import { describe, expect, it } from 'vitest';
import { isPublicHttpsUrl } from './public_https_url.js';

describe('isPublicHttpsUrl', () => {
	it.each([
		'https://claude.ai/oauth/client.json',
		'https://chatgpt.com/.well-known/client',
		'https://ai-app.example.com:443/client.json',
		'https://CLAUDE.AI./client.json',
	])('allows the public HTTPS name %s', (url) => {
		expect(isPublicHttpsUrl(new URL(url))).toBe(true);
	});

	it.each([
		['plain HTTP', 'http://claude.ai/client.json'],
		['another scheme', 'ftp://claude.ai/client.json'],
		['credentials', 'https://user:secret@claude.ai/client.json'],
		['a username', 'https://user@claude.ai/client.json'],
		['a non-default port', 'https://claude.ai:8443/client.json'],
		['an IPv4 literal', 'https://93.184.216.34/client.json'],
		['a loopback IPv4 literal', 'https://127.0.0.1/client.json'],
		['a private IPv4 literal', 'https://10.0.0.5/client.json'],
		['a link-local metadata address', 'https://169.254.169.254/latest/meta-data'],
		['an IPv4 literal in short form', 'https://2130706433/client.json'],
		['an IPv6 loopback literal', 'https://[::1]/client.json'],
		['an IPv6 link-local literal', 'https://[fe80::1]/client.json'],
		['an IPv4-mapped IPv6 literal', 'https://[::ffff:127.0.0.1]/client.json'],
		['localhost', 'https://localhost/client.json'],
		['a localhost subdomain', 'https://app.localhost/client.json'],
		['a single-label name', 'https://intranet/client.json'],
		['an mDNS name', 'https://printer.local/client.json'],
		['an internal name', 'https://metadata.google.internal/client.json'],
		['a LAN name', 'https://router.lan/client.json'],
		['a home network name', 'https://nas.home.arpa/client.json'],
	])('refuses %s', (_label, url) => {
		expect(isPublicHttpsUrl(new URL(url))).toBe(false);
	});
});
