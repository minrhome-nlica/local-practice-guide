# 地方實踐指南：管理後台與文章審稿發布系統（獨立 Cloudflare Worker）

> 此後台已於 2026-11-07 經由 Cloudflare Workers Builds 上線，入口為 `https://guide-admin-console.e7968.workers.dev/`，並由 Cloudflare Access + D1 管理員白名單進行雙重授權。
>
> 後台程式仍從獨立開發分支自動部署；公開網站頁尾已指向新管理後台，舊版留言管理暫留備援。

## 一、已實作的功能

- 後台受 Cloudflare Access 登入保護（Google 身分提供者及／或 Email One-time PIN，在 Cloudflare Access 控制台設定）。
- Worker **必須**取得 Cloudflare Access 原生的 \`ctx.access\` 身分，且 AUD 與 \`ACCESS_AUD\` 相同，才提供任何內容；不是只依賴前端隱藏介面。
- D1 \`admin_users\` 白名單決定三種權限：\`owner\`（最高管理員）、\`editor\`（編輯）、\`moderator\`（留言管理）。
- 總覽：待審核、已公開留言，以及文章「有幫助／還沒解決」回饋數。
- 留言管理：狀態篩選、關鍵字搜尋、分頁、回覆、公開、退回、拒絕、已處理；驗證更新時間，避免 2～5 位同事同時覆蓋處理結果。
- 文章回饋：查看各文章統計和未解決原因，提醒小樣本偏差。
- **Web Analytics**：已具備 7／30 天瀏覽量、訪問次數、每日趨勢及熱門頁面，透過唯讀 API Token 查詢，並自動區別 siteTag 與 siteToken；沒有查到紀錄時不視為 0 流量。
- 最高管理員：新增、停用、調整工作人員；操作紀錄保存審核者、時間和異動。
- 手機版使用可展開的功能選單；統計、留言回覆、手機輸入欄、工作人員權限管理與網站分析圖表皆支援窄螢幕。登入狀態由 Access 維護，不在 localStorage 保存金鑰。
- **文章目錄＋草稿編輯**：從 GitHub main 的 Markdown 詞條檔案取得名稱、分類、摘要、更新日期、編輯標籤，並讓 owner／editor 建立、儲存、修改、取消草稿；草稿儲存在受 Access 保護的 D1 資料庫，**不會自動修改公開網站**。
- **文章送審與核准**：編輯人員可以送審，最高管理員可查看新舊版本差異、退回附原因的修改，核准後才會在 GitHub 建立 PR；只有 GitHub 的 `check-seo` 通過且正式文章 SHA 未變，最高管理員才能從後台合併 PR 發布。缺少 GitHub Secret 時不允許外部寫入。
- **重要更新紀錄（內部候選）**：讀取 GitHub main 的最近提交，依文章／新功能／修正／一般維護分類；僅供管理員核對，不自動公開發布。
- 留言回覆未送出時，在當前頁面工作階段內暫存輸入（純瀏覽器記憶體；不是資料庫草稿），切換篩選可保留輸入；提交成功才清除。
- 一旦部署，與 **現有** \`guide-feedback\` D1 共用資料，但 **不修改現有公開留言 Worker**。

## 二、第一階段尚未實作

- **完全視覺化的富文字與表格編輯**：目前使用 Markdown 原始碼編輯和安全文字預覽。對於複雜表格、圖片、HTML 及自訂互動元件，應由管理員另外檢查 GitHub PR 的變更和網站建置結果，暫不提供所見即所得。
- **一鍵還原已發布文章**：GitHub commit/PR 保留版本紀錄，但目前仍需透過 GitHub 手動還原；後台沒有自動回復 UI。

- **重大更新公開公告**：內部候選清單已實作；下一階段才加入管理員審核、對外發布、分類與公告訂閱。
- **讀者帳號**：預留未來方向，這次不開放註冊。
- 舊的 \`/admin/feedback/\`、\`ADMIN_TOKEN\` 與頁尾入口在新後台經過完整驗證以前**維持原狀**。

## 三、第二階段：文章草稿與 GitHub 審稿發布

### 一次性設定：草稿資料庫

草稿資料表使用既有 `guide-feedback` D1。**新編輯 API 第一次使用時會以 `CREATE TABLE IF NOT EXISTS` 自動建立附加資料表及索引**，不更動留言或文章回饋表。另有可重複執行的 SQL 參考：

`services/admin-worker/migrations/2026-11-07-article-drafts.sql`

建議在第一次使用前先備份 D1。只有 Cloudflare Access 已驗證且 `admin_users` 角色為 owner／editor 的帳號可以操作。

### 一次性設定：GitHub 授權（只用於核准後 PR 與正式發布）

草稿儲存和提交管理員審核**不需要** GitHub token。若要將管理員核准的稿件建立 GitHub PR 並從後台發布，網站負責人需自行到 GitHub 建立專用的 Fine-grained personal access token：

- Resource owner：此網站的 GitHub repository 擁有者。
- Repository access：**Only select repositories**，只勾選 `minrhome-nlica/local-practice-guide`。
- Repository permissions：`Contents: Read and write`（建立分支、寫入核准的文章、合併 PR）；`Pull requests: Read and write`（建立審稿 PR）；`Checks: Read-only`（確認 SEO 建置測試）。
- 設定合理到期日並安排定期輪替。不要額外授予 `Administration` 或 `Workflows` 寫入權限。

然後到 Cloudflare → Workers & Pages → `guide-admin-console` → Settings → Variables and Secrets → **Add Secret**：

- **Name**：`GITHUB_EDITOR_TOKEN`
- **Value**：GitHub 所產生的 token（只貼在 Cloudflare Secret 欄位，**不要傳到聊天室、GitHub 原始碼、截圖或公開網址**）

權杖缺失、權限不足、GitHub main 的文章 SHA 改變、SEO 檢查尚未成功等情況，系統會阻止正式發布。所有正式文章仍只存在 GitHub main，Cloudflare D1 僅保存尚未公開草稿、審核結果及操作紀錄。

### 操作流程

1. 編輯或管理員進入後台 → 文章草稿與審核 → 文章列表 → 建立草稿。
2. 在 Markdown 原始碼中編修文章，按「儲存草稿」，再按「送交管理員審核」。送審後編輯內容鎖定。
3. 最高管理員點開待審草稿，查看修改比較；可填寫原因退回編輯。
4. 核對完成後按「核准並建立 GitHub PR」。這只建立待檢查 PR，**不會直接寫入正式網站**。
5. 等 GitHub PR 的 `check-seo` 顯示成功，最高管理員再按「正式發布」。後台會再查 SHA、PR 狀態、SEO 檢查並合併 PR。
6. GitHub Pages 執行原本自動部署，Google Sitemap 的 `lastmod` 會按文章 `updated` 自動更新。
7. 可在後台「操作紀錄」、原草稿、GitHub PR/commit 查到修改歷程。

**目前限制**：同一篇文章同時只允許一份未發布草稿。編輯器尚無圖片／附件上傳或 SEO 專屬摘要的直接編輯；要修改 SEO 專用資料 `src/data/seo.ts`，仍需另行更新 GitHub。除編輯器以外的網站程式請繼續按既有程式發布流程管理。

### 安全與權限

- `owner`：檢視全部草稿、建立／編修自己的草稿、退回審核、核准 PR、正式發布。
- `editor`：僅可存取自己建立的草稿、編修、提交審核、取消未發布草稿。
- `moderator`：完全無法呼叫編輯 API。
- POST 要求同源及 JSON；受 Access 與 D1 雙層身分檢查、草稿版本號防覆蓋、Markdown 基本安全檢查、主分支 SHA 防衝突、GitHub SEO CI 設為發布門檻；任何 API Token 不會傳送給瀏覽器。

## 四、舊版安全部署程序（供查閱）

### 1. 備份 D1 並建立後台資料表

Cloudflare → D1 SQL Database → 現有資料庫 **guide-feedback** → 備份。

於同一資料庫 Console 執行 \`migrations/2026-11-06-admin-console.sql\`。遷移只新增兩張表 \`admin_users\`、\`admin_audit\`，不會刪除既有留言或評分，可重複執行。

然後在**私有 D1 Console** 使用自己的 Email 建立第一位最高管理員（換成實際 Email、不要把資料貼入公開 GitHub 或聊天）：

\`\`\`sql
INSERT INTO admin_users (email, display_name, role, active, created_at, updated_at)
VALUES (lower('YOUR_EMAIL@example.com'), '網站負責人', 'owner', 1, datetime('now'), datetime('now'));
\`\`\`

### 2. 設定 Cloudflare Access 登入

在 Cloudflare Zero Trust：
1. 將 **Google** 設為身分提供者（需要 Cloudflare 所要求的 Google OAuth 設定）；同時啟用 **One-time PIN**，讓 Email 驗證碼可用。
2. 保護**獨立的後台 Worker 全部流量**（不是只保護單一網域，務必包含 \`workers.dev\` 與 Preview），使用「**明確指定 2～5 位工作人員的 Email**」作為允許規則。不要使用 Everyone、整個網域或 Public Bypass。
3. 取得 Access application 的 **AUD**（應用程式受眾識別碼），用在後台 Worker 的 \`ACCESS_AUD\` 一般環境變數。
4. 可將登入有效時間設定為工作人員適用的時間（例如 8 小時）；建議保留驗證碼與 Google 帳號的安全措施。

Cloudflare Access 內的允許名單與 D1 \`admin_users\` **都要**通過。新增員工時也要確認兩邊：D1 有角色，Access 允許這個 Email。Google／Email OTP **都不是**讀者會員註冊。

**重要**：不要把 Access 改成僅保護預覽，不要把此後台部署到現有公開 Worker 的路由。

### 3. 獨立建立 \`guide-admin-console\` Worker

推薦使用 Cloudflare Workers Builds 連接此 GitHub 專案，讓 Workers 的程式可以自動從 GitHub 更新，但**不要將此 Worker 指向公開網站目前的 deploy 工作流程**。

準備 \`services/admin-worker/wrangler.toml\`（從 \`wrangler.example.toml\` 複製，填寫 \`ACCESS_AUD\` 和 D1 ID；ID 本身不等於密碼），確認：
- \`name = "guide-admin-console"\`，必須與 Cloudflare 端 Worker 名稱相同。
- \`main = "src/index.js"\`，因為本後台是獨立的 ES module Worker。
- \`workers_dev = false\` 與 \`preview_urls = false\`（必要時在 Access 全部流量已啟用後再調整）。
- \`DB\` 指向原本 \`guide-feedback\` D1。
- \`ACCESS_AUD\` 必須與該 Worker Access application 的 AUD 相同；\`SITE_URL\` 為正式網站首頁網址。
- 新增 Custom Domain，例如 \`admin.guide.mountcounty.com\`，並確認 HTTPS 成功。

可在 Workers Builds 設定 GitHub repository 與根目錄 \`services/admin-worker\`。Wrangler 設定與 Cloudflare 側的 D1 binding、Access 必須一致；部署後請不要把 \`wrangler.toml\` 中的資料庫綁定刪除。

**不要把** \`ADMIN_TOKEN\`、Google OAuth secret、Cloudflare API token 或任何私密認證資訊寫入 GitHub。

### 4. 驗證後台，再切換既有管理入口

按照以下順序驗證：

1. 在無痕視窗打開後台網址，應先出現 Cloudflare Access 登入。
2. 用**不在 Access 允許名單**的 Email 測試，必須無法進入。
3. 用**Access 允許、但不在 D1 \`admin_users\`** 的 Email 測試，應回傳 403。
4. 最高管理員成功進入：能查看留言、文章評分、工作人員清單與稽核紀錄。
5. 編輯帳號只能看到必要入口，不可使用留言審核 API，也不可管理人員。
6. 留言管理帳號可審核留言，但不可管理人員。以同一筆留言模擬兩人同時編輯，較舊的版本應收到 409，而不是蓋掉新回覆。
7. 實際測試一筆待審核留言的「審核 → 前台公開 → 回覆」，確保原本公開網站沒有失效。
8. 登出並檢查 \`/cdn-cgi/access/logout\` 正常結束 Access 工作階段。
9. 檢查公開的 \`/api/comments\`、\`/api/ratings\` 仍正常。

**通過以上流程後**，才把公開網站頁尾的「工作人員留言管理」改指向後台、逐步停用原本的 \`ADMIN_TOKEN\` 登入。不能先切掉舊系統。

## 五、網站分析 Web Analytics：既有唯讀權杖

網站的 Cloudflare Web Analytics 瀏覽器追蹤已經在公開網頁上執行。後台透過唯讀 GraphQL API 自動辨識真正的站點 ID（siteTag），再查詢 `rumPageloadEventsAdaptiveGroups`：
- 最近 7 天／30 天的頁面瀏覽量（Pageviews）
- 訪問次數（Visits；**不是不重複訪客**）
- 每日瀏覽趨勢，以及熱門頁面路徑
- 未授權或 API 出錯時，顯示明確提示，不顯示虛構數據

**已透過 wrangler.toml 設定的識別資料（不是秘密）：**
- `CLOUDFLARE_ACCOUNT_ID`：與指南 Web Analytics 所在帳戶一致
- `WEB_ANALYTICS_SITE_TOKEN`：公開網站 `data-cf-beacon` 的 siteToken。**此識別碼與 GraphQL siteTag 不同，不得直接當作篩選條件。**
- `WEB_ANALYTICS_SITE_TAG`：可選的真正站點 ID（從官方 Web Analytics 網站資料或站點 URL 獲得）。預設不設定；後台會根據 GraphQL 的 `dimensions { siteTag requestHost }` 自動辨識，只採用指南正式或舊版 GitHub Pages 主機名稱。

**初次啟用時的授權步驟（目前管理員已設定過）：**

1. 在 Cloudflare 控制台的「帳戶 API Tokens」建立自訂權杖，名稱例如 `guide-admin-analytics-read`。
2. 權限選 **Account → Account Analytics → Read**；Resource 範圍儘量限制成指南所在的 Cloudflare 帳戶，不要使用 Global API Key 或 Edit 權限。
3. 到 Workers 和 Pages → `guide-admin-console` → Settings → Variables and Secrets → Add secret。
4. Secret 名稱填 `CLOUDFLARE_ANALYTICS_TOKEN`，Secret 內容貼入剛才建立的 token 並儲存；**絕對不要貼入 GitHub、聊天、網址或 public 變數**。
5. 登入 `https://guide-admin-console.e7968.workers.dev/`，打開「網站分析 Web Analytics」。
6. 查看 7 天與 30 天。若顯示讀取錯誤，確認 token 具有該帳戶 Analytics Read 權限和 siteTag 是否一致；如果 Cloudflare API 版本或資料集權限不同，可能需要調整查詢，不要自行擴權到 Edit。

