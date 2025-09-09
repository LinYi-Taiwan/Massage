import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Voucher = z.object({
	id: Str({ example: "abc123-def456-ghi789" }),
	issuer: Str({ example: "user1@gmail.com" }),
	recipient: Str({ example: "user2@gmail.com" }),
	issuedAt: DateTime(),
	redeemedAt: DateTime().optional(),
	status: z.enum(["unused", "used"]).default("unused"),
});

// Backward compatible voucher (for existing vouchers with display names)
export const LegacyVoucher = z.object({
	id: Str(),
	issuer: Str({ example: "我" }),
	recipient: Str({ example: "伴侶" }),
	issuedAt: DateTime(),
	redeemedAt: DateTime().optional(),
	status: z.enum(["unused", "used"]).default("unused"),
});

export type VoucherType = z.infer<typeof Voucher>;

export const VoucherStats = z.object({
	total: z.number(),
	unused: z.number(),
	used: z.number(),
	vouchers: z.array(Voucher),
});
