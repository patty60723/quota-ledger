# Quota Ledger 2.0 — UI/UX Refinement Implementation Report

> 給 Claude Code / Cursor 的實作規格。目標是 refinement，不是重做產品。

## 1. 設計結論

Quota Ledger 現有視覺方向成立：暖米白背景、深暖灰文字、粉陶 CTA、低飽和分類色、圓角卡片與線性圖示已形成一致的「Warm Editorial Finance」語言。這次不應改成典型藍綠 fintech，也不應大幅 gamification。

本輪只處理四件事：

1. 強化「額度」為產品獨有的視覺語言。
2. 重新拉開數字、狀態、輔助資訊的 hierarchy。
3. 統一 icon stroke / size / optical weight。
4. 將「看懂」從資料展示改成 insight-first，但保留原始明細可深入查看。

### 不要改動
- 不重寫 financial calculation / budget business logic。
- 不更換目前暖色品牌方向。
- 不取消 category pastel color coding。
- 不移除底部 4 tabs。
- 不改資料格式或 localStorage schema，除非功能本身需要。
- 不引入大型 framework；目前單一 `index.html` 架構可先做 UI refinement。

---

## 2. 從 9 張實機畫面得到的 UX 問題

### P0 — 首頁 Hero 已經是對的，但額度語意可以更清楚
目前「今天可以花 NT$6,345 / 10,006」是全 App 最成功的視覺。保留深色 Hero，但：
- `6,345` 是唯一 Display 級數字。
- `/ 10,006` 降至 18–20px、60% opacity。
- 進度條上的垂直 marker 要有明確語意（若代表今日建議線，需文字/accessible label；若沒有必要則移除）。
- 「本期預算還剩 / 剩下 / 已節省結餘」三欄保留，但 label 12–13px、value 22–24px。
- 所有 money number 使用 `font-variant-numeric: tabular-nums`。

### P0 — 「需要注意」要成為首頁的 decision layer
目前已很好。調整：
- 不要把「快用完」「超支」只做 badge；第二行直接說結果。
- 快用完：`已用 91% · 還剩 NT$1,000`。
- 超支：`已用 127% · 超出 NT$1,358`。
- 快用完使用 ochre；超支使用 terracotta；不要整張 card 染色。
- 整列可點，chevron 保留。

### P0 — 預算進度列表需要分組
目前 11 類全部平鋪，掃描成本高。改為：

**需要注意**
- 超支
- >= 85% 快用完

**其他類別**
- 其餘依使用比例由高到低（或保留使用者原排序，但「需要注意」永遠置頂）。

不要只用 badge 傳達狀態；文字和 progress 都要可辨識。

### P0 — 「看懂」頁要 insight-first
現在「看懂」包含收支分析、預算進度、年度推算，資訊完整但仍像報表。

首頁區塊順序建議：
1. 本期一句話摘要（例如：`9 月目前支出 NT$47,733`）。
2. 需要注意的 1–3 件事。
3. 分類支出 / 預算進度。
4. 年度推算。
5. 詳細表格。

年度表格保留，因為 power user 有價值，但放在洞察之後。

### P1 — 預算設定頁 hierarchy
「每月預算合計 NT$71,900」不應是最核心概念。改為：
- Hero label：`可分配預算`
- Hero value：`NT$81,059`
- Secondary：`已分配 NT$71,900`、`未分配 NT$9,159`
- 再顯示：`預估月收入 NT$89,059 - 目標儲蓄 NT$8,000`

### P1 — 固定收支列表
保留列表，不需要卡片化每一筆。每列：
- title 16px / 600
- amount 16px / 600 / tabular
- metadata 13px / secondary：`每月 1 日 · 交通`
- section summary `支出 12 筆` / `每月 -7,487` 只做低權重 header。

### P1 — 想買頁
這是差異化功能，視覺要把「等待」而不是「分數」當主角。
- Status：`再等等` / `可以買` / `會影響本期預算`
- 顯示 `已等待 X 天`。
- `為什麼？` 改為 `為什麼想買？`，較符合使用者語言。
- 不在卡片第一層顯示 score。
- 「買了」是 primary；「編輯」secondary。
- 未來可加 impact preview，但本輪不要改 business logic。

