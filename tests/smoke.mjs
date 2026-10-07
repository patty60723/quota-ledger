// 慢慢花手帳 smoke tests: open the app with a made-up ledger (fixture.json), walk through the key flows,
// and fail loudly if a number is off or the page throws. Run before every release:
//   cd tests && npm install && npx playwright install chromium && npm test
// The date is pinned to 2026-09-15 so the numbers below never drift.
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(await readFile(join(ROOT, "tests", "fixture.json"), "utf8")).data;
const NOW = new Date("2026-09-15T12:00:00").getTime();
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

// a tiny static server for the repo root
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try{ const body = await readFile(join(ROOT, path === "/" ? "index.html" : path)); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch{ res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];

// a fresh page with the fixture loaded and the clock pinned
async function openApp({ width = 390, theme, data = FIXTURE, tab = "home" } = {}){
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(T => { const D = Date; class F extends D{ constructor(...a){ super(...(a.length ? a : [T])); } static now(){ return T; } } globalThis.Date = F; }, NOW);
  const d = structuredClone(data); if(theme) d.settings.theme = theme;
  await ctx.addInitScript(([x, t]) => { try{ if(!sessionStorage.seeded){ localStorage.setItem("ledger.v1", x); localStorage.setItem("ledger.tab", t); sessionStorage.seeded = 1; } }catch(e){} }, [JSON.stringify(d), tab]);
  const page = await ctx.newPage(); page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.goto(`${BASE}/index.html`); await page.waitForTimeout(500);
  return page;
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("ledger.v1")));
const text = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, " ").trim());
async function budgetRow(page, name){
  await page.click('[data-tab="report"]'); await page.click('[data-rseg="budget"]'); await page.waitForTimeout(150);
  return page.$$eval(".bc", (l, n) => (l.find(e => (e.querySelector(".n .t") || e.querySelector(".n"))?.innerText.trim() === n) || {}).innerText?.replace(/\s+/g, " ") || "", name);
}
function ok(cond, msg){ if(!cond) throw new Error(msg); }

async function test(name, fn){
  let page;
  try{ page = await fn(); if(page && page.errors.length) throw new Error("頁面錯誤：" + page.errors.join(" / ")); results.push([true, name]); }
  catch(e){ results.push([false, name, e.message.split("\n")[0]]); }
  finally{ if(page) await page.context().close(); }
}

await test("開啟：四個分頁都能顯示，沒有錯誤", async () => {
  const p = await openApp();
  ok(await p.$(".hero"), "首頁沒有「今天可以花」");
  for(const t of ["home", "list", "wish", "report"]){ await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(100); }
  return p;
});

await test("預算進度：餐飲 2,000 / 6,000，娛樂超支 500", async () => {
  const p = await openApp();
  const food = await budgetRow(p, "餐飲"), fun = await budgetRow(p, "娛樂");
  ok(/2,000 \/ 6,000/.test(food), `餐飲顯示「${food}」`);
  ok(/超出 NT\$500/.test(fun), `娛樂顯示「${fun}」`);
  return p;
});

await test("記一筆：餐飲 100 存檔後變成 2,100", async () => {
  const p = await openApp();
  await p.click("#fab"); await p.fill("#e-amt", "100"); await p.click('.sheet [data-cat="c-food"]'); await p.click(".sheet [data-save]"); await p.waitForTimeout(200);
  const s = await stored(p); ok(s.months["2026-09"].some(t => t.amount === 100 && t.categoryId === "c-food"), "紀錄沒有存進去");
  const food = await budgetRow(p, "餐飲"); ok(/2,100 \/ 6,000/.test(food), `餐飲顯示「${food}」`);
  return p;
});

