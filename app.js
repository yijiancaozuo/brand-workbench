const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let BRAND = localStorage.getItem('brand') || '', OPTS = null, ASSETS = [], CAT = '全部', REVF = '待审核';

const LOCAL_ONLY = '该功能仅本地版可用（在线静态预览版不支持上传 / 生成 / 审核）';
let _thumbs = null;
async function api(url, body) {
  if (body) throw new Error(LOCAL_ONLY);
  const u = new URL(url, 'http://x'); const p = u.pathname, b = u.searchParams.get('brand') || BRAND || 'CHXDR';
  const map = {'/api/brands':'brands','/api/dashboard':'dashboard','/api/assets':'assets','/api/reviews':'reviews','/api/options':'options'};
  if (map[p]) return (await fetch('data/' + map[p] + '.json')).json();
  if (p === '/api/tokens') return (await fetch('data/tokens_' + b + '.json')).json();
  if (p === '/api/thumbs') { _thumbs = _thumbs || await (await fetch('data/thumbs.json')).json(); const t = _thumbs[u.searchParams.get('path')]; if (!t) throw new Error('静态版无该文件缩略图'); return t; }
  throw new Error('静态版不支持：' + p);
}
const qb = () => BRAND ? `?brand=${encodeURIComponent(BRAND)}` : '';
const ICON = {'PPT模板':'📊','电子画册':'📖','海报物料':'🖼','会议物料':'🎪','色彩系统':'🎨','字体':'🔤','Logo':'◆','图片素材':'🏞','预览图':'👁','文档':'📄','文案脚本':'✍️','视频':'🎬','其他':'📦'};
const isImg = p => /\.(png|jpe?g|webp|gif|svg)$/i.test(p), isText = p => /\.(md|csv|txt|json|css)$/i.test(p);