### P1 — 年度推算
現有表格資訊密度合理，不要強行卡片化每一列。
- 頂部粉色 callout 改為 neutral/positive insight surface，避免粉色被誤認為 warning。
- `照這樣下去，2026 年約可存 NT$96,000` 中數字加粗即可。
- 「只有 1 個月資料」的可信度說明保留且提高可見性。
- 超過年度上限的數字可 terracotta，但需加文字/符號語意，不能只靠顏色。

---

## 3. Design System

### 3.1 Color tokens
以現有奶茶風格為主，不做破壞性改色。

```css
:root {
  --ql-bg: #F7F5EF;
  --ql-surface: #FFFEFB;
  --ql-surface-subtle: #F0EDE7;
  --ql-text: #4A443F;
  --ql-text-2: #77716C;
  --ql-text-3: #9C9690;
  --ql-border: #E5E0D9;

  --ql-hero: #4B433D;
  --ql-hero-text: #FFFDF9;
  --ql-accent: #DFA593;
  --ql-accent-soft: #F3DDD5;

  --ql-sage: #71806B;
  --ql-sage-soft: #E2EADF;
  --ql-blue: #718796;
  --ql-blue-soft: #E0EAF0;
  --ql-ochre: #9A741F;
  --ql-ochre-soft: #F3E8C9;
  --ql-terracotta: #A9534D;
  --ql-terracotta-soft: #F3DCD9;
  --ql-lavender: #7D6D88;
  --ql-lavender-soft: #EAE2EE;
}
```

Category colors remain semantic-by-category, not good/bad.

### 3.2 Typography
```css
.money { font-variant-numeric: tabular-nums; }
```
- Hero money: 44–48px / 700
- Page title: 28px / 700
- Section title: 20px / 700
- Row title: 16px / 600
- Body: 15px / 400–500
- Metadata: 13px / 400
- Caption: 12px / 500

Do not use more than 3 font weights on one screen.

### 3.3 Radius
- Hero: 24px
- Large card: 20px
- Small card: 16px
- Input/button: 12–14px
- Icon tile: 14px
- Pill: 999px

Avoid making every component 24px.

### 3.4 Shadow
Cards should mostly rely on surface + border. Only elevated cards/FAB:
```css
box-shadow: 0 2px 6px rgba(50,44,39,.05), 0 10px 24px rgba(50,44,39,.06);
```

### 3.5 Spacing
4pt system: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40.
Page horizontal padding 20px (current ~26px can feel slightly wide on narrow devices).

---

## 4. Icon System — 必須統一

Assets included in `assets/icons/`.

Rules:
- SVG `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"`
- `stroke-width="1.75"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`
- Navigation: 22–24px
- Category: 20–22px inside 48–52px pastel tile
- Utility/action: 20px
- Do not mix emoji and SVG icons in primary UI.

### Icons to replace/refine first
1. Bottom nav: Today / Details / Wishlist / Insights — same optical weight.
2. FAB add — same stroke system.
3. Category icons whose current visual density varies: donation, daily goods, utilities, dining, network.
4. Exercise icon can stay conceptually dumbbell but normalize stroke.
5. Wishlist icon should not use gift-box semantics; use `heart-bag`/wishlist concept. Gift icon reads “gift”, not “things I want to buy”.
6. Insights icon should be bars/trend, not generic analytics if it becomes insight-first.

### Accessibility
Every icon-only button needs `aria-label`. Decorative category SVGs should be `aria-hidden="true"` because category text is already present.

---

## 5. Component specifications

### Budget status row
```html
<div class="budget-row" data-status="warning|over|normal">
  <div class="category-icon">...</div>
  <div class="budget-row__body">
    <div class="budget-row__top">
      <span class="budget-row__title">一般用餐</span>
      <span class="budget-row__money money">9,960 / 10,960</span>
    </div>
    <div class="budget-progress" aria-label="已使用 91%">...</div>
    <div class="budget-row__meta">已用 91% · 還剩 NT$1,000</div>
  </div>
</div>
```
Do not render status with color only.