await test("分期：3,000 分 3 期，明細出現「分期 1/3」", async () => {
  const p = await openApp();
  await p.click("#fab"); await p.fill("#e-amt", "3000"); await p.fill("#e-title", "課程").catch(() => {});
  await p.click('.sheet [data-cat="c-med"]'); await p.check("#e-inst"); await p.waitForTimeout(100); await p.fill("#e-n", "3");
  await p.click(".sheet [data-save]"); await p.waitForTimeout(200);
  const s = await stored(p); const inst = Object.values(s.installments)[0];
  ok(inst && inst.n === 3 && inst.total === 3000, "分期沒有建立");
  await p.click('[data-tab="list"]'); await p.waitForTimeout(150);
  ok((await p.content()).includes("分期 1/3"), "明細沒有分期的第 1 期");
  return p;
});

await test("超支：娛樂跟餐飲借 500 後不再超支", async () => {
  const p = await openApp();
  await budgetRow(p, "娛樂");
  await p.$eval('[data-overcat="c-fun"]', e => e.click()); await p.waitForTimeout(200);   // the ＋ button can sit on top of it
  await p.selectOption("#o-cat", "c-food"); await p.click('.sheet [data-o="cat"]'); await p.waitForTimeout(200);
  ok(/餐飲 本期還剩/.test(await text(p, ".sheet")), "沒有顯示重新分配的結果");
  await p.click(".sheet [data-x]"); await p.waitForTimeout(150);
  const s = await stored(p); ok(Object.values(s.adjustments).some(a => a.kind === "borrow-cat"), "沒有借用紀錄");
  const fun = await budgetRow(p, "娛樂"); ok(!/超出/.test(fun), `娛樂還是「${fun}」`);
  return p;
});

await test("想買：不買了 → 省下 3,000，按復原放回清單", async () => {
  const p = await openApp({ tab: "wish" });
  await p.click('[data-wishdrop="w1"]'); await p.waitForTimeout(150);
  ok(/省下 NT\$3,000/.test(await text(p, "#toastHost")), "提示沒有省下的金額");
  ok((await stored(p)).wishes.w1.droppedOn === "2026-09-15", "沒有記下不買的日期");
  await p.click(".toastbtn"); await p.waitForTimeout(150);
  ok(!(await stored(p)).wishes.w1.droppedOn, "復原後還是不買");
  return p;
});

await test("備份：下載的檔案可以還原回同樣的資料", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="data"]'); await p.waitForTimeout(150);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-act="export"]')]);
  const file = join(await mkdtemp(join(tmpdir(), "mmh-")), "backup.json"); await dl.saveAs(file);
  const bk = JSON.parse(await readFile(file, "utf8"));
  ok(bk.app === "慢慢花手帳" && bk.data.months["2026-09"].length === 7, "備份內容不對");
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("ledger.v1")); s.months["2026-09"] = []; localStorage.setItem("ledger.v1", JSON.stringify(s)); });
  await p.setInputFiles("#f-json", file); await p.waitForTimeout(300);
  ok((await stored(p)).months["2026-09"].length === 7, "還原後筆數不對");
  return p;
});

await test("匯出 CSV：每筆一列，支出是負數，分期列出每一期", async () => {
  const d = structuredClone(FIXTURE);
  d.installments = { i1: { id: "i1", title: "課程", categoryId: "c-med", total: 3000, n: 3, per: 1000, first: 1000, date: "2026-09-10", startPeriod: "2026-09", status: "active", createdAt: 1 } };
  const p = await openApp({ data: d });
  await p.click('[data-act="more"]'); await p.click('[data-m="data"]'); await p.waitForTimeout(150);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-act="export-csv"]')]);
  const file = join(await mkdtemp(join(tmpdir(), "mmh-")), "x.csv"); await dl.saveAs(file);
  const lines = (await readFile(file, "utf8")).replace(/^\ufeff/, "").split("\r\n");
  ok(lines[0].startsWith("日期,收支,類別,名稱,金額"), "標題列不對");
  ok(lines.length === 1 + 7 + 3, `應有 10 筆，實際 ${lines.length - 1} 筆`);
  ok(lines.includes("2026-09-12,支出,娛樂,演唱會,-2500,想要,,,"), "演唱會那一列不對");
  ok(lines.some(l => l.startsWith("2026-09-10,支出,醫療,課程,-1000,") && l.includes("分期 1/3")), "分期第 1 期不對");
  return p;
});

