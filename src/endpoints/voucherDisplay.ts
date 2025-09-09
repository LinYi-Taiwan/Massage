import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Str } from "chanfana";
import { AppContext, VoucherType } from "../types";
import * as QRCode from "qrcode";

export class VoucherDisplay extends OpenAPIRoute {
	schema = {
		tags: ["Voucher"],
		summary: "Display voucher for scanning",
		request: {
			params: z.object({
				token: Str({ description: "Voucher token" }),
			}),
		},
		responses: {
			"200": {
				description: "Voucher display page",
				content: {
					"text/html": {
						schema: {
							type: "string",
						},
					},
				},
			},
			"404": {
				description: "Voucher not found",
			},
		},
	};

	async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const { token } = params;
		
		try {
			// Fetch voucher from KV
			const voucherData = await c.env.VOUCHERS.get(token);
			
			if (!voucherData) {
				return c.html(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>券不存在</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
            text-align: center;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .error {
            color: #d32f2f;
            font-size: 24px;
            margin-bottom: 20px;
        }
        a {
            color: #007AFF;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error">❌</div>
        <h2>券不存在或已失效</h2>
        <p><a href="/issue">← 回到發券頁面</a></p>
    </div>
</body>
</html>`, 404);
			}
			
			const voucher: VoucherType = JSON.parse(voucherData);
			
			// Generate QR code for this voucher
			const baseUrl = new URL(c.req.url).origin;
			const voucherUrl = `${baseUrl}/voucher/${token}`;
			
			// Generate QR code as SVG and convert to data URL
			const qrCodeSvg = await QRCode.toString(voucherUrl, {
				type: 'svg',
				errorCorrectionLevel: 'M',
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				},
				width: 350
			});
			
			// Convert SVG to data URL
			const qrCodeDataUrl = `data:image/svg+xml;base64,${btoa(qrCodeSvg)}`;
			
			const isUsed = voucher.status === 'used';
			const statusText = isUsed ? '✅ 已兌換' : '🎫 等待兌換';
			const statusColor = isUsed ? '#4CAF50' : '#FF9800';
			const redeemedText = voucher.redeemedAt ? 
				`<p><strong>兌換時間:</strong> ${new Date(voucher.redeemedAt).toLocaleString('zh-TW')}</p>` : '';
				
			const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>按摩券 - ${voucher.recipient}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 450px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .voucher-card {
            background: white;
            padding: 40px 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .voucher-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4);
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: 600;
            margin-bottom: 20px;
            background: ${statusColor};
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .voucher-info {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            text-align: left;
        }
        .voucher-info p {
            margin: 8px 0;
            color: #555;
        }
        .voucher-info strong {
            color: #333;
        }
        .qr-container {
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 12px;
            border: 2px dashed #ddd;
        }
        .qr-container img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }
        .instructions {
            color: #666;
            font-size: 14px;
            margin: 20px 0;
            line-height: 1.5;
        }
        .links {
            margin-top: 30px;
        }
        .links a {
            color: #007AFF;
            text-decoration: none;
            margin: 0 15px;
            font-size: 16px;
        }
        .used-overlay {
            opacity: ${isUsed ? '0.6' : '1'};
        }
        .refresh-btn {
            margin-top: 20px;
            padding: 10px 20px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        }
        .refresh-btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="voucher-card">
        <div class="status-badge">${statusText}</div>
        
        <h1>💆‍♀️ 按摩券</h1>
        
        <div class="voucher-info">
            <p><strong>發券人:</strong> ${voucher.issuer}</p>
            <p><strong>接收人:</strong> ${voucher.recipient}</p>
            <p><strong>發放時間:</strong> ${new Date(voucher.issuedAt).toLocaleString('zh-TW')}</p>
            ${redeemedText}
        </div>
        
        <div class="qr-container used-overlay">
            <img src="${qrCodeDataUrl}" alt="按摩券 QR Code">
        </div>
        
        <div class="instructions">
            ${isUsed ? 
                '此券已經兌換過了！' : 
                '請出示此 QR Code 給發券人掃描兌換'
            }
        </div>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 重新整理</button>
        
        <div class="links">
            <a href="/issue">📝 發新券</a>
            <a href="/status">📊 查看狀態</a>
        </div>
    </div>
</body>
</html>`;

			return c.html(htmlContent);
			
		} catch (error) {
			console.error("Error fetching voucher:", error);
			return c.html(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系統錯誤</title>
</head>
<body>
    <div style="text-align: center; padding: 50px;">
        <h2>系統錯誤</h2>
        <p>無法載入券資訊，請稍後再試。</p>
        <a href="/issue">← 回到發券頁面</a>
    </div>
</body>
</html>`, 500);
		}
	}
}