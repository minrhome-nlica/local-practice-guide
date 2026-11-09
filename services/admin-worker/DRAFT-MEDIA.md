# 管理後台：私人圖片與附件上傳

此功能與文章草稿綁定，並不需要讓編輯人員直接操作 GitHub。檔案先放在 Cloudflare **私人 R2 Bucket**，文章與附件經最高管理員審核、GitHub PR 自動檢查及合併後，才會同步出現在公開網站。

## 首次啟用（此專案目前尚未建立 R2 綁定）

1. 由 Cloudflare 帳戶管理員打開 **R2 Object Storage**，建立私人 Bucket，例如 `guide-draft-assets`。**不啟用 R2 公開網域，也不要開放公眾讀取。**
2. 在 Cloudflare Workers `guide-admin-console` 的 **Settings → Bindings** 新增 **R2 Bucket** 綁定：Variable name = `GUIDE_MEDIA`，Bucket = 剛才建立的私人 bucket。
3. 由於本專案 Worker 使用 GitHub 上的 `services/admin-worker/wrangler.toml` 自動部署，**也必須在 R2 bucket 真正建立後**，於該檔增加：
   ```toml
   [[r2_buckets]]
   binding = "GUIDE_MEDIA"
   bucket_name = "guide-draft-assets"
   ```
   上面 bucket_name 應以實際名稱為準。**尚未建立 Bucket 前不可直接加入這段設定**，否則現有 Cloudflare 部署可能失敗。請讓維護網站的人依真實 Bucket 名稱更新設定。
4. 完成綁定及重新部署後，進入管理後台 → 文章草稿與審核 → 選擇一份編輯中的草稿，圖片附件區應顯示「私人附件空間已連接」。
5. 選檔、上傳、點「插入文章」、**儲存草稿**；文章送審後不能再更改附件。
6. 管理員核准時，系統將只把**該草稿 Markdown 真正引用的附件**加入 GitHub 審核分支。合併前會再次核對文章、SEO 及附件清單，拒絕任何意外的檔案變動。

## 安全與限制

- 允許：PNG、JPG、JPEG、WebP、PDF、DOCX、XLSX；單檔最多 5 MB；每篇草稿最多 12 個附件、總計 24 MB。
- 不接受 SVG、HTML、JS 或巨集文件，並檢查已知檔案格式的檔頭；這是降低風險，不代表能取代專業惡意程式檢測。
- 上傳檔案只經管理員的 Cloudflare Access 與後台角色權限檢查後才可查看；未審核草稿附件不會取得公開網址。
- 建立 GitHub PR 不等於公開；合併到網站正式分支，且 GitHub Pages 完成部署後，才成為公開附件。
- PDF、Office 檔案以下載方式提供私人預覽；網站正式發布後則由 GitHub Pages 靜態提供。
- 圖片可能包含攝影時間、GPS 等 EXIF 資訊。請在上傳前自行移除敏感中繼資料。此版本**不會自動清除 EXIF**。
- 不需要新增 API 密鑰或將 R2 Access Key 提供給本專案；R2 綁定由 Cloudflare Worker 本身管理。
- R2 草稿檔案目前沒有自動到期／清除排程；取消草稿後原始檔可能仍在私人 Bucket。後續應依資料保存政策規劃清理機制，而不是直接把 Bucket 設為公眾可讀。

## 使用介面

- 編輯器提供大標題、小標題、粗體、清單、表格與連結的插入按鈕。
- 上傳後點「插入文章」，插入的 Markdown 路徑會指向 `/assets/guide/<文章 slug>/<檔案 ID>.<副檔名>`。
- 文章預覽不執行 HTML／JavaScript，能顯示基本標題、段落、粗體、清單、Markdown 表格與私人圖片；複雜原始 HTML 仍以文字原碼顯示，最終排版應在 GitHub Pages 建置後查核。

本功能與使用者已暫緩的「行政實務工具中心」無關，不會新增計算器。
