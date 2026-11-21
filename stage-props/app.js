'use strict';
/* 舞台道具排列 — 純前端，資料存在瀏覽器 localStorage，可備份/還原 JSON */
const KEY = 'stage-props-v1';
const SRC = {
  theatre: { label: '劇場提供', color: '#3b82f6' },
  personal: { label: '個人提供', color: '#f59e0b' },
  actor: { label: '演員', color: '#10b981' },
};
const FONT = "system-ui,'Noto Sans TC','Microsoft JhengHei',sans-serif";
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 1) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : d; };
const r2 = n => Math.round(n * 100) / 100;

function seed() {
  const st = uid();
  return {
    currentEventId: null,
    stages: [{ id: st, name: '示範舞台', w: 8, d: 6, notes: '' }],
    props: [
      { id: uid(), name: '椅子', source: 'theatre', owner: '', w: 0.45, d: 0.45, notes: '' },
      { id: uid(), name: '小圓桌', source: 'theatre', owner: '', w: 0.8, d: 0.8, notes: '' },
      { id: uid(), name: '譜架', source: 'personal', owner: '小明', w: 0.5, d: 0.4, notes: '' },
      { id: uid(), name: '小明', source: 'actor', owner: '小明', w: 0.5, d: 0.5, notes: '' },
    ],
    events: [],
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { S = seed(); }
const ui = { tab: 'editor', sel: null, q: '', src: 'all', editProp: null, editStage: null, filter: '__all', group: false };

function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
const stageOf = id => S.stages.find(s => s.id === id);
const propOf = id => S.props.find(p => p.id === id);
const curEvent = () => S.events.find(e => e.id === S.currentEventId) || null;
const ownerKey = p => p.source === 'theatre' ? '劇場' : (p.owner || '（未指定）');
const fmtEv = e => `${e.date || '未定日期'}｜${e.name}｜${stageOf(e.stageId)?.name || '?'}`;

/* ---------- stage SVG（單位：公尺） ---------- */
function stageSVG(ev, opt = {}) {
  const st = stageOf(ev.stageId); if (!st) return '';
  const { w, d } = st, m = 0.6, top = 0.9, bot = 1.1;
  const fs = Math.max(w, d) * 0.025;
  let g = '';
  for (let i = 1; i < w; i++) g += `<line x1="${i}" y1="0" x2="${i}" y2="${d}" stroke="#e5e7eb" stroke-width="${fs * 0.08}"/>`;
  for (let j = 1; j < d; j++) g += `<line x1="0" y1="${j}" x2="${w}" y2="${j}" stroke="#e5e7eb" stroke-width="${fs * 0.08}"/>`;
  g += `<line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${d}" stroke="#9ca3af" stroke-width="${fs * 0.1}" stroke-dasharray="${fs * .5} ${fs * .4}"/>`;
  g += `<rect x="0" y="0" width="${w}" height="${d}" fill="none" stroke="#374151" stroke-width="${fs * 0.2}"/>`;
  g += `<text x="0" y="${-fs * 0.8}" font-size="${fs * 1.1}" font-weight="600" fill="#111827">${esc(ev.name)}　${esc(ev.date || '')}</text>`;
  g += `<text x="${w}" y="${-fs * 0.8}" font-size="${fs}" fill="#6b7280" text-anchor="end">${esc(st.name)} ${w}×${d} m（後台）</text>`;
  g += `<text x="${w / 2}" y="${d + fs * 2.4}" font-size="${fs * 1.1}" fill="#6b7280" text-anchor="middle">▼ 觀眾席</text>`;
  for (const pl of ev.placements) {
    const p = propOf(pl.propId); if (!p) continue;
    const c = SRC[p.source].color;
    const dim = opt.owner && opt.owner !== ownerKey(p);
    const sel = opt.interactive && ui.sel === pl.id;
    const shape = p.source === 'actor'
      ? `<ellipse rx="${p.w / 2}" ry="${p.d / 2}" fill="${c}" fill-opacity=".3" stroke="${c}" stroke-width="${fs * (sel ? .3 : .15)}"${sel ? ` stroke-dasharray="${fs * .4} ${fs * .3}"` : ''}/>`
      : `<rect x="${-p.w / 2}" y="${-p.d / 2}" width="${p.w}" height="${p.d}" rx="${fs * .15}" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="${fs * (sel ? .3 : .15)}"${sel ? ` stroke-dasharray="${fs * .4} ${fs * .3}"` : ''}/>`;
    const maxc = Math.max(2, Math.floor(Math.max(p.w, p.d) / fs)) ;
    const nm = p.name.length > maxc ? p.name.slice(0, maxc - 1) + '…' : p.name;
    const ow = p.source !== 'theatre' && p.owner && p.owner !== p.name ? p.owner : '';
    const ot = ow ? (ow.length > maxc ? ow.slice(0, maxc - 1) + '…' : ow) : '';
    const text = `<g transform="translate(${pl.x} ${pl.y})" pointer-events="none"><text text-anchor="middle" font-size="${fs}" fill="#111827" y="${ot ? -fs * .1 : fs * .35}">${esc(nm)}</text>${ot ? `<text text-anchor="middle" font-size="${fs * .8}" fill="#4b5563" y="${fs * .95}">${esc(ot)}</text>` : ''}</g>`;
    g += `<g opacity="${dim ? .15 : 1}"><g class="g" data-pid="${pl.id}" transform="translate(${pl.x} ${pl.y}) rotate(${pl.rot || 0})"><title>${esc(p.name)}</title>${shape}</g>${text}</g>`;
  }
  const vb = [-m, -top - fs, w + 2 * m, d + top + fs + bot];
  const size = opt.px ? ` width="${opt.px}" height="${Math.round(opt.px * vb[3] / vb[2])}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"${size} font-family="${FONT}"><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#fff"/>${g}</svg>`;
}

/* ---------- 版面 ---------- */
function renderHeader() {
  const sel = document.getElementById('eventSelect');
  sel.innerHTML = S.events.length
    ? S.events.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => `<option value="${e.id}"${e.id === S.currentEventId ? ' selected' : ''}>${esc(fmtEv(e))}</option>`).join('')
    : '<option>（尚無事件，請按「＋ 新事件」）</option>';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
}
function render() {
  if (!curEvent() && S.events.length) S.currentEventId = S.events[0].id;
  renderHeader();
  const m = document.getElementById('main');
  m.innerHTML = ({ editor: renderEditor, props: renderProps, stages: renderStages, output: renderOutput })[ui.tab]();
  if (ui.tab === 'editor') { bindStage(); renderPropList(); }
}

/* ---------- 排列舞台 ---------- */
function renderEditor() {
  const ev = curEvent();
  if (!ev) return `<div class="card empty">還沒有事件。<br>一個「事件」＝一個呈現日期＋一個舞台，之後有新的演出日期或場地，再新增就好。<br><br><button class="primary" data-act="ev-new">＋ 新事件</button></div>`;
  return `<div class="editor">
  <div>
    <div class="card"><h3>道具庫</h3>
      <input id="q" placeholder="搜尋道具／人名" value="${esc(ui.q)}" style="width:100%">
      <div class="chips" id="srcChips"></div>
      <div class="plist" id="plist"></div>
      <div class="muted" style="margin-top:6px">點「＋」放到舞台；同一道具可放多次，也可在多個事件重複使用。找不到？到「道具庫」新增。</div>
    </div>
    <div class="card" id="selPanel"></div>
  </div>
  <div class="card stagewrap"><div id="stageBox"></div>
    <div class="legend">${Object.entries(SRC).map(([k, v]) => `<span><span class="dot ${k}"></span>${v.label}</span>`).join('')}<span class="muted">拖曳移動；選取後可用方向鍵微調、Delete 刪除</span></div>
  </div></div>`;
}
function renderPropList() {
  const chips = document.getElementById('srcChips'); if (!chips) return;
  chips.innerHTML = [['all', '全部'], ...Object.entries(SRC).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button data-src="${k}" class="${ui.src === k ? 'on' : ''}">${l}</button>`).join('');
  const q = ui.q.trim().toLowerCase();
  const list = S.props.filter(p => (ui.src === 'all' || p.source === ui.src) && (!q || (p.name + p.owner).toLowerCase().includes(q)));
  document.getElementById('plist').innerHTML = list.length ? list.map(p => `<div class="prow"><span class="dot ${p.source}"></span><div class="nm"><b>${esc(p.name)}</b><span class="muted">${esc(ownerKey(p))}・${p.w}×${p.d}m</span></div><button class="small" data-act="add-pl" data-id="${p.id}">＋</button></div>`).join('') : '<div class="muted">沒有符合的道具</div>';
}
function renderStageBox() {
  const ev = curEvent(); if (!ev) return;
  document.getElementById('stageBox').innerHTML = stageSVG(ev, { interactive: true });
  renderSelPanel();
}
function renderSelPanel() {
  const ev = curEvent(), el = document.getElementById('selPanel'); if (!el) return;
  const pl = ev.placements.find(x => x.id === ui.sel), p = pl && propOf(pl.propId);
  const counts = {}; ev.placements.forEach(x => counts[x.propId] = (counts[x.propId] || 0) + 1);
  const summary = `<div class="muted">舞台上共 ${ev.placements.length} 件（${Object.keys(counts).length} 種）</div>`;
  if (!pl || !p) { el.innerHTML = `<h3>選取的道具</h3><div class="muted">點選舞台上的道具來編輯。</div>${summary}`; return; }
  el.innerHTML = `<h3>${esc(p.name)} <span class="tag ${p.source}">${SRC[p.source].label}</span></h3>
  <div class="grid2">
    <label class="f">X（公尺，中心）<input type="number" step="0.05" data-pl="x" value="${r2(pl.x)}"></label>
    <label class="f">Y（由後台起算）<input type="number" step="0.05" data-pl="y" value="${r2(pl.y)}"></label>
    <label class="f">旋轉（度）<input type="number" step="15" data-pl="rot" value="${pl.rot || 0}"></label>
  </div>
  <div class="toolbar" style="margin-top:8px"><button class="small" data-act="pl-rot">↻ 90°</button><button class="small" data-act="pl-dup">複製一份</button><button class="small danger" data-act="pl-del">從舞台移除</button></div>${summary}`;
}
function bindStage() { renderStageBox(); }

let drag = null;
function svgPoint(svg, e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function clampPl(pl) { const st = stageOf(curEvent().stageId); pl.x = Math.min(st.w, Math.max(0, r2(pl.x))); pl.y = Math.min(st.d, Math.max(0, r2(pl.y))); }
document.addEventListener('pointerdown', e => {
  const g = e.target.closest?.('#stageBox .g'); if (!g) return;
  const ev = curEvent(), pl = ev.placements.find(x => x.id === g.dataset.pid); if (!pl) return;
  ui.sel = pl.id; renderStageBox();
  const g2 = document.querySelector(`#stageBox .g[data-pid="${pl.id}"]`), svg = g2.ownerSVGElement, pt = svgPoint(svg, e);
  drag = { pl, g: g2, svg, dx: pl.x - pt.x, dy: pl.y - pt.y, moved: false };
  svg.setPointerCapture?.(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const pt = svgPoint(drag.svg, e); drag.moved = true;
  drag.pl.x = pt.x + drag.dx; drag.pl.y = pt.y + drag.dy;
  let nx = Math.round(drag.pl.x * 20) / 20, ny = Math.round(drag.pl.y * 20) / 20; drag.pl.x = nx; drag.pl.y = ny; clampPl(drag.pl);
  drag.g.setAttribute('transform', `translate(${drag.pl.x} ${drag.pl.y}) rotate(${drag.pl.rot || 0})`);
});
document.addEventListener('pointerup', () => { if (!drag) return; const m = drag.moved; drag = null; if (m) { save(); renderStageBox(); } });
document.addEventListener('keydown', e => {
  if (ui.tab !== 'editor' || !ui.sel || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const ev = curEvent(), pl = ev?.placements.find(x => x.id === ui.sel); if (!pl) return;
  const step = e.shiftKey ? 0.25 : 0.05; let used = true;
  if (e.key === 'ArrowLeft') pl.x -= step; else if (e.key === 'ArrowRight') pl.x += step;
  else if (e.key === 'ArrowUp') pl.y -= step; else if (e.key === 'ArrowDown') pl.y += step;
  else if (e.key === 'Delete' || e.key === 'Backspace') { ev.placements = ev.placements.filter(x => x !== pl); ui.sel = null; }
  else used = false;
  if (used) { e.preventDefault(); if (ui.sel) clampPl(pl); save(); renderStageBox(); }
});

/* ---------- 道具庫 ---------- */
function renderProps() {
  const ep = S.props.find(p => p.id === ui.editProp) || { name: '', source: 'personal', owner: '', w: 0.5, d: 0.5, notes: '' };
  const owners = [...new Set(S.props.map(p => p.owner).filter(Boolean))];
  const usage = id => S.events.filter(e => e.placements.some(x => x.propId === id)).length;
  const groups = Object.keys(SRC).map(k => {
    const l = S.props.filter(p => p.source === k);
    return `<h3><span class="dot ${k}"></span>${SRC[k].label}（${l.length}）</h3>` + (l.length ? `<table><tr><th>名稱</th><th>提供者</th><th>尺寸 寬×深(m)</th><th>已用於</th><th></th></tr>${l.map(p => `<tr><td>${esc(p.name)}${p.notes ? `<div class="muted">${esc(p.notes)}</div>` : ''}</td><td>${esc(p.source === 'theatre' ? '劇場' : p.owner)}</td><td>${p.w}×${p.d}</td><td>${usage(p.id)} 個事件</td><td style="white-space:nowrap"><button class="small" data-act="edit-prop" data-id="${p.id}">編輯</button> <button class="small danger" data-act="del-prop" data-id="${p.id}">刪除</button></td></tr>`).join('')}</table>` : '<div class="muted">（無）</div>');
  }).join('');
  return `<div class="card"><h2>${ui.editProp ? '編輯道具' : '新增道具'}</h2>
  <form data-form="prop"><div class="grid2">
    <label class="f">名稱<input name="name" required value="${esc(ep.name)}" placeholder="例：椅子、吉他、阿花"></label>
    <label class="f">類別<select name="source">${Object.entries(SRC).map(([k, v]) => `<option value="${k}"${ep.source === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="f">提供者／演員姓名（劇場提供可留空）<input name="owner" list="owners" value="${esc(ep.owner)}"></label>
    <label class="f">寬（公尺，左右）<input name="w" type="number" step="0.05" min="0.05" value="${ep.w}"></label>
    <label class="f">深（公尺，前後）<input name="d" type="number" step="0.05" min="0.05" value="${ep.d}"></label>
    <label class="f">備註<input name="notes" value="${esc(ep.notes)}"></label>
  </div><datalist id="owners">${owners.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
  <div class="row-btn" style="margin-top:10px"><button class="primary">${ui.editProp ? '儲存' : '新增'}</button> ${ui.editProp ? '<button type="button" data-act="cancel-prop">取消</button>' : ''}</div></form></div>
  <div class="card"><h2>全部道具（可跨事件重複使用）</h2>${groups}</div>`;
}

/* ---------- 舞台規格 ---------- */
function renderStages() {
  const es = stageOf(ui.editStage) || { name: '', w: 8, d: 6, notes: '' };
  return `<div class="card"><h2>${ui.editStage ? '編輯舞台' : '新增舞台規格'}</h2>
  <form data-form="stage"><div class="grid2">
    <label class="f">場地／舞台名稱<input name="name" required value="${esc(es.name)}" placeholder="例：某某劇場 主舞台"></label>
    <label class="f">寬（公尺，左右）<input name="w" type="number" step="0.1" min="1" value="${es.w}"></label>
    <label class="f">深（公尺，前後）<input name="d" type="number" step="0.1" min="1" value="${es.d}"></label>
    <label class="f">備註<input name="notes" value="${esc(es.notes)}" placeholder="側台、樓梯、鋼琴位置…"></label>
  </div><div style="margin-top:10px"><button class="primary">${ui.editStage ? '儲存' : '新增'}</button> ${ui.editStage ? '<button type="button" data-act="cancel-stage">取消</button>' : ''}</div></form></div>
  <div class="card"><h2>已有的舞台</h2><table><tr><th>名稱</th><th>寬×深 (m)</th><th>備註</th><th>使用中</th><th></th></tr>${S.stages.map(s => `<tr><td>${esc(s.name)}</td><td>${s.w}×${s.d}</td><td>${esc(s.notes)}</td><td>${S.events.filter(e => e.stageId === s.id).length} 個事件</td><td style="white-space:nowrap"><button class="small" data-act="edit-stage" data-id="${s.id}">編輯</button> <button class="small danger" data-act="del-stage" data-id="${s.id}">刪除</button></td></tr>`).join('')}</table></div>`;
}

/* ---------- 輸出 ---------- */
function eventRows(ev, owner) {
  const map = new Map();
  for (const pl of ev.placements) {
    const p = propOf(pl.propId); if (!p) continue;
    if (owner && owner !== '__all' && ownerKey(p) !== owner) continue;
    const r = map.get(p.id) || { p, n: 0 }; r.n++; map.set(p.id, r);
  }
  const order = { theatre: 0, personal: 1, actor: 2 };
  return [...map.values()].sort((a, b) => order[a.p.source] - order[b.p.source] || ownerKey(a.p).localeCompare(ownerKey(b.p), 'zh-Hant') || a.p.name.localeCompare(b.p.name, 'zh-Hant'));
}
const tableHTML = rows => rows.length ? `<table><tr><th>道具</th><th>類別</th><th>提供者</th><th>尺寸 (m)</th><th>數量</th></tr>${rows.map(({ p, n }) => `<tr><td>${esc(p.name)}</td><td>${SRC[p.source].label}</td><td>${esc(ownerKey(p))}</td><td>${p.w}×${p.d}</td><td>${n}</td></tr>`).join('')}</table>` : '<div class="muted">（沒有道具）</div>';
function renderOutput() {
  const ev = curEvent();
  if (!ev) return '<div class="card empty">請先建立事件。</div>';
  const owners = [...new Set(ev.placements.map(x => propOf(x.propId)).filter(Boolean).map(ownerKey))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  if (ui.filter !== '__all' && !owners.includes(ui.filter)) ui.filter = '__all';
  const all = ui.filter === '__all';
  let body;
  if (all && ui.group) {
    body = owners.map((o, i) => `<div class="pg ${i ? 'pg-break' : ''}"><h2>${esc(o)} 的道具</h2>${tableHTML(eventRows(ev, o))}<div>${stageSVG(ev, { owner: o })}</div></div>`).join('') || '<div class="muted">（沒有道具）</div>';
  } else {
    body = `<div class="pg"><h2>${all ? '全部道具清單' : esc(ui.filter) + ' 的道具'}</h2>${tableHTML(eventRows(ev, ui.filter))}</div><div class="pg"><h2>舞台俯視圖</h2>${stageSVG(ev, all ? {} : { owner: ui.filter })}${all ? '' : '<div class="muted">淡色＝其他人的道具</div>'}</div>`;
  }
  return `<div class="card no-print"><div class="toolbar">
    <label>顯示：<select id="ownerSel"><option value="__all">全部人</option>${owners.map(o => `<option${o === ui.filter ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
    ${all ? `<label><input type="checkbox" id="groupChk"${ui.group ? ' checked' : ''}> 每人一頁</label>` : ''}
    <button class="primary" data-act="print">列印 / 存成 PDF</button>
    <button data-act="png">下載俯視圖 PNG</button>
    <button data-act="csv">下載清單 CSV</button></div></div>
  <div class="card sheet"><h1 style="margin:0 0 2px;font-size:20px">${esc(ev.name)}</h1><div class="muted">${esc(ev.date || '')}　${esc(stageOf(ev.stageId)?.name || '')} ${stageOf(ev.stageId)?.w}×${stageOf(ev.stageId)?.d} m</div>${body}</div>`;
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const fileBase = ev => `${ev.date || 'event'}_${ev.name}`.replace(/[\\/:*?"<>|\s]+/g, '_');
function exportPNG() {
  const ev = curEvent(), owner = ui.filter === '__all' ? null : ui.filter;
  const svg = stageSVG(ev, { owner, px: 1800 });
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
    c.toBlob(b => download(`${fileBase(ev)}_俯視圖${owner ? '_' + owner : ''}.png`, b));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function exportCSV() {
  const ev = curEvent(), rows = eventRows(ev, ui.filter);
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['道具', '類別', '提供者', '寬(m)', '深(m)', '數量', '備註'].map(q).join(',')]
    .concat(rows.map(({ p, n }) => [p.name, SRC[p.source].label, ownerKey(p), p.w, p.d, n, p.notes].map(q).join(',')));
  download(`${fileBase(ev)}_道具清單${ui.filter === '__all' ? '' : '_' + ui.filter}.csv`, new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
}

/* ---------- 對話框（事件） ---------- */
function eventDialog(mode) {
  const cur = curEvent();
  if (mode === 'edit' && !cur) return;
  const e = mode === 'edit' ? cur : { name: '', date: new Date().toISOString().slice(0, 10), stageId: S.stages[0]?.id };
  const dlg = document.getElementById('dlg');
  dlg.innerHTML = `<form method="dialog" id="evForm"><h3>${mode === 'edit' ? '編輯事件' : '新事件'}</h3>
  <label class="f">事件名稱<input name="name" required value="${esc(e.name)}" placeholder="例：期末發表會"></label><br>
  <label class="f">呈現日期<input name="date" type="date" required value="${esc(e.date)}"></label><br>
  <label class="f">舞台<select name="stage">${S.stages.map(s => `<option value="${s.id}"${s.id === e.stageId ? ' selected' : ''}>${esc(s.name)}（${s.w}×${s.d}m）</option>`).join('')}</select></label>
  <div class="muted">沒有適合的舞台？先到「舞台規格」新增。</div>
  <div class="row"><button type="button" onclick="dlg.close()">取消</button><button class="primary" value="ok">${mode === 'edit' ? '儲存' : '建立'}</button></div></form>`;
  dlg.showModal();
  document.getElementById('evForm').onsubmit = ev => {
    const f = new FormData(ev.target);
    if (mode === 'edit') { Object.assign(cur, { name: f.get('name'), date: f.get('date'), stageId: f.get('stage') }); }
    else { const n = { id: uid(), name: f.get('name'), date: f.get('date'), stageId: f.get('stage'), placements: [] }; S.events.push(n); S.currentEventId = n.id; ui.sel = null; }
    save(); render();
  };
}

/* ---------- 事件委派 ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-tab],[data-src]'); if (!t) return;
  if (t.dataset.tab) { ui.tab = t.dataset.tab; return render(); }
  if (t.dataset.src) { ui.src = t.dataset.src; return renderPropList(); }
  const ev = curEvent(), id = t.dataset.id;
  switch (t.dataset.act) {
    case 'ev-new': if (!S.stages.length) { alert('請先到「舞台規格」新增舞台'); ui.tab = 'stages'; return render(); } return eventDialog('new');
    case 'ev-edit': return eventDialog('edit');
    case 'ev-dup': if (!ev) return; { const n = JSON.parse(JSON.stringify(ev)); n.id = uid(); n.name += '（複製）'; n.placements.forEach(p => p.id = uid()); S.events.push(n); S.currentEventId = n.id; save(); return render(); }
    case 'ev-del': if (ev && confirm(`刪除事件「${ev.name}」？（道具庫不受影響）`)) { S.events = S.events.filter(x => x !== ev); S.currentEventId = S.events[0]?.id || null; ui.sel = null; save(); render(); } return;
    case 'add-pl': { const p = propOf(id), st = stageOf(ev.stageId); const n = ev.placements.length; const pl = { id: uid(), propId: id, x: r2(st.w / 2 + (n % 5 - 2) * 0.3), y: r2(st.d / 2 + (n % 5 - 2) * 0.3), rot: 0 }; ev.placements.push(pl); ui.sel = pl.id; save(); return renderStageBox(); }
    case 'pl-rot': { const pl = ev.placements.find(x => x.id === ui.sel); if (pl) { pl.rot = ((pl.rot || 0) + 90) % 360; save(); renderStageBox(); } return; }
    case 'pl-dup': { const pl = ev.placements.find(x => x.id === ui.sel); if (pl) { const n = { ...pl, id: uid(), x: pl.x + .3, y: pl.y + .3 }; clampPl(n); ev.placements.push(n); ui.sel = n.id; save(); renderStageBox(); } return; }
    case 'pl-del': ev.placements = ev.placements.filter(x => x.id !== ui.sel); ui.sel = null; save(); return renderStageBox();
    case 'edit-prop': ui.editProp = id; return render();
    case 'cancel-prop': ui.editProp = null; return render();
    case 'del-prop': { const used = S.events.filter(x => x.placements.some(p => p.propId === id)).length; if (confirm(`刪除道具「${propOf(id).name}」？` + (used ? `\n它會同時從 ${used} 個事件的舞台上移除。` : ''))) { S.props = S.props.filter(p => p.id !== id); S.events.forEach(x => x.placements = x.placements.filter(p => p.propId !== id)); save(); render(); } return; }
    case 'edit-stage': ui.editStage = id; return render();
    case 'cancel-stage': ui.editStage = null; return render();
    case 'del-stage': { if (S.events.some(x => x.stageId === id)) return alert('有事件正在使用這個舞台，無法刪除。'); S.stages = S.stages.filter(s => s.id !== id); save(); return render(); }
    case 'print': return window.print();
    case 'png': return exportPNG();
    case 'csv': return exportCSV();
    case 'export-data': return download(`舞台道具備份_${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
  }
});
document.addEventListener('submit', e => {
  const k = e.target.dataset?.form; if (!k) return; e.preventDefault();
  const f = new FormData(e.target);
  if (k === 'prop') {
    const o = { name: f.get('name').trim(), source: f.get('source'), owner: f.get('owner').trim(), w: num(f.get('w'), .5), d: num(f.get('d'), .5), notes: f.get('notes').trim() };
    if (o.source === 'theatre') o.owner = '';
    if (ui.editProp) Object.assign(propOf(ui.editProp), o); else S.props.push({ id: uid(), ...o });
    ui.editProp = null;
  } else {
    const o = { name: f.get('name').trim(), w: num(f.get('w'), 8), d: num(f.get('d'), 6), notes: f.get('notes').trim() };
    if (ui.editStage) Object.assign(stageOf(ui.editStage), o); else S.stages.push({ id: uid(), ...o });
    ui.editStage = null;
  }
  save(); render();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { ui.q = t.value; renderPropList(); }
  if (t.dataset.pl) {
    const pl = curEvent().placements.find(x => x.id === ui.sel); if (!pl) return;
    pl[t.dataset.pl] = parseFloat(t.value) || 0; if (t.dataset.pl !== 'rot') clampPl(pl);
    save(); document.getElementById('stageBox').innerHTML = stageSVG(curEvent(), { interactive: true });
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'eventSelect') { S.currentEventId = t.value; ui.sel = null; save(); render(); }
  if (t.id === 'ownerSel') { ui.filter = t.value; render(); }
  if (t.id === 'groupChk') { ui.group = t.checked; render(); }
  if (t.id === 'importFile' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try { const d = JSON.parse(r.result); if (!d.stages || !d.props || !d.events) throw 0; if (!confirm('還原會取代目前所有資料，確定嗎？')) return; S = d; save(); render(); }
      catch { alert('這不是有效的備份檔'); }
    };
    r.readAsText(t.files[0]); t.value = '';
  }
});
render();