await test("月曆：點 9/3 後「記一筆 9/3 的帳」會帶入日期", async () => {
  const p = await openApp({ tab: "list" });
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e => e.innerText.trim() === "月曆")?.click()); await p.waitForTimeout(100);
  await p.click('[data-calday="2026-09-03"]'); await p.click('[data-act="cal-add"]'); await p.waitForTimeout(150);
  ok(await p.$eval("#e-date", e => e.value) === "2026-09-03", "日期沒有帶入");
  return p;
});

await test("返回鍵：關掉彈出畫面 → 離開設定 → 回到今天", async () => {
  const p = await openApp();
  const where = () => p.evaluate(() => ({ sheet: !!document.getElementById("scrim"), tab: document.querySelector("[data-tab][aria-current]")?.dataset.tab || "settings" }));
  const back = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(200); };
  await p.click('[data-act="more"]'); await p.click('[data-m="budget"]'); await p.waitForTimeout(150);
  await p.click("[data-cat]"); await p.waitForTimeout(150);
  await back(); let w = await where(); ok(!w.sheet && w.tab === "settings", `第 1 次返回後：${JSON.stringify(w)}`);
  await p.mouse.click(5, 300); await p.waitForTimeout(100);
  await back(); w = await where(); ok(w.tab === "home", `第 2 次返回後：${JSON.stringify(w)}`);
  return p;
});

await test("固定收支：只有待確認是黃色標籤，其他狀態是灰色小字", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="fixed"]'); await p.waitForTimeout(150);
  const rows = await p.$$eval("[data-rec]", l => Object.fromEntries(l.map(e => [e.querySelector(".t").innerText,
    { badge: e.querySelector(".tag")?.innerText || "", quiet: e.querySelector(".recst")?.innerText || "", tick: !!e.querySelector(".recst svg"), sub: e.querySelector(".sub").innerText }])));
  // only things that need doing get a yellow badge
  for(const name of ["電信", "水費"]) ok(rows[name].badge === "待確認" && !rows[name].quiet, `${name}：${JSON.stringify(rows[name])}`);
  // the rest are quiet text in the second line, no badge
  const quiet = { "房租": "本月已確認", "薪水": "本月已確認", "健身房": "本月略過", "保險": "9/20 到期", "串流平台": "10 月開始" };
  for(const [name, v] of Object.entries(quiet)) ok(!rows[name].badge && rows[name].quiet === v, `${name}：預期小字「${v}」，實際 ${JSON.stringify(rows[name])}`);
  ok(rows["房租"].tick && rows["薪水"].tick && !rows["健身房"].tick, "只有「本月已確認」該有 ✓");
  ok(!rows["舊健保補充"].badge && !rows["舊健保補充"].quiet && /已關閉/.test(rows["舊健保補充"].sub), `已關閉：${JSON.stringify(rows["舊健保補充"])}`);
  return p;
});

await test("固定收支：上方提示的筆數跟待確認的項目一致，點了回首頁", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="fixed"]'); await p.waitForTimeout(150);
  const tagged = await p.$$eval("[data-rec] .tag.warn", l => l.length);
  ok(/有 2 筆固定收支待確認/.test(await text(p, ".recgo")) && tagged === 2, `提示是「${await text(p, ".recgo")}」，待確認標籤 ${tagged} 個`);
  await p.click(".recgo"); await p.waitForTimeout(150);
  ok(await p.$eval("[data-tab][aria-current]", e => e.dataset.tab) === "home", "沒有回到首頁");
  ok(await p.$$eval("[data-confirm]", l => l.length) === 2, "首頁可以確認的筆數不是 2");
  return p;
});

await test("固定收支：點列表是編輯，不會直接確認", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="fixed"]'); await p.waitForTimeout(150);
  await p.click('[data-rec="r-phone"]'); await p.waitForTimeout(150);
  ok(/編輯固定收支/.test(await text(p, ".sheet h2")), "點了沒有打開編輯");
  ok(!(await stored(p)).runs["r-phone_2026-09"], "點列表就被確認了");
  return p;
});

