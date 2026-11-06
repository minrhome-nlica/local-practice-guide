# guide.mountcounty.com：自訂網址啟用清單

## 現況
- 正式網址規劃：`https://guide.mountcounty.com/`，不取代 `https://mountcounty.com/`。
- 現有 GitHub Pages 原址在 DNS 設定前仍維持 `https://minrhome-nlica.github.io/local-practice-guide/`。
- `astro.config.mjs` 已支援兩種模式；預設仍使用原網址，不會提前切換。
- `scripts/prepare-domain-output.mjs` 會在新網址模式自動修正輸出 HTML、CSS、JS 中舊的 `/local-practice-guide/` 站內路徑（包含文章圖像、下載與字型）。
- 工作流程中已傳入 GitHub Actions repository variable `GUIDE_CUSTOM_DOMAIN`。**沒有設為 `true` 前不會改成新網址**。

## 網域管理員需要完成
1. 在 GitHub 個人帳號 Settings → Pages 可先驗證 `mountcounty.com` 所有權（建議安全步驟；GitHub 會提供專屬的 DNS TXT 值，不應臆測）。
2. 開啟本 repo：`https://github.com/minrhome-nlica/local-practice-guide/settings/pages`。在 **Custom domain** 填入 `guide.mountcounty.com` 並儲存。由 GitHub Actions 發布，通常不需要手動建立 CNAME 檔。
3. 到真正管理 `mountcounty.com` DNS 的後台新增一筆（若 `guide` 已有其他 A/AAAA/CNAME，應先檢查衝突）：

   | 類型 | Name / Host | Value / Target | TTL |
   | --- | --- | --- | --- |
   | CNAME | guide | minrhome-nlica.github.io | Auto 或 300 |

   只增修 **guide** 主機名稱；**不要更動 @ 或 www**，以免影響現有主網站與郵件。
4. 在 GitHub repo Settings → Secrets and variables → Actions → **Variables**，新增 repository variable：
   - Name: `GUIDE_CUSTOM_DOMAIN`
   - Value: `true`
   隨後在 Actions 重跑 Deploy Local Practice Guide（或推送更新），讓正式網址以 `base: '/'` 建置。
5. GitHub Settings → Pages 等待 DNS check 與憑證完成，勾選 **Enforce HTTPS**。DNS 擴散最多約 24 小時。
6. 檢查首頁、文章內部連結、圖片、搜尋、字型、下載及計算機；開啟 `https://guide.mountcounty.com/`。

## 無法代替使用者操作的部分
目前 GitHub 連線工具可修改 repository 檔案與讀取 Actions 紀錄，但不支援修改 GitHub Pages 的 Custom domain 設定，也沒有 `mountcounty.com` DNS 管理後台權限。因此上述第 1～3、4（變數建立）及第 5 項 Pages HTTPS 勾選，必須由有權限的人在網頁後台完成。

GitHub 官方：
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https


## 啟用後的檢查與復原
- 更新 Actions repository variable 不會單獨觸發部署，需在 GitHub Actions 執行一次手動 workflow dispatch，或提交 repository 內容後才會重新發布。
- 在建置紀錄中搜尋 `Domain adapter:`：出現 `rewrote legacy links` 才表示 `GUIDE_CUSTOM_DOMAIN=true` 已傳入建置程序；若出現 `GitHub Pages project path (no changes)`，請檢查 Repository variables 的名稱與值。
- 檢查 `https://guide.mountcounty.com/` 的首頁、文章、圖片、搜尋、下載及字型。HTTPS 憑證可能晚於 DNS 生效。
- 如需回復先前路徑，可將變數改回 `false`，再重新執行部署；但網域設定本身仍應由網域管理者確認。
