import { OpenAPIRoute } from "chanfana";
import { AppContext } from "../types";
import { verifyAuth, getUserDisplayName } from "../auth";

export class ScanPage extends OpenAPIRoute {
	schema = {
		tags: ["Voucher"],
		summary: "Display QR code scanning page",
		responses: {
			"200": {
				description: "HTML page for scanning vouchers",
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
		try {
			// Get user information
			const user = verifyAuth(c);
			const userName = getUserDisplayName(user);
			
			const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>掃描按摩券</title>
    <script src="https://unpkg.com/jsqr@1.4.0/dist/jsQR.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .header .user-info {
            font-size: 14px;
            opacity: 0.9;
        }
        .scanner-section {
            padding: 30px;
            text-align: center;
        }
        #videoContainer {
            position: relative;
            display: inline-block;
            margin: 20px 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        #video {
            width: 100%;
            max-width: 400px;
            height: auto;
            background: #000;
        }
        #canvas {
            display: none;
        }
        .scanner-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 200px;
            border: 2px solid #00ff00;
            border-radius: 12px;
            box-shadow: 0 0 0 99999px rgba(0, 0, 0, 0.3);
        }
        .controls {
            margin: 20px 0;
        }
        button {
            padding: 12px 24px;
            margin: 5px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .primary-btn {
            background: #007AFF;
            color: white;
        }
        .primary-btn:hover {
            background: #0056b3;
        }
        .primary-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .secondary-btn {
            background: #f0f0f0;
            color: #333;
        }
        .secondary-btn:hover {
            background: #e0e0e0;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
            font-weight: 500;
        }
        .status.scanning {
            background: #e3f2fd;
            color: #1976d2;
        }
        .status.success {
            background: #e8f5e8;
            color: #2e7d32;
        }
        .status.error {
            background: #ffebee;
            color: #d32f2f;
        }
        .manual-input {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .manual-input input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        .manual-input input:focus {
            border-color: #007AFF;
            outline: none;
        }
        .links {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
        }
        .links a {
            color: #007AFF;
            text-decoration: none;
            margin: 0 15px;
        }
        .result-details {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            text-align: left;
        }
        .result-details h3 {
            margin-top: 0;
            color: #333;
        }
        .result-details p {
            margin: 5px 0;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📷 掃描按摩券</h1>
            <div class="user-info">登入用戶: ${userName} (${user.email})</div>
            <p>掃描 QR Code 兌換別人給你的按摩券</p>
        </div>
        
        <div class="scanner-section">
            <div id="videoContainer" style="display: none;">
                <video id="video" autoplay muted playsinline></video>
                <div class="scanner-overlay"></div>
            </div>
            <canvas id="canvas"></canvas>
            
            <div class="controls">
                <button id="startBtn" class="primary-btn">開始掃描</button>
                <button id="stopBtn" class="secondary-btn" style="display: none;">停止掃描</button>
            </div>
            
            <div id="status" class="status" style="display: none;"></div>
            
            <div class="manual-input">
                <h3>手動輸入券號</h3>
                <input type="text" id="manualToken" placeholder="貼上券的網址或輸入券號">
                <button onclick="redeemManual()" class="primary-btn" style="margin-top: 10px;">兌換</button>
            </div>
        </div>
        
        <div class="links">
            <a href="/issue">📝 發新券</a>
            <a href="/status">📊 查看狀態</a>
        </div>
    </div>

    <script>
        let video, canvas, context;
        let scanning = false;
        let scanInterval;

        document.addEventListener('DOMContentLoaded', function() {
            video = document.getElementById('video');
            canvas = document.getElementById('canvas');
            context = canvas.getContext('2d');
            
            document.getElementById('startBtn').addEventListener('click', startScanning);
            document.getElementById('stopBtn').addEventListener('click', stopScanning);
        });

        async function startScanning() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 400 },
                        height: { ideal: 400 }
                    } 
                });
                
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                };
                
                document.getElementById('videoContainer').style.display = 'block';
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('stopBtn').style.display = 'inline-block';
                
                scanning = true;
                showStatus('正在掃描...', 'scanning');
                
                scanInterval = setInterval(scanForQR, 100);
                
            } catch (error) {
                console.error('Error accessing camera:', error);
                showStatus('無法使用相機: ' + error.message, 'error');
            }
        }

        function stopScanning() {
            scanning = false;
            clearInterval(scanInterval);
            
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
                video.srcObject = null;
            }
            
            document.getElementById('videoContainer').style.display = 'none';
            document.getElementById('startBtn').style.display = 'inline-block';
            document.getElementById('stopBtn').style.display = 'none';
            document.getElementById('status').style.display = 'none';
        }

        function scanForQR() {
            if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) return;
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
                console.log('QR Code detected:', code.data);
                stopScanning();
                processQRCode(code.data);
            }
        }

        function processQRCode(data) {
            // Extract token from URL
            let token;
            
            if (data.includes('/voucher/')) {
                token = data.split('/voucher/')[1];
            } else if (data.includes('voucher/')) {
                token = data.split('voucher/')[1];
            } else {
                // Assume it's just the token
                token = data;
            }
            
            if (token) {
                redeemVoucher(token);
            } else {
                showStatus('無效的 QR Code', 'error');
            }
        }

        async function redeemVoucher(token) {
            try {
                showStatus('兌換中...', 'scanning');
                
                const response = await fetch('/api/redeem', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    showStatus('✅ 兌換成功！', 'success');
                    
                    // Show voucher details
                    const details = document.createElement('div');
                    details.className = 'result-details';
                    details.innerHTML = \`
                        <h3>券已成功兌換</h3>
                        <p><strong>發券人:</strong> \${result.voucher.issuer}</p>
                        <p><strong>接收人:</strong> \${result.voucher.recipient}</p>
                        <p><strong>發放時間:</strong> \${new Date(result.voucher.issuedAt).toLocaleString('zh-TW')}</p>
                        <p><strong>兌換時間:</strong> \${new Date(result.voucher.redeemedAt).toLocaleString('zh-TW')}</p>
                    \`;
                    document.getElementById('status').appendChild(details);
                    
                } else {
                    showStatus(result.error || '兌換失敗', 'error');
                }
                
            } catch (error) {
                console.error('Redeem error:', error);
                showStatus('兌換時發生錯誤', 'error');
            }
        }

        function redeemManual() {
            const input = document.getElementById('manualToken');
            const value = input.value.trim();
            
            if (!value) {
                showStatus('請輸入券號或券的網址', 'error');
                return;
            }
            
            processQRCode(value);
            input.value = '';
        }

        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = \`status \${type}\`;
            status.style.display = 'block';
            
            // Clear any existing result details
            const existing = status.querySelector('.result-details');
            if (existing) existing.remove();
        }
        
        // Handle manual input on Enter key
        document.getElementById('manualToken').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                redeemManual();
            }
        });
    </script>
</body>
</html>`;

			return c.html(htmlContent);
			
		} catch (error) {
			console.error("Error in scan page:", error);
			
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