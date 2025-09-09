import { OpenAPIRoute } from "chanfana";
import { AppContext } from "../types";
import { html } from "hono/html";
import { verifyAuth, getOtherUserEmail, getUserDisplayName } from "../auth";

export class IssuePage extends OpenAPIRoute {
	schema = {
		tags: ["Voucher"],
		summary: "Display voucher issue page",
		responses: {
			"200": {
				description: "HTML page for issuing vouchers",
				content: {
					"text/html": {
						schema: {
							type: "string",
						},
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const baseUrl = new URL(c.req.url).origin;
		
		try {
			// Get user information
			const user = verifyAuth(c);
			const recipientEmail = getOtherUserEmail(c, user.email);
			const issuerName = getUserDisplayName(user);
			const recipientName = recipientEmail.split('@')[0];
			
			const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>發放按摩券</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 20px;
        }
        .user-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .user-info h2 {
            margin: 0 0 10px 0;
            color: #007AFF;
            font-size: 18px;
        }
        .user-info p {
            margin: 5px 0;
            color: #666;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }
        input, select {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        input:focus, select:focus {
            border-color: #007AFF;
            outline: none;
        }
        button {
            width: 100%;
            padding: 15px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover {
            background: #0056b3;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .result {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .links {
            text-align: center;
            margin-top: 30px;
        }
        .links a {
            color: #007AFF;
            text-decoration: none;
            margin: 0 15px;
        }
        .error {
            color: #d32f2f;
            background: #ffebee;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💆‍♀️ 發放按摩券</h1>
        
        <div class="user-info">
            <h2>登入用戶</h2>
            <p><strong>${issuerName}</strong> (${user.email})</p>
            <p>將發放按摩券給 <strong>${recipientName}</strong></p>
        </div>
        
        <div id="issueForm">
            <button type="button" id="submitBtn" onclick="issueVoucher()">發放券給 ${recipientName}</button>
        </div>
        
        <div id="result" class="result">
            <h2>✅ 券已發放！</h2>
            <div id="qrContainer" class="qr-container"></div>
            <p>請將此 QR Code 傳給接收人</p>
            <button onclick="issueAnother()">發放另一張券</button>
        </div>
        
        <div class="links">
            <a href="/scan">📷 掃描兌換</a>
            <a href="/status">📊 查看狀態</a>
        </div>
    </div>

    <script>
        async function issueVoucher() {
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '發放中...';
            
            try {
                const response = await fetch('/api/issue', {
                    method: 'POST',
                    body: JSON.stringify({}), // Empty body since auth determines issuer/recipient
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Show QR code
                    document.getElementById('qrContainer').innerHTML = 
                        '<img src="' + data.qrCode + '" alt="QR Code" style="max-width: 200px; height: auto;">' +
                        '<p>發放給: <strong>' + data.recipientName + '</strong></p>';
                    
                    // Hide form and show result
                    document.getElementById('issueForm').style.display = 'none';
                    document.getElementById('result').style.display = 'block';
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error');
                }
            } catch (error) {
                alert('發放失敗: ' + error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = '發放券給 ${recipientName}';
            }
        }
        
        function issueAnother() {
            document.getElementById('issueForm').style.display = 'block';
            document.getElementById('result').style.display = 'none';
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('submitBtn').textContent = '發放券給 ${recipientName}';
        }
    </script>
</body>
</html>`;

			return c.html(htmlContent);
			
		} catch (error) {
			console.error("Error in issue page:", error);
			
			// Show error page for authentication failures
			const errorHtml = `
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
</html>`;
			return c.html(errorHtml);
		}
	}
}