# 工作人員留言管理（同一網站）

頁面：\`https://guide.mountcounty.com/admin/feedback/\`，從網站頁尾「工作人員留言管理」可進入。

## 使用方式
1. 開啟管理頁面，**先確認瀏覽器沒有出現 HTTPS「不安全」警告**。如果有，禁止在這個頁面輸入管理金鑰，先處理 GitHub Pages 的網域憑證。
2. 填入原本保存在 Cloudflare Worker Secret \`ADMIN_TOKEN\` 的管理金鑰。
3. 登入後會看到「待審核」留言，也可切換已公開、已處理、已拒絕。
4. 每則留言提供「查看詞條」、選取原文、讀者留言、編輯回覆、通過並公開、標記已處理、退回待審、拒絕、只儲存回覆。
5. 按「登出」或關閉頁面即可結束。金鑰不會儲存在 localStorage、sessionStorage、cookie 或網址裡，每次進入要重新輸入。

## 安全邊界
- GitHub Pages 是靜態網站，因此**任何人都能開啟登入畫面**。但真正的留言資料與管理動作都由 Cloudflare Worker 驗證 \`ADMIN_TOKEN\` 後才提供。
- 此版本只有一組**共享管理金鑰**，不是每位工作人員獨立帳號。拿到金鑰的人都具備管理權限，無法分辨是哪位同事審核。若夥伴增加，建議升級為每人獨立登入、MFA、權限分級、稽核紀錄與金鑰輪替。
- 管理員使用的電腦若有惡意擴充功能或網站程式遭注入，金鑰仍有可能外洩，因此這是試用過渡版，不應視為正式多帳號權限系統。
- **不要**把管理金鑰貼在 GitHub repository variables、HTML 原始碼、留言視窗、工作群組聊天或公開截圖。它必須只保留為 Cloudflare Worker Secret，透過管理員登入表單提供。
- 前端只使用既有 Cloudflare Worker 的 \`GET /api/admin/comments?status=...\` 和 \`POST /api/admin/comments/{id}\`，不需要更改 D1 資料表或 Worker 程式。
- 目前後端各狀態最多回傳 100 則；大量留言時應改成後端分頁。

若出現「管理金鑰錯誤」：回 Cloudflare Worker 的 Secret 設定檢查 \`ADMIN_TOKEN\` 是否和密碼管理器保存的金鑰一致（不要將金鑰貼到聊天或重新部署到 GitHub）。

若原網站的 HTTPS 憑證仍未修正，請暫時使用 Cloudflare D1 控制台審核；不要在 Chrome 已顯示不安全的網站輸入管理金鑰。
