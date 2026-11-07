# Cloudflare Workers Builds 首次部署檢核

此檔案用於在連結 GitHub 後啟動第一筆後台自動建置，不影響現有公開指南。

- 服務：`guide-admin-console`（與公開 `guide-feedback-api` 分開）
- Cloudflare Workers Builds 監聽分支：`feature/admin-console-phase1-20261106`
- 根目錄：`/services/admin-worker`
- 建置命令：留空
- 部署命令：`npx wrangler deploy`
- 設定：`wrangler.toml`（名稱、main 入口、D1 和 Access AUD）
- 前置條件：Worker 的 Cloudflare Access 已保護所有流量，且 D1 `admin_users` 有啟用的 owner
- 驗證：Cloudflare → Worker → 部署（Deployments）→ 查看建置歷史，確認生產建置成功。
- 確認成功前：不要停用舊留言管理，也不要更動公開 Worker 的 Access。

正式介面登入後應顯示「地方實踐指南｜管理後台」而非 Hello World；若顯示 403／503，請查驗 Access 應用程式 AUD、`DB` 繫結、帳號白名單和資料表。

本專案仍使用 GitHub 草稿 PR，不須將後台開發分支合併到網站的 `main` 才能部署獨立 Worker。