Cloudflare 官方權杖設定指南：https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/

**安全設計**：Access 驗證與 D1 的 admin_users 白名單仍是必須條件；權杖只會在 Worker 伺服器端送往 Cloudflare，不進入瀏覽器或回應內容。查詢有短時間快取與錯誤降級機制。尚無帳戶權杖時，後台分析功能可開啟，但不會有實際瀏覽量。


## 手機版檢查與操作方式

- 在手機寬度約 320–1000 px 時，點頂端「功能選單」展開兩欄操作入口；小於 360 px 為單欄，選取頁面會自動收合。
- 留言篩選、回覆、審核確認按鈕與管理員權限在手機改為單欄／雙欄可完整操作，輸入欄採 16px 避免 iOS 自動放大。
- 7 天趨勢會縮到頁面範圍；30 天仍為每日數據，只能在圖表**內部**橫向滑動，不影響整頁寬度。
- 「文章目錄」由 Github 公開檔案建立，沒有 GitHub write token，因此不會直接寫入或發布。
- 「更新紀錄」只是 GitHub 提交分類的候選清單，不能當作人工核定發布公告。
- 不會自動替舊留言管理系統停權，也不會直接更動正式站的文章內容。

## 六、權限矩陣

| 功能 | owner | editor | moderator |
|---|---|---|---|
| 查看儀表板、文章評分 | ✅ | ✅ | ✅ |
| 讀者留言檢視與審核 | ✅ | ❌ | ✅ |
| 檢視／調整工作人員 | ✅ | ❌ | ❌ |
| 操作紀錄 | ✅ | ❌ | ❌ |
| 文章草稿編輯、送審 | ✅ | ✅（自己的草稿） | ❌ |
| 審核退回、建立 PR、正式發布 | ✅ | ❌ | ❌ |

