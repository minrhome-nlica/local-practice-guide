# 地方實踐指南 Local Practice Guide

這是《地方實踐指南》的 GitHub 網站原型。以花蓮地方工作實務教材為基礎，建立獨立、可搜尋、可持續編輯的知識網站。

## 第一版提供什麼

- 編輯刊物風格的首頁與手機版
- 六大知識分類、詞條頁、相關延伸閱讀
- 問題導向的入口與三條學習路徑
- Pagefind 靜態全文搜尋
- 兩份示例下載文件
- Pages CMS 的編輯設定

目前上架的六篇文章均為示範稿；部分行政及保險規則尚待重新查核。請勿將示範稿視作正式法規指引。

## 如何發布到 GitHub Pages

1. 開啟 Repository 的 Settings → Pages。
2. 在 Build and deployment → Source 選擇 GitHub Actions。
3. 開啟 Actions，確認 Deploy Local Practice Guide 執行成功；必要時使用 Run workflow。
4. 發布網址預期為 https://minrhome-nlica.github.io/local-practice-guide/ 。

GitHub Actions 會在 main 分支更新時自動建置 Astro，並用 Pagefind 建立搜尋索引。

## 本機開發

需 Node.js 22.12 以上。

1. npm install
2. npm run dev
3. npm run build

## 如何編輯文章

- 檔案在 src/content/entries/*.md。
- 每篇文章上方的 frontmatter 記錄 title、summary、category、level、updated、status。
- 分類代稱在 src/data/catalog.ts。
- 可以在 https://app.pagescms.org 連結同一個 GitHub repository，使用根目錄的 .pages.yml 編輯詞條。
- 請先檢查試用中的 Pages CMS 欄位及日期格式，正式投入協作前再加上審核流程。

## 專案檔案

- src/pages/：網站頁面
- src/content/entries/：Markdown 詞條
- src/layouts/：共用頁面版型
- src/styles/：整站視覺
- public/downloads/：範例可下載檔案
- .github/workflows/deploy.yml：自動部署

## 內容與風險

本網站為第一版原型，非已完成查核的正式知識庫。補助、稅務、健保及法律內容需依當年度機關公告逐條核對，確認後才更改狀態並正式推廣。

站點目前以 GitHub Pages 的子路徑 /local-practice-guide/ 發布。未來更換獨立網域時，必須同步調整 astro.config.mjs 的 site 與 base。