await test("固定收支：在首頁確認後，列表改成已確認、提示筆數減少", async () => {
  const p = await openApp();
  await p.click('[data-confirm="r-phone_2026-09"]'); await p.waitForTimeout(200);
  ok((await stored(p)).runs["r-phone_2026-09"]?.status === "confirmed", "首頁確認沒有記下來");
  await p.click('[data-act="more"]'); await p.click('[data-m="fixed"]'); await p.waitForTimeout(150);
  const st = await p.$eval('[data-rec="r-phone"]', e => [e.querySelector(".tag")?.innerText || "", e.querySelector(".recst")?.innerText || ""]);
  ok(!st[0] && st[1] === "本月已確認", `電信顯示 ${JSON.stringify(st)}`);
  ok(/有 1 筆固定收支待確認/.test(await text(p, ".recgo")), `提示是「${await text(p, ".recgo")}」`);
  return p;
});

await test("固定收支：全部處理完，上方提示消失", async () => {
  const d = structuredClone(FIXTURE);
  d.runs["r-phone_2026-09"] = { status: "confirmed", at: 1 }; d.runs["r-water_2026-08"] = { status: "skipped", at: 1 };
  const p = await openApp({ data: d });
  await p.click('[data-act="more"]'); await p.click('[data-m="fixed"]'); await p.waitForTimeout(150);
  ok(!(await p.$(".recgo")), "沒有待確認卻還有提示");
  ok(await p.$eval('[data-rec="r-water"] .recst', e => e.innerText) === "9/25 到期", "水費處理完上個月後，應該顯示本月到期日");
  return p;
});

await test("導覽：每一步都能跟著走完，亮的是對的東西，點亮處以外沒反應，不會改到資料", async () => {
  const p = await openApp();
  const before = JSON.stringify((await stored(p)).months);
  await p.click('[data-act="more"]'); await p.click('[data-m="prefs"]'); await p.click('[data-act="tour"]'); await p.waitForTimeout(400);
  const spot = () => p.evaluate(() => { const t = document.querySelector(".tour"); if(!t) return null; if(t.classList.contains("tend")) return { end: true };
    const r = document.querySelector(".tring").getBoundingClientRect();
    return { ch: document.querySelector(".tch").innerText, text: document.querySelector(".ttx").innerText, ack: t.classList.contains("tack"), miss: t.classList.contains("tmiss"), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const chapters = new Set(); let steps = 0, acks = 0;
  for(let k = 0; k < 60; k++){
    await p.waitForTimeout(120);   // let the ring move to the new spot before reading where it is
    const s = await spot(); ok(s, "導覽中途消失");
    if(s.end) break;
    if(s.miss){ await p.waitForTimeout(300); continue; }
    chapters.add(s.ch); steps++; if(process.env.TOURDBG) console.log("   ", steps, s.ack ? "ack" : "tap", s.text.slice(0, 24));
    if(steps === 3){ await p.mouse.click(20, 140); await p.waitForTimeout(150); ok((await spot()).text === s.text, "點亮處以外也前進了"); }
    const named = !s.ack && s.text.replace(/<[^>]+>/g, "").match(/點「(.+?)」/);   // a step that says 點「X」 must light a button that reads X
    if(named){
      const label = await p.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.closest("button") || {}).innerText || "", [s.x, s.y]);
      ok(label.replace(/\s+/g, "").includes(named[1]), `說「點「${named[1]}」」，亮的卻是「${label.trim()}」`);
    }
    if(/點「預算進度」/.test(s.text)){   // the ring must be on the 預算進度 switch itself, not a row that also links there
      const hit = await p.evaluate(([x, y]) => { const e = document.querySelector('.rseg [data-rseg="budget"]').getBoundingClientRect(); return x > e.left && x < e.right && y > e.top && y < e.bottom; }, [s.x, s.y]);
      ok(hit, "「預算進度」那一步亮錯地方");
    }
    if(s.ack) ok(!/選一個|點一個|點「|先輸入/.test(s.text), `說明步驟叫人去點，卻點不到：${s.text}`);   // text that asks for a tap must be a tap step
    if(/類別試試/.test(s.text)){   // the category step really lets a chip be picked
      const picked = await p.evaluate(() => { const c = [...document.querySelectorAll('.sheet .chips .chip[aria-pressed="false"]')].pop(); if(!c) return null; const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, c.dataset.cat]; });
      ok(picked, "找不到可以選的類別"); await p.mouse.click(picked[0], picked[1]); await p.waitForTimeout(450);
      ok(await p.$eval(`.sheet .chip[data-cat="${picked[2]}"]`, e => e.getAttribute("aria-pressed")) === "true", "導覽中點類別沒有選到"); continue;
    }
    if(s.ack){ acks++; await p.mouse.click(s.x, s.y); await p.waitForTimeout(150); ok((await spot()).text === s.text, `說明步驟點亮處就前進了：${s.text}`); await p.click(".tok button"); }
    else await p.mouse.click(s.x, s.y);
    await p.waitForTimeout(450);
    if(/點計算機/.test(s.text)) ok(await p.$(".sheet .calc"), "導覽中點計算機沒有打開");
  }
  ok([...chapters].join() === "今天可以花,記一筆,其他功能", `段落：${[...chapters].join()}`);
  ok(steps === 9 && acks === 4, `走了 ${steps} 步（${acks} 步是「知道了」）`);
  ok(JSON.stringify((await stored(p)).months) === before, "導覽改到了資料");
  await p.click('[data-tg="go"]'); await p.waitForTimeout(200);
  ok(!(await p.$(".tour")) && await p.$eval("[data-tab][aria-current]", e => e.dataset.tab) === "home", "結束後沒有回到首頁");
  return p;
});

