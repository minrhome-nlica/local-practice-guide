# 地方實踐指南 SEO 維護說明（2026-11-07）

正式網站：<https://guide.mountcounty.com/>

## 已建置的搜尋引擎資訊

- **首頁**：專屬 SEO 標題與摘要，JSON-LD `WebSite`、`Organization` 及 `WebPage`。網站名稱「地方實踐指南」，以社團法人花蓮縣牛犁社區交流協會為網站出版單位。
- **文章**：21 篇詞條的個別搜尋標題／摘要放在 `src/data/seo.ts`。內文標題、正文及 URL 均不因此更動。文章 JSON-LD 包含 `Article`、`BreadcrumbList`、`dateModified`，日期依原詞條的 `updated` 欄位。
- **分類與導覽**：首頁、知識百科、六大分類、常見問題、學習路徑各有具體且不重複的搜尋摘要；分類頁含結構化麵包屑。
- **Sitemap**：`scripts/generate-sitemap.mjs` 每次建置產生 `dist/sitemap.xml`。只收錄正式 canonical URL；含 `noindex` 的內部管理、站內搜尋及舊版轉址頁不列入。僅詞條使用可查核的 `updated` 作為 `lastmod`，不把每次網站部署誤標為文章更新。
- **robots.txt**：指向站點 Sitemap，限制舊版管理頁；站內搜尋使用 `noindex,follow` 而不是 robots 阻擋。
- **社群分享**：Open Graph 與 Twitter 標題、摘要及圖片，延續目前 Mount County 站點標誌。分享圖片目前使用標誌檔，不冒稱已有專屬的寬幅主視覺。
- **品質檢查**：`scripts/check-seo.mjs` 檢查實際建置後的網站 URL、JSON-LD、Sitemap、文章日期、重複標題、搜尋規則及 Search Console 驗證檔案；`.github/workflows/seo-check.yml` 自動執行。

## 編輯文章時如何維護

1. 保留文章 `src/content/entries/<slug>.md` 的原有標題與內容。更新內容時先確認法令資訊和案例。
2. 若修改內容涉及重要新增、修正或重大結構調整，依**實際**修訂日期更新該檔頭的 `updated: YYYY-MM-DD`。僅修改版權年份、字體或重新部署時，不要擅自更新日期。
3. 一起檢查 `src/data/seo.ts` 對應詞條的搜尋標題、摘要是否仍符合內文。摘要要直接說明文章能回答什麼，不堆砌搜尋字詞。
4. 如果新增詞條，要為新文章在 `src/data/seo.ts` 加入個別搜尋描述，並確認網站內容目錄有連結可以找到它。
5. 發布後確認 GitHub 自動建置通過，並檢查 `https://guide.mountcounty.com/sitemap.xml` 與實際文章。
6. Google Search Console 不需要每天重複提交整份 Sitemap；系統會自行重新讀取。

## Google Search Console 追蹤

- 搜尋服務網址：<https://search.google.com/search-console/>
- 已完成網址前置字元 `https://guide.mountcounty.com/` 的所有權驗證，並於 2026-11-07 提交 Sitemap 和首頁、數篇關鍵文章的索引申請。
- 主要查看「網頁索引狀態」「Sitemap」「搜尋成效：點擊、曝光、查詢字詞」「網址審查」。
- Cloudflare Web Analytics 的造訪與網頁瀏覽指標，與 Google Search Console 的搜尋點擊、曝光不同，不能當作相同數據比較。
- Google 是否收錄、何時更新搜尋摘要與搜尋排名，仍由 Google 系統決定；SEO 標記不保證排名或豐富搜尋結果。

## 不應使用的捷徑

- 不憑空新增五星評價、假評論、問答或隱藏關鍵字。
- 不替未核實的文章標示作者或初次發布日期。
- 不因為每天重新部署而把 `lastmod` 變成今天。
- 不在 Sitemap 放入 `noindex`、管理入口、站內搜尋或重複內容網址。

官方參考：
- [Google 的搜尋結果標題建議](https://developers.google.com/search/docs/appearance/title-link)
- [Google Article 結構化資料](https://developers.google.com/search/docs/appearance/structured-data/article?hl=zh-tw)
- [Google Sitemap 與 lastmod 建議](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=zh-tw)
