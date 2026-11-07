# 地方實踐指南：工作人員管理後台（獨立 Cloudflare Worker）

> 此後台已於 2026-11-07 經由 Cloudflare Workers Builds 上線，入口為 `https://guide-admin-console.e7968.workers.dev/`，並由 Cloudflare Access + D1 管理員白名單進行雙重授權。
>
> 後台程式仍從獨立開發分支自動部署；公開網站頁尾已指向新管理後台，舊版留言管理暫留備援。

## 第二階段：文章草稿、送審與安全發布

本階段程式已具備文章正文編輯、D1 草稿、退回修改、管理員核准建立 GitHub PR，以及通過自動檢查後合併發布的完整流程。

**但新功能必須先完成兩項 Cloudflare 私有設定，才會正式啟用：**

1. **D1 備份與遷移**：Cloudflare → D1 SQL Database → `guide-feedback` → 先備份，再進入 Console 執行 `migrations/2026-11-07-article-drafts.sql` 的全文。這是加法建表，可重複執行，不會更動留言、評分與現有管理員。
2. **設定 Worker Secret（只供最高管理員發布）**：在 GitHub 建立**細緻範圍的 Fine-grained personal access token**，只能使用 `minrhome-nlica/local-practice-guide` 這一個 repository，至少勾選：
   - Repository permissions → **Contents: Read and write**
   - **Pull requests: Read and write**
   - **Checks: Read**（用來確認 `check-seo` 自動測試確實通過）
   
   在 Cloudflare Workers → `guide-admin-console` → Settings → Variables and Secrets 新增 **Secret** `GITHUB_EDITOR_TOKEN`，貼入權杖。請勿在聊天、GitHub、網址或一般公開環境變數中放入權杖。可為 Token 設定適當的到期日，之後定期輪換。

**操作流程：**
- `editor` 與 `owner`：到「文章草稿與審核」選公開文章，編輯 **Markdown 正文**（原有標題、分類、SEO 資料與圖片配置不會被草稿改動），按「儲存草稿」，確認差異後「送出審核」。
- `owner`：檢查修改前後的文字、法規數據與 GitHub 版本，可「退回修改」並附原因；核准時建立 `guide-editor/<draft-id>` 分支與 PR，**不會直接修改 main**。
- `owner`：在 GitHub PR 核對完整差異及 SEO 測試通過後，再按「檢查並正式發布」。後台會再次確認正式文章並未被其他人更新，才允許合併 PR 至 main；成功合併後正式網站由 GitHub Pages 自動部署。
- 公開站部署後，原有 Sitemap 及文章 `updated` 日期會依正式建置更新；只在核准發布時改動這次文章的 `updated` 日期。
- 工作人員可在「操作紀錄」查看草稿建立、儲存、送審、退回、建立 PR、正式發布的管理紀錄。草稿只存在 D1，不會在讀者網站曝光。

