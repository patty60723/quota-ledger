# 額度帳本

幫自己控制衝動消費的記帳 App。目前是 v0.1 原型：單一 HTML 檔，用手機瀏覽器開啟即可使用。

## v0.1 功能

- 快速記帳：選類別後立即顯示「記下後本期還剩多少」
- 類別與每月預算上限、快用完／超支提醒
- 固定收支：到收支日在首頁出現待確認，可改金額或略過
- 明細、報表（分類排行、近 6 期收支）
- 設定：週起始日、月預算起始日（1–31，當月沒有這天就用月底）
- 匯入 Google Sheet 下載的 .xlsx、匯出／還原 JSON 備份

## 資料存放

- 在 claude.ai 上開啟時，資料存在該頁面的雲端資料庫（只有擁有者能讀寫），電腦和手機同步。
- 部署成 PWA（或直接開 `index.html`）時，資料只存在那個瀏覽器的 localStorage，不會同步。兩邊的資料可以用「匯出備份／從備份還原」搬移。

## 部署成 PWA（Cloudflare Pages）

1. 登入 Cloudflare → Workers & Pages → 建立 → Pages → 連接到 Git，選 `quota-ledger`。
2. 建置設定：Framework preset 選 None，Build command 留空，Build output directory 填 `/`。
3. 部署完成後會得到 `https://<名稱>.pages.dev`。之後推到 `main` 會自動重新部署。
4. 手機打開該網址：
   - iPhone：Safari → 分享 → 加入主畫面
   - Android：Chrome → 選單 → 安裝應用程式
5. 安裝後即使離線也能開啟與記帳。

**更新版本時**：改完檔案後把 `sw.js` 裡的 `VERSION` 加 1，手機下次開啟（有網路時）才會拿到新版。

## 檔案

- `index.html`：整個 App
- `manifest.json`、`icons/`：安裝到主畫面用的名稱與圖示
- `sw.js`：離線快取

## 後續版本

- v0.2：每筆／單日／每年上限、分期與額度占用、超支選單、儲蓄、退貨沖銷
- v0.3：慾望清單與 AI 分析、自動評分
- v1.0：帳戶／支付方式、簡易／進階模式、雲端同步