### Quick add
- Horizontal scroll is acceptable.
- Card min-width ~132px.
- Icon 36–40px tile, title + amount.
- Fixed amount tap records immediately; preserve existing undo behavior.
- Avoid more than one line title; ellipsis if necessary.

### FAB
Current square-ish pink FAB is visually strong but slightly Material-like. Refine to 56x56 circle or 64x52 rounded rectangle. For first-use / wider screens, label `＋ 記一筆`; otherwise icon-only is fine. Must not cover critical row content.

### Bottom navigation
- Keep four destinations: 今天 / 明細 / 想買 / 看懂.
- Active state: soft accent capsule behind icon only; text boldens slightly.
- Bottom safe-area respected.
- No fifth Settings tab.

---

## 6. Screen-by-screen implementation order

### Phase A — no data model changes
1. Install design tokens.
2. Replace icon rendering with SVG system.
3. Normalize typography, radii, shadows, spacing.
4. Refine bottom nav + FAB.
5. Refine Home Hero and attention rows.
6. Split budget progress into attention / other.
7. Refine fixed recurring and transaction rows.
8. Refine wishlist hierarchy.
9. Refine annual projection presentation.

### Phase B — view-model cleanup
Create render view-models without changing persisted data:
```js
const homeVM = {
  todaySpendable,
  todaySpent,
  periodRemaining,
  daysRemaining,
  savedBalance,
  quickEntries,
  attentionCategories,
  upcomingRecurring,
  recentTransactions
};
```
Keep calculation functions separate from DOM generation.

### Phase C — Insights
Transform `看懂` ordering to insight-first. Reuse existing calculations; do not invent AI summaries in this phase.

---

## 7. Acceptance criteria

- [ ] No primary UI emoji icons.
- [ ] All SVG icons use the same 24px / 1.75 stroke system.
- [ ] Every money figure uses tabular numerals.
- [ ] Hero `todaySpendable` is visually dominant.
- [ ] Warning/over-budget states remain understandable in grayscale.
- [ ] Budget categories with >=85% or over 100% appear in “需要注意”.
- [ ] Wishlist uses waiting/impact language rather than exposing score as primary UI.
- [ ] Bottom nav remains 4 items and safe-area compatible.
- [ ] FAB does not cover tappable content at 320px width.
- [ ] Touch targets >=44x44 CSS px.
- [ ] Existing quick-add undo, installments, recurring entries, refunds, budget borrowing, savings and import/export behavior are regression-tested.
- [ ] Light and dark mode both remain readable.
- [ ] PWA offline behavior unchanged.

---

## 8. Claude Code execution prompt

Copy the following into Claude Code together with this package:

```text
You are implementing a UI/UX refinement for Quota Ledger.
Read IMPLEMENTATION_REPORT.md and assets/icons/README.md first.
Inspect the current index.html before editing.

Hard constraints:
1. Preserve all existing financial/business logic and localStorage data schema unless the spec explicitly requires otherwise.
2. Do not migrate frameworks. Keep the current PWA architecture.
3. Apply the changes incrementally in the Phase A order.
4. Use the supplied SVG icon assets; do not replace them with emoji or an unrelated icon library.
5. Preserve all existing functional flows: quick add + undo, recurring income/expense, installments, refund, over-budget handling, savings balance, wishlist, import/export/restore, dark mode, and offline PWA behavior.
6. Add aria-labels for icon-only buttons and ensure status is not color-only.
7. After each major screen, verify at 320px, 390px, and 480px widths.
8. Do not introduce new product features in this pass.

Before changing code, summarize which existing selectors/render functions map to each spec section. Then implement. At the end, provide a concise regression checklist and list any spec item you intentionally could not implement.
```

---

## 9. Product design principle

> 不讓使用者害怕花錢，而是讓使用者知道「這筆錢現在適不適合花」。

Every UI decision should support one of these questions:
- 我現在可以花多少？
- 哪裡需要注意？
- 這筆錢會影響什麼？
- 我是否仍然想買？
