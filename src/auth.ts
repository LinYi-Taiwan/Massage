import type { Context } from "hono";
import { AppContext } from "./types";

export interface AuthUser {
	email: string;
	name?: string;
	isAuthenticated: boolean;
}

/**
 * Extract user information from Cloudflare Access headers
 */
export function getAuthUser(c: AppContext): AuthUser {
	// Cloudflare Access provides user information in these headers
	const email = c.req.header('CF-Access-Authenticated-User-Email');
	const name = c.req.header('Cf-Access-Authenticated-User-Name');
	
	if (!email) {
		return {
			email: '',
			isAuthenticated: false
		};
	}
	
	return {
		email,
		name,
		isAuthenticated: true
	};
}

/**
 * Get the allowed email addresses from environment variables
 */
export function getAllowedEmails(c: AppContext): string[] {
	const email1 = c.env.USER1_EMAIL;
	const email2 = c.env.USER2_EMAIL;
	
	const emails = [email1, email2].filter(Boolean);
	
	if (emails.length !== 2) {
		throw new Error('Both USER1_EMAIL and USER2_EMAIL must be configured');
	}
	
	return emails;
}

/**
 * Get the other user's email address
 */
export function getOtherUserEmail(c: AppContext, currentUserEmail: string): string {
	const allowedEmails = getAllowedEmails(c);
	const otherEmail = allowedEmails.find(email => email !== currentUserEmail);
	
	if (!otherEmail) {
		throw new Error('Invalid user email or configuration error');
	}
	
	return otherEmail;
}

/**
 * Verify that the current user is authorized
 */
export function verifyAuth(c: AppContext): AuthUser {
	const user = getAuthUser(c);
	
	if (!user.isAuthenticated) {
		throw new Error('Authentication required');
	}
	
	const allowedEmails = getAllowedEmails(c);
	
	if (!allowedEmails.includes(user.email)) {
		throw new Error('User not authorized');
	}
	
	return user;
}

/**
 * Get user display name - use name if available, otherwise email prefix
 */
export function getUserDisplayName(user: AuthUser): string {
	if (user.name) {
		return user.name;
	}
	
	// Extract name from email (everything before @)
	return user.email.split('@')[0];
}