## 七、檢查指令

\`\`\`bash
node --check services/admin-worker/src/index.js
node --check services/admin-worker/src/ui.js
node --check services/admin-worker/src/analytics.js
node --test services/admin-worker/tests/*.test.mjs
\`\`\`

GitHub Actions \`.github/workflows/admin-console-check.yml\` 同時測試認證、角色隔離、跨站修改、更新衝突、稽核，以及 D1 遷移可重複執行。

## 八、架構方向與後續整合

\`\`\`text
[讀者公開網站 / GitHub Pages]
             └──── Cloudflare 既有 feedback Worker ── D1: guide-feedback
                                                      │
[工作人員 / Google 或 Email OTP]                       │
             └──── Cloudflare Access ──── 新 admin Worker ┘
                                              │
                                      管理員 / 編輯 / 留言審核
\`\`\`

文章草稿與審核現在以 D1 暫存待發稿件，GitHub main 仍是唯一正式版本。建立 PR 與發布需要 GitHub Secret；系統在階段切換及合併前會確認文章原始 SHA，拒絕使用舊版覆蓋其他更新。

Web Analytics 已用 GraphQL API 與唯讀 Secret 實作，包含站點自動辨識、日期區間比對與錯誤降級。若原始報表有流量但後台沒有，請檢查站點的真正 `siteTag` 與 `requestHost`。不要把公開 beacon token 當作 GraphQL siteTag。

官方說明：
- Cloudflare Worker Access：https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Cloudflare Workers Builds：https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Access 工作階段：https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
- Cloudflare D1：https://developers.cloudflare.com/d1/