await test("導覽：途中按返回鍵就結束導覽，不會卡在暗掉的畫面", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="prefs"]'); await p.click('[data-act="tour"]'); await p.waitForTimeout(400);
  const ring = async () => p.evaluate(() => { const r = document.querySelector(".tring").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.click(".tok button").catch(() => {});                       // step 1 may be 知道了 or a tap
  for(let k = 0; k < 3 && !(await p.$(".sheet")); k++){ await p.waitForTimeout(200); if(await p.$(".tour.tack")) await p.click(".tok button"); else { const [x, y] = await ring(); await p.mouse.click(x, y); } await p.waitForTimeout(500); }
  ok(await p.$(".sheet"), "沒有走到記帳畫面那一步");
  await p.evaluate(() => history.back()); await p.waitForTimeout(400);
  ok(!(await p.$(".tour")) && !(await p.$(".sheet")), "按返回後導覽或記帳畫面還在");
  return p;
});

await test("導覽：可以隨時跳過", async () => {
  const p = await openApp();
  await p.click('[data-act="more"]'); await p.click('[data-m="prefs"]'); await p.click('[data-act="tour"]'); await p.waitForTimeout(400);
  await p.click(".tskip"); await p.waitForTimeout(200);
  ok(!(await p.$(".tour")), "跳過後導覽還在");
  return p;
});

// tips: shown once, the first time someone opens a screen on their own
const NEW_USER = (() => { const d = structuredClone(FIXTURE); d.settings.tips = {}; return d; })();
const tipText = p => p.evaluate(() => document.querySelector(".tour.ttip .ttx")?.innerText || "");
const okTip = async p => { await p.click(".tour.ttip .tok button"); await p.waitForTimeout(200); };

