import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Str } from "chanfana";
import { AppContext, VoucherType, VoucherStats } from "../types";
import { verifyAuth, getUserDisplayName } from "../auth";

export class StatusApi extends OpenAPIRoute {
	schema = {
		tags: ["API"],
		summary: "Get voucher status and statistics",
		responses: {
			"200": {
				description: "Voucher status and statistics",
				content: {
					"application/json": {
						schema: VoucherStats,
					},
				},
			},
			"500": {
				description: "Server error",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: Str(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		try {
			// Verify authentication
			const user = verifyAuth(c);
			
			// Get all vouchers from KV
			const { keys } = await c.env.VOUCHERS.list();
			const allVouchers: VoucherType[] = [];
			
			// Fetch all voucher data
			for (const key of keys) {
				const voucherData = await c.env.VOUCHERS.get(key.name);
				if (voucherData) {
					try {
						const voucher: VoucherType = JSON.parse(voucherData);
						allVouchers.push(voucher);
					} catch (e) {
						console.error(`Error parsing voucher ${key.name}:`, e);
					}
				}
			}
			
			// Filter vouchers to only include ones involving the current user
			const userVouchers = allVouchers.filter(voucher => {
				// Check if it's new format (email) or legacy format
				const isNewFormat = voucher.issuer.includes('@');
				
				if (isNewFormat) {
					// For new format, match exact email addresses
					return voucher.issuer === user.email || voucher.recipient === user.email;
				} else {
					// For legacy format, show all vouchers (for backward compatibility)
					return true;
				}
			});
			
			// Sort vouchers by issued date (newest first)
			userVouchers.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
			
			// Separate issued and received vouchers
			const issuedVouchers = userVouchers.filter(voucher => {
				const isNewFormat = voucher.issuer.includes('@');
				if (isNewFormat) {
					return voucher.issuer === user.email;
				} else {
					// For legacy format, assume all are issued by current user
					return true;
				}
			});
			
			const receivedVouchers = userVouchers.filter(voucher => {
				const isNewFormat = voucher.issuer.includes('@');
				if (isNewFormat) {
					return voucher.recipient === user.email;
				} else {
					// For legacy format, no received vouchers
					return false;
				}
			});
			
			// Calculate statistics
			const total = userVouchers.length;
			const unused = userVouchers.filter(v => v.status === 'unused').length;
			const used = userVouchers.filter(v => v.status === 'used').length;
			
			return c.json({
				total,
				unused,
				used,
				vouchers: userVouchers,
				issuedVouchers,
				receivedVouchers,
			});
			
		} catch (error) {
			console.error("Error fetching voucher statistics:", error);
			
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
					error: "無法取得券狀態資訊"
				},
				500
			);
		}
	}
}