function show(tab) {
  tab = tab || 'dashboard';
  $$('.tab').forEach(e => e.classList.toggle('on', e.id === 'tab-' + tab));
  $$('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  ({dashboard:loadDash, brand:loadBrand, assets:loadAssets, generate:loadGen, review:loadReview})[tab]?.();
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

async function loadBrands() {
  const c = await api('/api/brands'); if (!BRAND) BRAND = c.default;
  $('#brandSel').innerHTML = c.brands.map(b => `<option value="${b.code}" ${b.code===BRAND?'selected':''}>${esc(b.name)}（${b.code}）${b.placeholder?' · 占位':''}</option>`).join('');
  const b = c.brands.find(x => x.code === BRAND) || c.brands[0]; BRAND = b.code;
  $('#brandcss').href = 'data/tokens_' + BRAND + '.css';
  const bar = $('#placeholderBar'); bar.classList.toggle('hidden', !b.placeholder);
  bar.innerHTML = `⚠️ 「${esc(b.name)}」当前使用<b>占位设计令牌</b>（临时配色，无正式 Logo）。请到 <a href="#brand">品牌与上传</a> 上传 Logo / 色值 / 字体，所有输出会自动换成正式品牌。`;
  return c;
}
$('#brandSel').onchange = e => { BRAND = e.target.value; localStorage.setItem('brand', BRAND); loadBrands(); show(location.hash.slice(1)); };

// ---------------- 仪表盘
async function loadDash() {
  const d = await api('/api/dashboard'); const br = (await api('/api/tokens' + qb()));
  $('#pendingBadge').textContent = d.pending || '';
  const k = [['资产总数', d.assets_total], ['待审核草稿', d.pending, 'acc'], ['已定稿', d.approved], ['已退回', d.rejected], ['品牌数', d.brands.length]];
  $('#kpis').innerHTML = k.map(([l, n, c]) => `<div class="card ${c||''}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  const mx = Math.max(1, ...Object.values(d.by_category));
  $('#catBars').innerHTML = Object.entries(d.by_category).sort((a,b)=>b[1]-a[1]).map(([c, n]) => `<div class="bar"><span>${ICON[c]||''} ${c}</span><i style="width:${n/mx*70}%"></i><b>${n}</b></div>`).join('');
  $('#brandCard').innerHTML = `<b style="font-size:18px">${esc(br.brand.name)}</b>（${br.code}） ${br.placeholder?'<span class="tag 待审核">占位令牌</span>':'<span class="tag 已定稿">正式令牌</span>'}
   <div class="swatches" style="margin:10px 0">${['primary','accent','primary_light','neutral_900','background'].map(k=>`<div class="sw"><div style="background:${br.colors[k]}"></div><p>${k}<br>${br.colors[k]}</p></div>`).join('')}</div>
   <div class="muted">令牌文件：${esc(br.file)}<br>Logo：${esc(br.logo||'未上传')}｜产品图：${br.photos.length} 张｜标题字体：${esc(br.font_title_family)}</div>`;
  $('#recentList').innerHTML = d.recent.map(i => `<div class="li"><span class="tag ${i.status}">${i.status}</span><span style="flex:1">${esc(i.name)}</span><span class="t">${i.created.slice(5,16)}</span></div>`).join('') || '<span class="muted">暂无</span>';
  $('#historyList').innerHTML = d.history.map(h => `<div class="li"><b>${esc(h.action)}</b><span style="flex:1">${esc(h.name)}${h.note?` <span class="muted">· ${esc(h.note)}</span>`:''}</span><span class="t">${h.time.slice(5,16)}</span></div>`).join('') || '<span class="muted">暂无</span>';
  const t = d.tools;
  $('#toolsList').innerHTML = [['python-pptx', true, 'PPT 默认引擎'], ['ppt-master', t.pptmaster, 'SVG→原生 PPTX 可选引擎 + 品牌文档转 Markdown（tools/ppt-master，免 Key）'],
    ['StPageFlip (page-flip, MIT)', t.pageflip, '电子画册默认翻页引擎（已本地化）'], ['DearFlip Lite', t.dearflip, '画册 3D 版，CC BY-NC-ND 仅限非商用'],
    ['LibreOffice + pdftoppm', true, 'PPT 缩略图'], ['大模型文案', !!t.llm, t.llm ? `已检测到 ${t.llm}` : '未配置 API Key → 使用模板文案']]
    .map(([n, ok, d]) => `<div class="li"><span class="tag ${ok?'已定稿':'已退回'}">${ok?'已接入':'未启用'}</span><b>${n}</b><span class="muted">${d}</span></div>`).join('');
}

// ---------------- 品牌与上传
let TOK = null;
async function loadBrand() {
  const c = await loadBrands(); TOK = await api('/api/tokens' + qb()); const t = TOK;
  $('#tokFile').innerHTML = `文件：<code>${esc(t.file)}</code> ${t.placeholder?'<span class="tag 待审核">占位</span>':''}${t.brand.readonly?' <span class="tag">只读示例</span>':''}<br>${esc(t.note||'')}`;
  $('#swatches').innerHTML = Object.entries(t.colors).map(([k, v]) => `<div class="sw"><div style="background:${v}"></div><p><b>${k}</b><br>${v}</p></div>`).join('') +
    (t.logo ? `<div class="sw"><div style="background:#fff;display:flex;align-items:center;justify-content:center"><img src="/files/${encodeURI(t.logo)}" style="max-height:46px;max-width:90px"></div><p>Logo</p></div>` : '');
  $('#cPrimary').value = t.colors.primary.toLowerCase(); $('#cAccent').value = t.colors.accent.toLowerCase();
  $('#colorEdit').innerHTML = Object.entries(t.colors).map(([k, v]) => `<label>${k}<input type="color" data-ck="${k}" value="${v.toLowerCase()}"></label>`).join('');
  const sp = t.spacing || {}, inf = t.info || {};
  $('#fTitle').value = t.font_title_family; $('#fBody').value = t.font_body_family;
  $('#sBase').value = sp['基准单位px'] ?? ''; $('#sRadius').value = sp['圆角px'] ?? ''; $('#sMargin').value = sp['页边距比例'] ?? ''; $('#sLh').value = sp['行高'] ?? '';
  $('#iName').value = inf['名称'] || ''; $('#iEn').value = inf['英文名'] || ''; $('#iSlogan').value = inf['口号'] || ''; $('#iUrl').value = inf['网址'] || '';
  $('#iContact').value = inf['联系方式'] || ''; $('#iKw').value = (inf['关键词'] || []).join(',');
  $('#cssOut').textContent = t.css; $('#cssLink').href = 'data/tokens_' + BRAND + '.css';
  $('#brandList').innerHTML = c.brands.map(b => `<div class="li"><b>${esc(b.name)}</b><span>${b.code}</span><span class="muted" style="flex:1">${esc(b.tokens)}</span>${b.placeholder?'<span class="tag 待审核">占位</span>':''}${c.default===b.code?'<span class="tag 已定稿">默认</span>':`<button onclick="setDefault('${b.code}')">设为默认</button>`}</div>`).join('');
}
async function saveTok(patch) {
  try { await api('/api/tokens', {brand: BRAND, patch}); await loadBrand(); toast('已保存，CSS 变量已同步导出'); } catch (e) { alert(e.message); }
}
$('#btnRegen').onclick = () => saveTok({colors: {primary: $('#cPrimary').value, accent: $('#cAccent').value, regen: true}});
$('#btnSaveTok').onclick = () => {
  const colors = {}; $$('[data-ck]').forEach(i => colors[i.dataset.ck] = i.value);
  saveTok({colors, fonts: {'标题': {family: $('#fTitle').value}, '正文': {family: $('#fBody').value}},
    spacing: {'基准单位px': +$('#sBase').value || null, '圆角px': $('#sRadius').value === '' ? null : +$('#sRadius').value, '页边距比例': +$('#sMargin').value || null, '行高': +$('#sLh').value || null},
    info: {'名称': $('#iName').value, '英文名': $('#iEn').value, '口号': $('#iSlogan').value, '网址': $('#iUrl').value, '联系方式': $('#iContact').value, '关键词': $('#iKw').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean)},
    confirm_real: $('#confirmReal').checked});
};
window.setDefault = async code => { await api('/api/brands', {action:'default', code}); loadBrand(); };
$('#btnAddBrand').onclick = async () => { try { await api('/api/brands', {action:'add', code:$('#nbCode').value, name:$('#nbName').value}); loadBrand(); } catch(e) { alert(e.message); } };
const drop = $('#drop');
drop.onclick = () => $('#upFile').click();
drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]); };
$('#upFile').onchange = e => upload([...e.target.files]);
async function upload(files) {
  for (const f of files) {
    $('#upResult').insertAdjacentHTML('afterbegin', `<div class="res" id="u_${f.size}">上传中：${esc(f.name)}…</div>`);
    const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    try {
      const j = await api('/api/upload', {brand: BRAND, kind: $('#upKind').value, filename: f.name, data, desc: $('#upDesc').value, apply: $('#upApply').checked});
      const pal = (j.palette || []).map(h => `<span title="${h}" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${h};margin-right:2px"></span>`).join('');
      $('#u_' + f.size).innerHTML = `✅ <b>${esc(f.name)}</b> → <code>${esc(j.saved)}</code> ${pal} ${j.suggest?`建议主色 ${j.suggest.primary} / 强调色 ${j.suggest.accent}`:''} ${j.applied?'<span class="tag 已定稿">已写入令牌</span>':''} ${j.family?'字体：'+esc(j.family):''} ${j.text_via?'<span class="muted">（文档解析：'+esc(j.text_via)+'）</span>':''}`;
    } catch (e) { $('#u_' + f.size).innerHTML = `❌ ${esc(f.name)}：${esc(e.message)}`; }
  }
  loadBrand(); loadBrands();
}

// ---------------- 资产浏览
async function loadAssets() {
  ASSETS = await api('/api/assets');
  const cats = ['全部', ...new Set(ASSETS.map(a => a.category))];
  $('#catFilter').innerHTML = cats.map(c => `<span class="chip ${c===CAT?'on':''}" data-c="${c}">${ICON[c]||''} ${c} (${c==='全部'?ASSETS.length:ASSETS.filter(a=>a.category===c).length})</span>`).join('');
  $$('#catFilter .chip').forEach(e => e.onclick = () => { CAT = e.dataset.c; loadAssets(); });
  renderAssets();
}
$('#q').oninput = () => renderAssets(); $('#onlyBrand').onchange = () => renderAssets();
function renderAssets() {
  const q = $('#q').value.trim(), ob = $('#onlyBrand').checked;
  const list = ASSETS.filter(a => (CAT === '全部' || a.category === CAT) && (!q || a.name.includes(q) || a.path.includes(q)) && (!ob || a.brand === BRAND));
  $('#assetGrid').innerHTML = list.map((a, i) => `<div class="asset" onclick="preview(${ASSETS.indexOf(a)})"><div class="th">${isImg(a.path) ? `<img loading="lazy" src="${a.url}">` : (ICON[a.category]||'📦')}</div>
    <div class="meta"><div class="nm">${esc(a.name)}</div><div class="muted">${a.category} · ${a.folder}</div><span class="tag ${a.status}">${a.status}</span> <span class="muted">${a.mtime}</span></div></div>`).join('') || '<p class="muted">没有匹配的资产</p>';
}
window.preview = async i => {
  const a = ASSETS[i]; let h = `<h3>${esc(a.name)}</h3><p class="muted">${esc(a.path)} · <a href="${a.url}" target="_blank" download>打开 / 下载</a></p>`;
  openModal(h + '<p class="muted">加载预览…</p>');
  if (isImg(a.path)) h += `<img src="${a.url}" style="max-width:100%">`;
  else if (a.category === '电子画册' || /\.html$/.test(a.path)) h += `<iframe src="${a.url}"></iframe>`;
  else if (/\.(pptx|potx|ppt|pdf|key|docx)$/i.test(a.path)) {
    try { const t = await api('/api/thumbs?path=' + encodeURIComponent(a.path));
      h += (t.info && t.info.slides ? `<p>共 ${t.info.slides} 页 · 比例 ${t.info.ratio} · 版式：${esc((t.info.layouts||[]).slice(0,6).join('、'))}</p>` : '') +
        `<div class="thumbs">${t.images.map(s => `<img src="${s}">`).join('') || '<span class="muted">无法生成缩略图</span>'}</div>` + (t.pdf ? `<p><a href="${t.pdf}" target="_blank">查看 PDF 版</a></p>` : '');
    } catch (e) { h += `<p>${esc(e.message)}</p>`; }
  } else if (/\.(json|css)$/.test(a.path) && a.category === '色彩系统') {
    const txt = await (await fetch(a.url)).text(); const hx = [...new Set(txt.match(/#[0-9A-Fa-f]{6}\b/g) || [])];
    h += `<div class="swatches">${hx.map(x => `<div class="sw"><div style="background:${x}"></div><p>${x}</p></div>`).join('')}</div><pre>${esc(txt.slice(0, 6000))}</pre>`;
  } else if (/\.(ttf|otf|woff2?)$/i.test(a.path)) {
    h += `<style>@font-face{font-family:pv;src:url("${a.url}")}</style><div style="font-family:pv;font-size:40px">品牌字体预览 ABC abc 123</div><div style="font-family:pv;font-size:20px">出海行动人 · 陪中国品牌一起出海</div>`;
  } else if (isText(a.path)) h += `<pre>${esc((await (await fetch(a.url)).text()).slice(0, 20000))}</pre>`;
  else h += '<p class="muted">该类型不支持在线预览，请下载查看。</p>';
  openModal(h);
};

// ---------------- 一键生成
async function loadGen() {
  OPTS = await api('/api/options');
  const def = ['ppt', 'album', 'poster', 'conference', 'copy', 'script'];
  if (!$('#gOutputs').innerHTML) {
    $('#gOutputs').innerHTML = OPTS.outputs.map(o => `<span class="chip ${def.includes(o.id)?'on':''}" data-v="${o.id}">${o.name}</span>`).join('');
    $('#gSizes').innerHTML = OPTS.posters.map(o => `<span class="chip on" data-v="${o.id}" title="${o.label}">${o.id}</span>`).join('');
    $('#gConf').innerHTML = OPTS.conference.map(o => `<span class="chip on" data-v="${o.id}" title="${o.label}">${o.id}</span>`).join('');
    $$('#tab-generate .chip').forEach(c => c.onclick = () => c.classList.toggle('on'));
  }
  $('#gTpl').innerHTML = OPTS.ppt_templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('#gEngine').innerHTML = OPTS.ppt_engines.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('#gDearflip').parentElement.classList.toggle('hidden', !OPTS.dearflip);
}
const chips = s => $$(s + ' .chip.on').map(c => c.dataset.v);
$('#btnGen').onclick = async () => {
  const body = {brand: BRAND, topic: $('#gTopic').value, subtitle: $('#gSub').value, bullets: $('#gBullets').value, outputs: chips('#gOutputs'),
    template: $('#gTpl').value, engine: $('#gEngine').value, ratios: $$('.gRatio:checked').map(x => x.value), sizes: chips('#gSizes'), conference: chips('#gConf'), dearflip: $('#gDearflip').checked};
  $('#btnGen').disabled = true; $('#genStatus').textContent = '生成中…（PPT/海报/画册/物料约 10–40 秒）'; const t0 = Date.now();
  try {
    const r = await api('/api/generate', body);
    $('#genStatus').innerHTML = `✅ 完成，用时 ${((Date.now()-t0)/1000).toFixed(1)} 秒，共 ${r.items.length} 个草稿已进入待审核。` + r.warnings.map(w => `<div style="color:#8a5300">⚠️ ${esc(w)}</div>`).join('');
    $('#genResult').innerHTML = r.items.map(i => `<div class="res">${i.preview && isImg(i.preview) ? `<img src="${i.preview}">` : `<span style="font-size:28px">${i.type==='PPT'?'📊':i.type==='ALB'?'📖':'📄'}</span>`}
      <div><b>${esc(i.name)}</b><br><span class="muted">${esc(Object.entries(i.extra).map(([k,v])=>k+'：'+v).join(' · '))}</span></div></div>`).join('') + `<p><a href="#review">去审核 →</a></p>`;
  } catch (e) { $('#genStatus').textContent = '❌ ' + e.message; }
  $('#btnGen').disabled = false;
};

// ---------------- 审核
async function loadReview() {
  const items = await api('/api/reviews'); const sts = ['待审核', '已定稿', '已退回', '全部'];
  $('#pendingBadge').textContent = items.filter(i => i.status === '待审核').length || '';
  $('#revFilter').innerHTML = sts.map(s => `<span class="chip ${s===REVF?'on':''}" data-s="${s}">${s} (${s==='全部'?items.length:items.filter(i=>i.status===s).length})</span>`).join('');
  $$('#revFilter .chip').forEach(e => e.onclick = () => { REVF = e.dataset.s; loadReview(); });
  const list = items.filter(i => REVF === '全部' || i.status === REVF).sort((a, b) => b.created.localeCompare(a.created));
  $('#revList').innerHTML = list.map(i => `<div class="rev" id="r_${i.id}"><div class="pv" id="pv_${i.id}">${pv(i)}</div>
    <div><div><span class="tag ${i.status}">${i.status}</span> <b>${esc(i.name)}</b></div>
    <div class="muted" style="margin:6px 0">品牌：${esc(i.brand||i.client)} · 主题：${esc(i.topic||'—')} · 类型：${i.type} ${esc(i.spec||'')} · 生成：${i.created}<br>位置：${esc(i.path)}${i.approved_copy?'<br>定稿副本：'+esc(i.approved_copy):''}${i.feedback?'<br>修改意见：'+esc(i.feedback):''}<br>${esc(Object.entries(i.extra||{}).map(([k,v])=>k+'：'+v).join(' · '))}</div>
    <div class="muted">${i.history.map(h => `${h.time.slice(5,16)} ${esc(h.action)}${h.note?'（'+esc(h.note)+'）':''}`).join(' → ')}</div>
    ${i.status === '待审核' ? `<div class="act"><input id="n_${i.id}" placeholder="审核意见（退回时必填）"><button class="ok" onclick="act('${i.id}','approve')">✓ 通过定稿</button><button class="no" onclick="act('${i.id}','reject')">✗ 退回修改</button></div>` : ''}
    <div class="act"><a href="files/${encodeURI(i.path)}${i.is_dir?'/index.html':''}" target="_blank">打开</a></div></div></div>`).join('') || '<p class="muted">没有记录</p>';
  list.filter(i => i.type === 'PPT').forEach(async i => {
    try { const t = await api('/api/thumbs?path=' + encodeURIComponent(i.path)); $('#pv_' + i.id).innerHTML = `<div class="thumbs">${t.images.slice(0, 6).map(s => `<img src="${s}">`).join('')}</div>`; } catch (e) {}
  });
  list.filter(i => /\.(md|csv)$/.test(i.path)).forEach(async i => { try { $('#pv_' + i.id).innerHTML = `<pre>${esc((await (await fetch('files/' + encodeURI(i.path))).text()).slice(0, 3000))}</pre>`; } catch (e) {} });
}
function pv(i) {
  if (i.type === 'PPT') return '<span class="muted">缩略图生成中…</span>';
  if (i.is_dir) return `<iframe src="files/${encodeURI(i.path)}/index.html"></iframe>`;
  if (i.preview && isImg(i.preview)) return `<img src="${i.preview}">`;
  return '<span class="muted">无预览</span>';
}
window.act = async (id, action) => {
  try { await api('/api/review', {id, action, note: $('#n_' + id).value}); toast(action === 'approve' ? '已定稿并归档' : '已退回，意见已记录'); loadReview(); } catch (e) { alert(e.message); }
};
function openModal(h) { $('#mbody').innerHTML = h; $('#modal').classList.remove('hidden'); }
window.closeModal = () => $('#modal').classList.add('hidden');
function toast(m) { const d = document.createElement('div'); d.textContent = m; d.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#111;color:#fff;padding:10px 16px;border-radius:8px;z-index:30'; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); }
loadBrands().then(() => show(location.hash.slice(1)));

document.addEventListener('DOMContentLoaded', () => {});
(function lockStatic(){
  const lock = () => {
    ['#btnGen','#btnRegen','#btnSaveTok','#btnAddBrand'].forEach(s => { const e = document.querySelector(s); if (e && !e.dataset.l) { e.dataset.l = 1; e.disabled = true; e.title = LOCAL_ONLY; e.textContent += '（仅本地版）'; } });
    const d = document.querySelector('#drop'); if (d && !d.dataset.l) { d.dataset.l = 1; d.onclick = d.ondrop = e => { e && e.preventDefault(); alert(LOCAL_ONLY); }; d.innerHTML = '🔒 上传仅本地版可用'; }
    document.querySelectorAll('.rev .act input, .rev .act button, [onclick^="setDefault"]').forEach(e => { e.disabled = true; e.title = LOCAL_ONLY; });
    document.querySelectorAll('.rev .act').forEach(a => { if (a.querySelector('button') && !a.dataset.l) { a.dataset.l = 1; a.insertAdjacentHTML('beforeend', '<span class="muted">🔒 审核仅本地版可用</span>'); } });
  };
  new MutationObserver(lock).observe(document.body, {childList: true, subtree: true}); lock();
})();
