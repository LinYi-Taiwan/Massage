import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Str } from "chanfana";
import { AppContext, VoucherType } from "../types";
import { verifyAuth, getUserDisplayName } from "../auth";

export class RedeemApi extends OpenAPIRoute {
	schema = {
		tags: ["API"],
		summary: "Redeem a voucher",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							token: Str({ example: "abc123-def456-ghi789" }),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Voucher redeemed successfully",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							voucher: z.object({
								id: Str(),
								issuer: Str(),
								recipient: Str(),
								issuedAt: Str(),
								redeemedAt: Str(),
								status: z.enum(["unused", "used"]),
							}),
						}),
					},
				},
			},
			"400": {
				description: "Invalid request or voucher already used",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: Str(),
						}),
					},
				},
			},
			"401": {
				description: "Authentication required or user not authorized",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: Str(),
						}),
					},
				},
			},
			"403": {
				description: "User not authorized to redeem this voucher",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: Str(),
						}),
					},
				},
			},
			"404": {
				description: "Voucher not found",
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
		const data = await this.getValidatedData<typeof this.schema>();
		const { token } = data.body;
		
		try {
			// Verify authentication
			const user = verifyAuth(c);
			// Fetch voucher from KV
			const voucherData = await c.env.VOUCHERS.get(token);
			
			if (!voucherData) {
				return c.json(
					{
						success: false,
						error: "券不存在或已失效"
					},
					404
				);
			}
			
			const voucher: VoucherType = JSON.parse(voucherData);
			
			// Check if the logged-in user is the intended recipient
			// Support both new format (email) and legacy format (display names)
			const isNewFormat = voucher.recipient.includes('@');
			const isAuthorized = isNewFormat 
				? voucher.recipient === user.email
				: true; // For legacy vouchers, allow anyone to redeem for now
			
			if (!isAuthorized) {
				return c.json(
					{
						success: false,
						error: "你無法兌換不是給你的券"
					},
					403
				);
			}
			
			// Check if voucher is already used
			if (voucher.status === "used") {
				return c.json(
					{
						success: false,
						error: "此券已經兌換過了"
					},
					400
				);
			}
			
			// Update voucher to used status
			const updatedVoucher = {
				...voucher,
				status: "used" as const,
				redeemedAt: new Date().toISOString(),
			};
			
			// Save updated voucher back to KV
			await c.env.VOUCHERS.put(token, JSON.stringify(updatedVoucher));
			
			return c.json({
				success: true,
				voucher: updatedVoucher,
			});
			
		} catch (error) {
			console.error("Error redeeming voucher:", error);
			
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
					error: "兌換時發生系統錯誤"
				},
				500
			);
		}
	}
}