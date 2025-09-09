import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Str } from "chanfana";
import { AppContext, Voucher } from "../types";
import * as QRCode from "qrcode";
import { verifyAuth, getOtherUserEmail, getUserDisplayName } from "../auth";

export class IssueApi extends OpenAPIRoute {
	schema = {
		tags: ["API"],
		summary: "Issue a new voucher (auto-detects issuer/recipient from auth)",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({}), // No manual input required
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Voucher created successfully",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							voucher: Voucher,
							qrCode: Str(),
							voucherUrl: Str(),
							issuerName: Str(),
							recipientName: Str(),
						}),
					},
				},
			},
			"400": {
				description: "Invalid request or authentication failed",
			},
			"401": {
				description: "Authentication required",
			},
		},
	};

	async handle(c: AppContext) {
		try {
			// Verify authentication and get user info
			const user = verifyAuth(c);
			const recipientEmail = getOtherUserEmail(c, user.email);
			
			// Get display names
			const issuerName = getUserDisplayName(user);
			const recipientName = recipientEmail.split('@')[0]; // Use email prefix as display name
			
			// Generate unique voucher ID
			const voucherId = crypto.randomUUID();
			const now = new Date().toISOString();
			
			// Create voucher object with email addresses
			const voucher = {
				id: voucherId,
				issuer: user.email,
				recipient: recipientEmail,
				issuedAt: now,
				status: "unused" as const,
			};
		
			// Store voucher in KV
			await c.env.VOUCHERS.put(voucherId, JSON.stringify(voucher));
			
			// Generate voucher URL and QR code
			const baseUrl = new URL(c.req.url).origin;
			const voucherUrl = `${baseUrl}/voucher/${voucherId}`;
			
			// Generate QR code as SVG and convert to data URL
			const qrCodeSvg = await QRCode.toString(voucherUrl, {
				type: 'svg',
				errorCorrectionLevel: 'M',
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				},
				width: 300,
				rendererOpts: {
					quality: 0.9
				}
			});
			
			// Convert SVG to data URL
			const qrCodeDataUrl = `data:image/svg+xml;base64,${btoa(qrCodeSvg)}`;
			
			return c.json({
				success: true,
				voucher,
				qrCode: qrCodeDataUrl,
				voucherUrl,
				issuerName,
				recipientName,
			});
			
		} catch (error) {
			console.error("Error creating voucher:", error);
			
			// Handle authentication errors
			if (error instanceof Error && 
				(error.message === "Authentication required" || 
				 error.message === "User not authorized" ||
				 error.message.includes("USER1_EMAIL and USER2_EMAIL must be configured"))) {
				return c.json(
					{ 
						success: false, 
						error: error.message
					}, 
					401
				);
			}
			
			return c.json(
				{ 
					success: false, 
					error: "Failed to create voucher" 
				}, 
				500
			);
		}
	}
}