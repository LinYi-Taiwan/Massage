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
        
        .voucher-section {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            margin-bottom: 30px;
        }
        .voucher-section h2 {
            margin: 0;
            padding: 25px 30px;
            background: #f8f9fa;
            font-size: 24px;
            font-weight: 600;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-count {
            background: #007AFF;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
        }
        .voucher-item {
            padding: 20px 30px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s, transform 0.1s;
            position: relative;
        }
        .voucher-item:hover {
            background: #f8f9fa;
        }
        .voucher-item:last-child {
            border-bottom: none;
        }
        .voucher-item.clickable {
            cursor: pointer;
        }
        .voucher-item.clickable:hover {
            background: #e3f2fd;
            transform: translateY(-1px);
        }
        .voucher-item.clickable::after {
            content: '🔍 點擊查看 QR Code';
            position: absolute;
            right: 30px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
            color: #007AFF;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .voucher-item.clickable:hover::after {
            opacity: 1;
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
        
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s ease;
        }
        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 0;
            border-radius: 20px;
            width: 90%;
            max-width: 450px;
            position: relative;
            animation: slideIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .modal-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 20px 20px 0 0;
            text-align: center;
            position: relative;
        }
        .close {
            position: absolute;
            right: 20px;
            top: 20px;
            color: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .close:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .modal-body {
            padding: 30px;
            text-align: center;
        }
        .qr-display {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border: 2px dashed #ddd;
        }
        .qr-display img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }
        .modal-voucher-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            text-align: left;
        }
        .modal-voucher-info p {
            margin: 8px 0;
            color: #555;
        }
        .modal-voucher-info strong {
            color: #333;
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
            .voucher-item.clickable::after {
                display: none;
            }
            .modal-content {
                width: 95%;
                margin: 5% auto;
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
        
        ${issuedVouchers.length > 0 ? `
        <div class="voucher-section">
            <h2>📤 我發出的券 <span class="section-count">${issuedVouchers.length}</span></h2>
            ${issuedVouchers.map(voucher => `
                <div class="voucher-item ${voucher.status === 'unused' ? 'clickable' : ''}" 
                     ${voucher.status === 'unused' ? `onclick="showQRCode('${voucher.id}', '${voucher.recipient}', '${voucher.issuedAt}')"` : ''}>
                    <div class="voucher-header">
                        <div class="voucher-id">${voucher.id.substring(0, 8)}...</div>
                        <div class="voucher-status status-${voucher.status}">
                            ${voucher.status === 'unused' ? '🎫 等待兌換' : '✅ 已兌換'}
                        </div>
                    </div>
                    <div class="voucher-details">
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
        ` : ''}
        
        ${receivedVouchers.length > 0 ? `
        <div class="voucher-section">
            <h2>📥 我收到的券 <span class="section-count">${receivedVouchers.length}</span></h2>
            ${receivedVouchers.map(voucher => `
                <div class="voucher-item ${voucher.status === 'unused' ? 'clickable' : ''}" 
                     ${voucher.status === 'unused' ? `onclick="showQRCode('${voucher.id}', '${voucher.issuer}', '${voucher.issuedAt}')"` : ''}>
                    <div class="voucher-header">
                        <div class="voucher-id">${voucher.id.substring(0, 8)}...</div>
                        <div class="voucher-status status-${voucher.status}">
                            ${voucher.status === 'unused' ? '🎫 可使用' : '✅ 已使用'}
                        </div>
                    </div>
                    <div class="voucher-details">
                        <div class="detail-item">
                            <div class="detail-label">發券人</div>
                            <div class="detail-value">${voucher.issuer}</div>
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
        ` : ''}
        
        ${total === 0 ? `
        <div class="voucher-section">
            <div class="empty-state">
                <div class="emoji">🎫</div>
                <h3>還沒有任何券</h3>
                <p>開始發放第一張按摩券吧！</p>
            </div>
        </div>
        ` : ''}
        
        <div class="actions">
            <a href="/issue" class="btn">📝 發放新券</a>
            <a href="/scan" class="btn btn-secondary">📷 掃描兌換</a>
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()" title="重新整理">
        🔄
    </button>
    
    <!-- QR Code Modal -->
    <div id="qrModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="close" onclick="closeModal()">&times;</span>
                <h2>💆‍♀️ 按摩券 QR Code</h2>
            </div>
            <div class="modal-body">
                <div class="modal-voucher-info">
                    <p><strong>券號:</strong> <span id="modalVoucherId"></span></p>
                    <p><strong>相關人員:</strong> <span id="modalOtherPerson"></span></p>
                    <p><strong>發放時間:</strong> <span id="modalIssuedAt"></span></p>
                </div>
                <div class="qr-display">
                    <div id="qrCodeContainer">載入中...</div>
                </div>
                <div class="instructions">
                    <p>請出示此 QR Code 進行兌換</p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        async function showQRCode(voucherId, otherPerson, issuedAt) {
            // Show modal
            document.getElementById('qrModal').style.display = 'block';
            
            // Update modal content
            document.getElementById('modalVoucherId').textContent = voucherId.substring(0, 8) + '...';
            document.getElementById('modalOtherPerson').textContent = otherPerson;
            document.getElementById('modalIssuedAt').textContent = new Date(issuedAt).toLocaleString('zh-TW');
            document.getElementById('qrCodeContainer').innerHTML = '載入中...';
            
            try {
                // Generate QR code using online service
                const voucherUrl = window.location.origin + '/voucher/' + voucherId;
                const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(voucherUrl);
                
                document.getElementById('qrCodeContainer').innerHTML = 
                    '<img src="' + qrUrl + '" alt="QR Code" style="max-width: 100%; height: auto;">';
                    
            } catch (error) {
                console.error('Error generating QR code:', error);
                document.getElementById('qrCodeContainer').innerHTML = '生成 QR Code 時發生錯誤';
            }
        }
        
        function closeModal() {
            document.getElementById('qrModal').style.display = 'none';
        }
        
        // Close modal when clicking outside of it
        window.onclick = function(event) {
            const modal = document.getElementById('qrModal');
            if (event.target == modal) {
                closeModal();
            }
        }
        
        // Close modal on Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });
    </script>
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