import { fromHono } from "chanfana";
import { Hono } from "hono";
import { IssuePage } from "./endpoints/issuePage";
import { IssueApi } from "./endpoints/issueApi";
import { VoucherDisplay } from "./endpoints/voucherDisplay";
import { ScanPage } from "./endpoints/scanPage";
import { RedeemApi } from "./endpoints/redeemApi";
import { StatusPage } from "./endpoints/statusPage";
import { StatusApi } from "./endpoints/statusApi";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/docs",
});

// Register voucher pages
openapi.get("/issue", IssuePage);
openapi.get("/voucher/:token", VoucherDisplay);
openapi.get("/scan", ScanPage);
openapi.get("/status", StatusPage);

// Register API endpoints
openapi.post("/api/issue", IssueApi);
openapi.post("/api/redeem", RedeemApi);
openapi.get("/api/status", StatusApi);

// Root redirect to issue page
app.get("/", (c) => c.redirect("/issue"));

// Export the Hono app
export default app;