**安全限制及已知範圍：**
- 不允許未經審核的草稿直接發布；`moderator` 既不能查看也不能修改草稿；`editor` 只能查看與修改自己建立的草稿。
- 保存原始 GitHub blob SHA 與 D1 草稿修訂版本，避免多人修改覆蓋與舊版內容直接發布；GitHub PR 自動檢查未通過時不能由後台合併。
- 編輯器目前為 Markdown 正文＋安全的簡化閱讀預覽＋文字差異比較，**不是完全模擬 Astro 正式排版的 WYSIWYG**。含圖表、互動元件或自訂 HTML 的文章須查看 GitHub PR 與部署後畫面。新建文章、圖片上傳、SEO 標題直接編輯、版本一鍵回復及公開更新公告仍未開放。
- GitHub 操作可能因網路中斷只執行部分步驟。若建立分支／PR 後發生錯誤，**不要反覆建立相同 PR**，先由管理員到 GitHub 查看 `guide-editor/` 分支與 PR 狀態，再處理。
- 如果未執行 D1 遷移，後台既有留言、評分和分析功能仍會正常；文章編輯頁會顯示需要初始化草稿資料表。
- 若未設定 `GITHUB_EDITOR_TOKEN`，草稿與送審／退回可使用，但核准建立 PR 和正式發布不可使用，也不會宣稱成功。

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
- **文章目錄＋草稿審核**：可搜尋、篩選文章；完成 D1 與 GitHub Secret 設定後可在後台建立草稿、修改正文、送審、退回、核准 PR 與正式發布。
- **重要更新紀錄（內部候選）**：讀取 GitHub main 的最近提交，依文章／新功能／修正／一般維護分類；僅供管理員核對，不自動公開發布。
- 留言回覆未送出時，在當前頁面工作階段內暫存輸入（純瀏覽器記憶體；不是資料庫草稿），切換篩選可保留輸入；提交成功才清除。
- 一旦部署，與 **現有** \`guide-feedback\` D1 共用資料，但 **不修改現有公開留言 Worker**。

## 二、第一階段尚未實作

- **完整 WYSIWYG 與版本一鍵還原**：目前編輯器有 Markdown 正文編輯、簡化預覽、修改前後文字比較；尚不支援圖片直接上傳、完全還原既有 HTML 元件排版、完整歷史版本還原。

- **重大更新公開公告**：內部候選清單已實作；下一階段才加入管理員審核、對外發布、分類與公告訂閱。
- **讀者帳號**：預留未來方向，這次不開放註冊。
- 舊的 \`/admin/feedback/\`、\`ADMIN_TOKEN\` 與頁尾入口在新後台經過完整驗證以前**維持原狀**。

## 三、安全部署程序（須由 Cloudflare 管理者操作）

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

## 四、網站分析 Web Analytics：最後一項手動授權

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

## 五、權限矩陣

| 功能 | owner | editor | moderator |
|---|---|---|---|
| 查看儀表板、文章評分 | ✅ | ✅ | ✅ |
| 讀者留言檢視與審核 | ✅ | ❌ | ✅ |
| 檢視／調整工作人員 | ✅ | ❌ | ❌ |
| 操作紀錄 | ✅ | ❌ | ❌ |
| 草稿編輯與送審（完成 D1 遷移後） | ✅ | ✅ | ❌ |
| 核准 PR 與正式發布（需 GitHub Secret） | ✅ | ❌ | ❌ |

## 六、檢查指令

\`\`\`bash
node --check services/admin-worker/src/index.js
node --check services/admin-worker/src/ui.js
node --check services/admin-worker/src/analytics.js
node --test services/admin-worker/tests/*.test.mjs
\`\`\`

GitHub Actions \`.github/workflows/admin-console-check.yml\` 同時測試認證、角色隔離、跨站修改、更新衝突、稽核，以及 D1 遷移可重複執行。

## 七、架構方向與後續整合

\`\`\`text
[讀者公開網站 / GitHub Pages]
             └──── Cloudflare 既有 feedback Worker ── D1: guide-feedback
                                                      │
[工作人員 / Google 或 Email OTP]                       │
             └──── Cloudflare Access ──── 新 admin Worker ┘
                                              │
                                      管理員 / 編輯 / 留言審核
\`\`\`

已完成的草稿編輯與審核使用 GitHub 當唯一正式來源，避免 D1 草稿和 Markdown 同時變成不同版本。建議草稿建立時存原始 Git SHA、編輯者、變更時間，管理員看到文字 diff，審核時確認 GitHub 原版沒有被其他人更新，才以 GitHub API 或 Pull Request 發布。預設不允許直接改 main。

Web Analytics 已用 GraphQL API 與唯讀 Secret 實作，包含站點自動辨識、日期區間比對與錯誤降級。若原始報表有流量但後台沒有，請檢查站點的真正 `siteTag` 與 `requestHost`。不要把公開 beacon token 當作 GraphQL siteTag。

官方說明：
- Cloudflare Worker Access：https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Cloudflare Workers Builds：https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Access 工作階段：https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
- Cloudflare D1：https://developers.cloudflare.com/d1/
