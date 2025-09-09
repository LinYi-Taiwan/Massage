import { OpenAPIRoute } from "chanfana";
import { AppContext, VoucherType } from "../types";
import { verifyAuth, getUserDisplayName } from "../auth";

export class StatusPage extends OpenAPIRoute {
	schema = {
		tags: ["Voucher"],
		summary: "Display voucher status overview page",
		responses: {
			"200": {
				description: "HTML page showing voucher status",
			},
		},
	};

	async handle(c: AppContext) {
		try {
			// Verify authentication
			const user = verifyAuth(c);
			const userName = getUserDisplayName(user);
			
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
			
			// Calculate statistics
			const total = userVouchers.length;
			const unused = userVouchers.filter(v => v.status === 'unused').length;
			const used = userVouchers.filter(v => v.status === 'used').length;
			
			const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>按摩券狀態總覽</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f7;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
            font-weight: 700;
        }
        .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 18px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 30px 25px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }
        .stat-number {
            font-size: 48px;
            font-weight: 800;
            margin-bottom: 10px;
            line-height: 1;
        }
        .stat-label {
            font-size: 16px;
            color: #666;
            font-weight: 500;
        }
        .total { color: #007AFF; }
        .unused { color: #34C759; }
        .used { color: #FF9500; }
        
        .voucher-list {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }
        .voucher-list h2 {
            margin: 0;
            padding: 25px 30px;
            background: #f8f9fa;
            font-size: 24px;
            font-weight: 600;
            border-bottom: 1px solid #e9ecef;
        }
        .voucher-item {
            padding: 20px 30px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        .voucher-item:hover {
            background: #f8f9fa;
        }
        .voucher-item:last-child {
            border-bottom: none;
        }
        .voucher-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 12px;
        }
        .voucher-id {
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 14px;
            color: #666;
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 6px;
        }
        .voucher-status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            min-width: 80px;
        }
        .status-unused {
            background: #e8f5e8;
            color: #2e7d32;
        }
        .status-used {
            background: #fff3e0;
            color: #f57c00;
        }
        .voucher-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            color: #555;
        }
        .detail-item {
            display: flex;
            flex-direction: column;
        }
        .detail-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .detail-value {
            font-size: 16px;
            font-weight: 500;
        }
        .actions {
            text-align: center;
            margin: 40px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            background: #007AFF;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #0056b3;
        }
        .btn-secondary {
            background: #6c757d;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .empty-state {
            text-align: center;
            padding: 60px 30px;
            color: #666;
        }
        .empty-state .emoji {
            font-size: 64px;
            margin-bottom: 20px;
        }
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,123,255,0.3);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .refresh-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0,123,255,0.4);
        }
        
        @media (max-width: 768px) {
            .voucher-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            .voucher-details {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            .actions .btn {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 按摩券狀態總覽</h1>
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px;">
                登入用戶: ${userName} (${user.email})
            </div>
            <p>查看你相關的券的狀態與統計</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number total">${total}</div>
                <div class="stat-label">總券數</div>
            </div>
            <div class="stat-card">
                <div class="stat-number unused">${unused}</div>
                <div class="stat-label">未使用</div>
            </div>
            <div class="stat-card">
                <div class="stat-number used">${used}</div>
                <div class="stat-label">已使用</div>
            </div>
        </div>
        
        <div class="voucher-list">
            <h2>券清單</h2>
            ${total === 0 ? `
                <div class="empty-state">
                    <div class="emoji">🎫</div>
                    <h3>還沒有任何券</h3>
                    <p>開始發放第一張按摩券吧！</p>
                </div>
            ` : userVouchers.map(voucher => `
                <div class="voucher-item">
                    <div class="voucher-header">
                        <div class="voucher-id">${voucher.id.substring(0, 8)}...</div>
                        <div class="voucher-status status-${voucher.status}">
                            ${voucher.status === 'unused' ? '🎫 未使用' : '✅ 已使用'}
                        </div>
                    </div>
                    <div class="voucher-details">
                        <div class="detail-item">
                            <div class="detail-label">發券人</div>
                            <div class="detail-value">${voucher.issuer}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">接收人</div>
                            <div class="detail-value">${voucher.recipient}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">發放時間</div>
                            <div class="detail-value">${new Date(voucher.issuedAt).toLocaleString('zh-TW')}</div>
                        </div>
                        ${voucher.redeemedAt ? `
                            <div class="detail-item">
                                <div class="detail-label">兌換時間</div>
                                <div class="detail-value">${new Date(voucher.redeemedAt).toLocaleString('zh-TW')}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="actions">
            <a href="/issue" class="btn">📝 發放新券</a>
            <a href="/scan" class="btn btn-secondary">📷 掃描兌換</a>
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()" title="重新整理">
        🔄
    </button>
</body>
</html>`;

			return c.html(htmlContent);
			
		} catch (error) {
			console.error("Error fetching vouchers:", error);
			
			// Handle authentication errors
			if (error instanceof Error && 
				(error.message === "Authentication required" || 
				 error.message === "User not authorized" ||
				 error.message.includes("USER1_EMAIL and USER2_EMAIL must be configured"))) {
				return c.html(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>認證錯誤</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px; margin: 50px auto; padding: 20px; 
            background: #f5f5f5; text-align: center; 
        }
        .error-container { 
            background: white; padding: 30px; border-radius: 15px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .error { color: #d32f2f; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>🔒 需要登入</h1>
        <p class="error">請先透過 Cloudflare Access 登入系統</p>
        <p>如果你已經登入但看到此頁面，請檢查你的帳號是否已被授權使用此系統。</p>
    </div>
</body>
</html>`);
			}
			
			return c.html(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系統錯誤</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f7;
        }
        .error-container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            max-width: 400px;
            margin: 0 auto;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .emoji {
            font-size: 64px;
            margin-bottom: 20px;
        }
        a {
            color: #007AFF;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="emoji">❌</div>
        <h2>系統錯誤</h2>
        <p>無法載入券狀態，請稍後再試。</p>
        <a href="/issue">← 回到發券頁面</a>
    </div>
</body>
</html>`, 500);
		}
	}
}