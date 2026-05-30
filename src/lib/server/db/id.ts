import { nanoid } from 'nanoid';

export function generateId(length = 12): string {
	return nanoid(length);
}

export function generateToken(): string {
	return nanoid(24);
}
