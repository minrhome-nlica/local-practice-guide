# 首頁統計與讀者回饋：WordPress 搬遷規格

## 已上線的首頁功能
- `src/data/commonQuestions.ts` 是常見問題的單一來源；首頁每次載入隨機排列，先顯示六題，按鈕每次再顯示六題。問題頁維持完整題庫。
- FAQ 不使用 01、02 等靜態流水號，避免隨機抽題與排序相互矛盾。
- 首頁常見問題後方顯示六篇「精選知識百科」及「更多知識百科」入口。
- 實際全站閱讀統計未接入前，不能標示成「最多人查閱」。首頁遇到無資料的檔案時維持精選名單，不捏造人氣。
- 網站搬到 WordPress 時，只需替換統計輸出接口及頁面網址的生成方法，不必再改編輯題庫。

## 閱讀數據接口（供目前 Astro 首頁使用）
靜態資料：`public/data/entry-views.json`。前端讀取 `{base}/data/entry-views.json`。

格式：
```json
{
  "updated": "2026-11-06T10:00:00+08:00",
  "counts": {"subsidy-guide": 123, "budget-planning": 98},
  "top": ["subsidy-guide", "budget-planning", "reimbursement", "supplemental-premium", "income-withholding", "why-establish-business-studio"],
  "entries": [
    {"id": "subsidy-guide", "title": "補助案", "summary": "詞條摘要", "categoryName": "計畫與資源"}
  ]
}
```
生產端需給出六篇完整資料，並依有效閱讀次數由高到低排序 `top`。示例不是實際數據。前端只在資料完整時才標為「熱門知識百科」。

建議使用第一方統計或分析工具，依 **詞條永久 ID** 聚合頁面觀看數，而不是用路徑字串直接當身分。正式環境需過濾機器人、後台預覽、重整灌水，明訂觀測週期（例如最近 30 天），公開使用與隱私說明。不得以每位用戶本機 localStorage 計數充當全站統計。

## WordPress 反白回饋與留言實作方向（尚未上線）
GitHub Pages 本身沒有能接受並持久保存匿名留言的伺服器。因此不應假裝留言已送出，亦不應將公開寫入權杖放在瀏覽器。

推薦將留言資料實際儲存於 WordPress，開發獨立小型外掛，並以 WordPress REST API 提供接收與查詢：
- 詞條 ID `entry_id`（沿用 Astro 原本 slug，搬站不變）
- 段落錨點 `section_id`（例如章節 heading slug）
- 選取引用 `quote`（限定長度、純文字）
- 附近上下文 `prefix` / `suffix`（可選，用於文章編輯後重新比對）
- 留言類型 `kind`：提問 / 更正 / 補充
- 留言內容 `body`、作者顯示名稱 `author`、建立時間 `created_at`
- 管理狀態 `status`：pending / approved / rejected / resolved
- 唯一識別碼 `id`、文章版本 `article_revision`，必要時含回覆關係 `parent_id`

站內流程：
1. 只允許反白文章內文文字（排除表格、程式、章節導覽、按鈕和表單），於選取範圍附近顯示「針對這段提問／更正」。
2. 點擊按鈕開啟表單，內含選取原文與留言類型；提交後進入待審核，不立即公開。
3. 詞條頁可顯示該篇已核准留言，總留言區可依文章／時間／狀態篩選並連回原段落。
4. 編輯原文後用 quote + 上下文重新定位；無法確認時標示「原文已更新」，不可錯誤地指向另一段文字。
5. 後台必須提供垃圾訊息防護、頻率限制、輸入清理、審核、刪除、封鎖與個資處理方式。
6. 不建議把留言、電子郵件或用戶資訊直接提交到 GitHub 原始碼或公開 JSON。

未來 WordPress 的 REST API 路徑與權限、統計端點可以不同，但保留以上資料欄位、穩定詞條 ID 和段落錨點，就有移轉餘地。對外查詢端點只提供審核通過的資料。後端 CSRF、防機器人與權限控制需在正式啟用前測試。

## 搬站
現有 `astro.config.mjs` 仍指定 GitHub Pages 子路徑。若成為 `https://www.mountcounty.com/local-practice-guide/` 的 WordPress 頁面，須改成 WordPress 原生文章／頁面、外掛或嵌入式前端其中一種架構，不是只修改 DNS。
本次採用單一 FAQ 資料、詞條 slug、可替換讀取統計的資料接口；避免把 GitHub Pages 的網址寫成留言或閱讀統計的永久 ID。
