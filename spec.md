# Worker-only 規格（含狀態總覽頁）

## 🎯 目標
用 Cloudflare Workers 打造一個最簡單的「按摩券系統」：  
- 發放按摩券（我 → 伴侶）  
- 出示按摩券（伴侶出示 QR）  
- 掃碼兌換（我掃描 → 標記使用）  
- **新增**：可以查看「目前券的狀態與數量」的總覽頁

---

## 🧱 Tech Stack
- **Cloudflare Workers**：負責頁面 + API  
- **Cloudflare KV**：存放券的狀態（未用 / 已用）、發放人、接收人、時間紀錄  
- **Cloudflare Durable Objects（可選）**：避免同一張券被同時兌換  
- **前端頁面（HTML/JS）**：由 Worker 回傳，包含掃碼功能（getUserMedia）

---

## 🔀 Routes（頁面 + API）
1. `GET /issue`  
   - 發券頁：填接收人 → 呼叫 API 建券 → 顯示 QR Code
2. `POST /api/issue`  
   - 建立新券 → 存 KV → 回傳券 URL/QR
3. `GET /voucher/:token`  
   - 出示券頁：顯示 QR Code（伴侶使用）
4. `GET /scan`  
   - 掃碼頁：開相機掃描 → 呼叫 API 兌換
5. `POST /api/redeem`  
   - 驗證並兌換 → 更新 KV 狀態
6. **`GET /status`**  
   - 狀態總覽頁：顯示目前所有券的列表與統計（未用幾張 / 已用幾張）
7. **`GET /api/status`**  
   - 提供 JSON 版本：列出所有券狀態與數量

---

## 📲 使用流程
1. 我在 `/issue` 發放券 → 顯示 QR → 傳給伴侶  
2. 伴侶在 `/voucher/:token` 出示 QR  
3. 我用 `/scan` 掃描 → Worker 驗證並更新為「已用」  
4. 我或伴侶隨時可到 `/status` 看：  
   - 所有券的清單（誰給誰、時間、是否已用）  
   - 數量統計（未用 / 已用）

---

## ✅ 驗收標準
- 可以發放券並生成 QR Code  
- 可以掃碼兌換，券會變成「已用」  
- `/status` 能正確顯示：  
  - 券清單（基本資訊）  
  - 統計數量（未用幾張、已用幾張）  
- 券不可重複使用

---