await test("提示：新使用者第一次打開各頁都會出現一次，看過就不再出現", async () => {
  const p = await openApp({ data: NEW_USER });
  const seen = [];
  await p.click("#fab"); await p.waitForTimeout(600);
  ok(/必要、需要或想要/.test(await tipText(p)), "第一次記帳沒有提示"); await okTip(p);
  ok(/分期／分攤/.test(await tipText(p)), "記帳提示沒有第二步"); await okTip(p); seen.push("記帳");
  await p.click(".sheet [data-x]"); await p.waitForTimeout(300);
  for(const [tabName, re] of [["list", /月曆/], ["wish", /冷靜 7 天/], ["report", /預算進度/]]){
    await p.click(`#tabs [data-tab="${tabName}"]`); await p.waitForTimeout(600);
    ok(re.test(await tipText(p)), `第一次打開 ${tabName} 沒有提示`); await okTip(p); seen.push(tabName);
  }
  await p.click('[data-act="more"]'); await p.click('[data-m="budget"]'); await p.waitForTimeout(300); await p.click('[data-bseg="save"]'); await p.waitForTimeout(600);
  ok(/存錢罐/.test(await tipText(p)), "第一次看儲蓄沒有提示"); await okTip(p);
  await p.click('[data-act="back"]'); await p.click('[data-act="more"]'); await p.click('[data-m="data"]'); await p.waitForTimeout(600);
  ok(/備份/.test(await tipText(p)), "第一次看資料與備份沒有提示"); await okTip(p);
  ok(Object.keys((await stored(p)).settings.tips).length === 6, "看過的提示沒有全部記下來");
  await p.click('[data-act="back"]'); await p.waitForTimeout(200);
  for(const tabName of ["list", "wish", "report"]){ await p.click(`#tabs [data-tab="${tabName}"]`); await p.waitForTimeout(600); ok(!(await p.$(".tour")), `${tabName} 第二次打開又出現提示`); }
  return p;
});

await test("提示：按「不再顯示提示」之後，其他頁也不會再出現", async () => {
  const p = await openApp({ data: NEW_USER });
  await p.click('#tabs [data-tab="list"]'); await p.waitForTimeout(600);
  await p.click(".tour.ttip .tskip"); await p.waitForTimeout(200);
  ok((await stored(p)).settings.tipsOff === true, "沒有記下不再顯示");
  await p.click('#tabs [data-tab="wish"]'); await p.waitForTimeout(600);
  ok(!(await p.$(".tour")), "關掉後還是出現提示");
  return p;
});

await test("提示：已經在用的人（沒有提示紀錄）不會突然跳出提示", async () => {
  const p = await openApp();
  for(const tabName of ["list", "wish", "report"]){ await p.click(`#tabs [data-tab="${tabName}"]`); await p.waitForTimeout(600); ok(!(await p.$(".tour")), `${tabName} 跳出提示`); }
  await p.click("#fab"); await p.waitForTimeout(600); ok(!(await p.$(".tour")), "記帳畫面跳出提示");
  ok(!(await stored(p)).settings.tips, "沒看提示卻寫入了提示紀錄");
  return p;
});

await test("設定的五個頁面都能打開", async () => {
  const p = await openApp();
  for(const m of ["budget", "fixed", "fav", "prefs", "data"]){
    await p.click('[data-act="more"]').catch(async () => { await p.click('[data-act="back"]'); await p.click('[data-act="more"]'); });
    await p.click(`[data-m="${m}"]`); await p.waitForTimeout(100);
    if(m === "budget"){ await p.click('[data-bseg="save"]'); }
    if(m === "fixed"){ await p.click('[data-fseg="inst"]'); }
    await p.click('[data-act="back"]'); await p.waitForTimeout(100);
  }
  return p;
});

await test("深色模式、320 寬度：各分頁沒有錯誤", async () => {
  const p = await openApp({ width: 320, theme: "dark" });
  for(const t of ["home", "list", "wish", "report"]){ await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(100); }
  return p;
});

await browser.close(); server.close();
const failed = results.filter(r => !r[0]);
for(const [pass, name, why] of results) console.log(`${pass ? "✓" : "✗"} ${name}${why ? `\n    ${why}` : ""}`);
console.log(`\n${results.length - failed.length} / ${results.length} 通過`);
process.exit(failed.length ? 1 : 0);
