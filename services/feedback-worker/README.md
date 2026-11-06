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

## 2026-11-06：文章「有幫助／還沒解決」回饋功能

這是獨立的回饋統計，不會改變既有的讀者留言、審核與回覆資料。**正式啟用務必先更新 D1，再發布 Worker**；Astro 前端會呼叫 `/api/ratings/availability`，只有兩者已正確安裝才會顯示投票按鈕與後台統計。

### 已有留言系統的正式站部署（一次性）

1. 先在 Cloudflare D1 控制台備份目前的 `guide-feedback` 資料庫。
2. 到 **D1 → guide-feedback → Console**，執行 [migrations/2026-11-06-article-ratings.sql](migrations/2026-11-06-article-ratings.sql) 的**完整 SQL**。原有 `feedback` 和 `feedback_rate` 不會被刪除或變更；新建 `article_ratings` 與 `article_rating_rate`。此 migration 可重複執行。
3. 在現有 Cloudflare Worker 的 **Edit code**，以 [src/index.js](src/index.js) 最新完整內容取代並 **Deploy**。**不要建立新的 Worker**，應保留原有 D1 綁定 `DB`、`ALLOWED_ORIGINS`、`RATE_SALT`、`ADMIN_TOKEN`、`TURNSTILE_SECRET`，也不要分享任何 Secret。
4. 在瀏覽器開啟 `https://<你的-worker>.workers.dev/api/ratings/availability`，應收到 `{"ok":true,"enabled":true}`；原本 `/health` 與 `/api/comments` 也應可用。
5. 到任一知識百科詞條重新整理。選擇「有幫助」會直接送出，選擇「還沒解決」須先選原因。到 `/admin/feedback/` 使用原本管理金鑰登入，原本留言管理下方會出現「文章回饋分析」。
6. 用兩篇詞條實際測試：同一瀏覽器在同一篇先選「有幫助」再改成「還沒解決」，後台該篇應只算 **1 筆**有效回饋；另一篇應分開計算。也要檢查手機版、留言審核操作與安全連線。

### 資料與安全說明

- `GET /api/ratings/availability`：檢查新資料表存在、服務可用，才顯示讀者投票。
- `POST /api/ratings`：提交文章 ID、標題、`helpful` 或 `unresolved`、未解決原因與瀏覽器隨機權杖。不接受任意留言文字。
- `GET /api/admin/ratings?period=30` 或 `period=all`：須帶原本管理權杖，只回傳**各文章彙總**，不傳個別權杖或雜湊識別。
- 訪客不需要登入。前端將隨機產生的權杖留在本機 `localStorage`；後端只保存加鹽的**每篇文章獨立雜湊值**，不保存明文 IP、姓名或電子郵件。同一瀏覽器／文章的重複提交會更新最新選擇；無法保證不同瀏覽器、不同裝置一定是不同的人。
- 為避免灌票，後端以每小時加鹽 IP 指紋限制最多 80 次文章評分提交；**不會**動到原有讀者留言每小時 5 筆的限制。使用密集的活動現場或共享 IP 的團體需留意此上限。
- 可以定期在 D1 Console 執行 `DELETE FROM article_rating_rate WHERE expires_at < unixepoch();` 清理過期的限流紀錄。
- 後台「最近 30 天」是指每篇文章的回饋**最後更新時間**落在這段期間，不是獨立的歷史投票事件時間序列。比例需搭配樣本數判讀；要精確比較修改前後的趨勢，下一階段應加事件紀錄和版本標記。
- 如果資料庫尚未遷移、Worker 尚未更新，新的投票與統計面板會維持隱藏。**不需要額外設定新的 GitHub Actions 變數或公開金鑰**，因為網站會自動檢查服務可用性。
