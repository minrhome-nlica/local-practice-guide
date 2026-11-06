# 讀者提問與內容勘誤：Cloudflare 後端

此資料夾是可獨立部署的 **Cloudflare Worker + D1** 後端；網站仍留在 GitHub Pages。功能在正式資料庫接通前預設關閉，不會顯示一個送不出去的表單。

## Cloudflare 控制台建立方式（不需要使用終端機）
1. 登入 https://dash.cloudflare.com/ ，到 **Workers & Pages** → **Create application** 建立 Worker，名稱建議 `guide-feedback-api`。
2. 到 **D1 SQL Database** 建立資料庫 `guide-feedback`。在該 D1 的 **Console** 把 `schema.sql` 內容執行一次。
3. 在 Worker **Bindings** 新增 **D1 database**，變數名稱必須是 `DB`，選擇上述 `guide-feedback`。
4. 在 Worker 的 **Edit code** 用 `src/index.js` 的完整內容取代範例程式碼並 Deploy。
5. 在 Worker **Settings / Variables and Secrets** 新增：
   - 一般 Text variable `ALLOWED_ORIGINS` = `https://guide.mountcounty.com,https://minrhome-nlica.github.io`
   - **Secret** `TURNSTILE_SECRET` = Cloudflare Turnstile 發給你的 **Secret key**
   - **Secret** `RATE_SALT` = 自行產生的長隨機字串（至少 32 字元）
   - **Secret** `ADMIN_TOKEN` = 另一組不同的長隨機字串（至少 32 字元）
6. 到 Cloudflare **Turnstile** 新增 Widget，允許 `guide.mountcounty.com`（若需要測試也加入 `minrhome-nlica.github.io`）。取得 **Sitekey**（公開）和 **Secret key**（機密）；選擇 Managed 模式即可。
7. 瀏覽 `https://<你的-worker>.workers.dev/health` 應回傳 `{"ok":true,"service":"guide-feedback"}`。
8. 在 GitHub repo → Settings → Secrets and variables → Actions → Variables 新增兩個 **公開** 的 repository variables，重新執行 Deploy Local Practice Guide：
   - `FEEDBACK_API_URL` = `https://<你的-worker>.workers.dev`（不加 /api/comments）
   - `TURNSTILE_SITE_KEY` = Turnstile Widget 的 **Sitekey**。
9. 網站兩筆資料完整才顯示提問功能。請逐篇檢查手機反白、一般留言、提交後「待審核」提示、跨文章留言頁。

**重要：請勿把 Turnstile Secret key、RATE_SALT 或 ADMIN_TOKEN 貼給 ChatGPT、放在 GitHub 程式碼或截圖公開。** Worker URL 與 Turnstile Sitekey 可分享。

## 資料與審核
- `GET /api/comments?entry=income-withholding&limit=12&offset=0`：只回傳 `approved` / `resolved`。
- `POST /api/comments`：驗證來源與 Turnstile，限制每個來源每小時 5 筆，寫入 `pending`。
- `GET /api/admin/comments?status=pending`：需要 `Authorization: Bearer <ADMIN_TOKEN>`，取得待審核。
- `POST /api/admin/comments/<UUID>`：需要同樣授權，JSON 範例 `{"status":"approved","admin_reply":"已查核並更新。"}`。
- 第一版也可以直接在 D1 Console 執行：
  `SELECT id, entry_id, body, quote FROM feedback WHERE status='pending' ORDER BY created_at;`
  審核通過後：
  `UPDATE feedback SET status='approved', updated_at=datetime('now') WHERE id='<留言 ID>';`
- 此版本**尚無專屬圖形化管理後台**；可以使用 Cloudflare D1 管理控制台，之後再加管理介面。
- 不收集使用者電子郵件；IP 僅作短期雜湊限流，不在留言表保存。管理者應定期清理過期限流資料：`DELETE FROM feedback_rate WHERE expires_at < unixepoch();`
- 後端僅用參數化 SQL，輸入長度受限制，訪客留言需人工審核才公開。上線前請準備簡短的隱私政策與管理規則。
- 備份資料庫並限制管理者權限，避免刪除或改動造成資料永久流失。

Cloudflare 官方說明：
- https://developers.cloudflare.com/workers/get-started/dashboard/
- https://developers.cloudflare.com/d1/best-practices/remote-development/
- https://developers.cloudflare.com/turnstile/get-started/
