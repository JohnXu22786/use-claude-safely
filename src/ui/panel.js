let showPanel = null;
if (typeof GM_registerMenuCommand === 'function') {
GM_registerMenuCommand('Open Environment Manager', () => {
if (showPanel) { showPanel(); return; }
if (page.top !== page) return;
if (document.body) { createWidget(); showPanel?.(); }
else document.addEventListener('DOMContentLoaded', () => { createWidget(); showPanel?.(); }, { once: true });
});
}
function createWidget() {
if (page.top !== page || !document.body || document.getElementById('ca-env-manager-host')) return;
const host = document.createElement('div');
host.id = 'ca-env-manager-host';
host.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;pointer-events:none;width:0;height:0;';
const shadow = host.attachShadow({ mode: 'closed' });
shadow.innerHTML = `
<style>
:host { all:initial;color-scheme:light dark; }
*, *::before, *::after {box-sizing:border-box;}
.fab {pointer-events:auto;display:block;position:absolute;top:0;left:0;border:1px solid #536b88;
border-radius:999px;min-width:72px;min-height:38px;padding:7px 11px;
color:#fff;background:#263e61;box-shadow:0 4px 15px #0004;
font:700 13px system-ui,Arial,sans-serif;cursor:grab;touch-action:none;
user-select:none;-webkit-user-select:none;white-space:nowrap;}
.fab:active {cursor:grabbing;}
.fab.leak {background:#af1e29;border-color:#ee8790;animation:warn-pulse 1.8s ease-in-out infinite;}
.fab.consistency {background:#98610f;border-color:#e8b45b;}
.fab.off {background:#515861;border-color:#767e87;}
@keyframes warn-pulse {50% {box-shadow:0 0 0 5px #d32f2f50;}}
.panel {pointer-events:auto;position:fixed;width:min(390px,calc(100vw - 24px));
max-height:min(80vh,650px);overflow-y:auto;overscroll-behavior:contain;
padding:16px;border-radius:15px;border:1px solid #d6dde8;background:#fff;color:#202b39;
box-shadow:0 14px 48px #0005;font:13px/1.45 system-ui,Arial,sans-serif;}
.head,.setting,.actionrow,.inputrow,.chip {display:flex;align-items:center;gap:8px;}
.head,.setting {justify-content:space-between;}
.head strong {font-size:16px;}
.muted {color:#64748b;font-size:11px;line-height:1.5;}
.section {padding:12px 0;border-bottom:1px solid #e6eaf0;}
.section:last-of-type {border:0;}
.label {font-size:13px;font-weight:700;}
.sub {margin:5px 0 8px;color:#657286;font-size:11px;line-height:1.5;overflow-wrap:anywhere;}
input[type=text],input[type=search] {min-width:0;flex:1;width:100%;height:36px;border-radius:8px;
border:1px solid #9aa8bd;background:white;color:#1d293a;padding:8px 9px;font:12px system-ui,sans-serif;}
input:focus, button:focus-visible {outline:2px solid #4576ce;outline-offset:1px;}
input[type=checkbox] {width:19px;height:19px;flex:0 0 19px;accent-color:#416fd4;cursor:pointer;}
button {cursor:pointer;border-radius:8px;border:1px solid #bac5d3;background:#f7f9fc;
color:#26364e;padding:8px 10px;font:600 12px system-ui,sans-serif;}
.primary {background:#385fd0;color:#fff;border-color:#385fd0;}
.tiny {font-size:11px;padding:5px 8px;}
.list {border:1px solid #d7dfe9;border-radius:8px;margin-top:5px;max-height:145px;
overflow:auto;overscroll-behavior:contain;}
.option {display:block;width:100%;text-align:left;border:0;border-radius:0;
border-bottom:1px solid #eff2f7;background:transparent;font-weight:500;padding:7px 9px;
white-space:normal;overflow-wrap:anywhere;}
.option:hover,.option:focus {background:#e7efff;}
.chips {display:flex;flex-direction:column;gap:4px;margin:8px 0;max-height:130px;overflow:auto;}
.chip {justify-content:space-between;border-radius:7px;background:#f1f4f8;padding:4px 6px;}
.chip span {flex:1;overflow-wrap:anywhere;}
.mail-service {padding:9px 0;border-bottom:1px solid #e6eaf0;}
.mail-row {display:flex;align-items:center;gap:8px;}
.mail-row .mail-expand {flex:1;text-align:left;border:0;background:transparent;}
.mail-features {padding:8px 10px;margin:6px 0;border-radius:8px;background:#eff3f8;}
.mail-features label {display:flex;gap:8px;align-items:center;padding:5px 0;}
@media (prefers-color-scheme:dark) {.mail-features {background:#25374b;} .mail-service {border-color:#34465a;}}
.summary {display:flex;gap:6px;align-items:center;margin:10px 0 2px;}
.summary .status {margin:0;flex:1;min-width:0;font-size:11px;padding:8px;}
.summary button {flex:none;padding:6px 10px;}
.coverage {margin:7px 0 3px;padding:7px 9px;border:1px solid #d8e0eb;
border-radius:8px;font-size:11px;overflow-wrap:anywhere;}
.coverage summary {cursor:pointer;font-weight:600;line-height:1.5;}
.coverage .item {padding:5px 0 4px;border-top:1px solid #e6eaf0;}
.coverage .item:first-child {margin-top:7px;}
.coverage .item.difference {color:#9a491b;}
.status {margin-top:11px;padding:9px;border-radius:9px;background:#f0f4f9;
color:#32435d;font-size:12px;overflow-wrap:anywhere;white-space:pre-line;}
.status.ok {background:#eaf7ef;color:#17613c;}
.status.warning {background:#fff2d7;color:#78520e;}
.status.leak,.status.error {background:#fce8e9;color:#a22127;}
/* Separate from the scrolling panel: alerts always float at its visible bottom. */
.toast {position:fixed;z-index:10;pointer-events:none;margin:0;padding:10px 12px;
max-height:120px;overflow:hidden;overflow-wrap:anywhere;border-radius:9px;
border:1px solid #b3dfc3;background:#eaf7ef;color:#17613c;
box-shadow:0 5px 20px #0005;font:600 12px/1.45 system-ui,Arial,sans-serif;
text-align:center;}
.toast.error {background:#fce8e9;border-color:#edabb0;color:#a22127;}
.count {padding:4px;color:#69788c;font-size:11px;}
[hidden] {display:none!important;}
@media (prefers-color-scheme:dark) {
.panel {background:#17212e;color:#eef2f7;border-color:#39495e;}
.section,.coverage .item {border-color:#34465a;}
.coverage {border-color:#465971;}
.coverage .item.difference {color:#ffcb90;}
.muted,.sub,.count {color:#acbdd2;}
input[type=text],input[type=search] {background:#222f41;color:#fff;border-color:#697b92;}
button {background:#283a4d;color:#f1f5fa;border-color:#53677f;}
.primary {background:#385fd0;border-color:#385fd0;color:white;}
.chip {background:#293b4e;}
.option {border-color:#35485f;}
.option:hover,.option:focus {background:#354c70;}
.status {background:#28394c;color:#d3e2f5;}
.status.ok {background:#164a34;color:#b5f3d0;}
.status.warning {background:#564018;color:#ffe3a1;}
.status.leak,.status.error {background:#591f28;color:#ffc2c8;}
.toast {background:#164a34;border-color:#34775a;color:#b5f3d0;}
.toast.error {background:#591f28;border-color:#a44350;color:#ffc2c8;}
}
</style>
<button id="fab" class="fab" type="button" aria-label="Environment Manager; drag to move">ENV ⚙</button>
<section id="panel" class="panel" role="dialog" aria-label="Environment Manager" hidden>
<div id="mainView">
<div class="head"><strong>Environment Settings</strong><button id="close" class="tiny" type="button" aria-label="Close">✕</button></div>
<div class="summary" id="consistencyTop">
<div class="status" id="consistencyStatus" role="status" aria-live="polite"></div>
<button class="tiny" id="consistencyRetry" type="button" title="Recheck IP, timezone, region and language tags">↻</button>
</div>
<details class="coverage" id="coverageBox">
<summary id="coverageSummary">Other signals: checking…</summary>
<div id="coverageItems"></div>
</details>
<div class="section">
<div class="label">Timezone</div>
<div class="sub" id="tzNow"></div>
<div class="inputrow"><input id="tzInput" type="search" autocomplete="off" spellcheck="false" placeholder="City, country, +9, UTC-5, GMT, PST, PT..."><button class="primary" id="tzSave" type="button">Save</button></div>
<div class="list" id="tzOptions"></div><div class="count" id="tzCount"></div>
<button id="tzSystem" class="tiny" type="button">Use system timezone</button>
</div>
<div class="section">
<div class="setting"><span class="label">Region (JavaScript)</span><input id="regionOn" type="checkbox" aria-label="Enable region override"></div>
<div class="sub">Changes default Intl region, not navigator.languages, the OS, or your IP. Use Match Language Regions for language tags.</div>
<div class="inputrow"><input id="regionInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search a country or enter ISO code, e.g. JP"><button id="regionSave" class="primary" type="button">Save</button></div>
<div id="regionOptions" class="list"></div><div id="regionCount" class="count"></div>
<div class="sub" id="regionEffective"></div>
</div>
<div class="section">
<div class="setting"><span class="label">Match Language Regions</span><input id="matchOn" type="checkbox" aria-label="Automatically match browser languages to their usual regions"></div>
<div class="sub">Replaces region tags in browser languages with each language’s typical region. Custom language lists take priority.</div>
<div class="sub" id="matchedLanguages"></div>
</div>
<div class="section">
<div class="setting"><span class="label">Browser Languages</span><input id="languageOn" type="checkbox" aria-label="Enable browser language override"></div>
<div class="sub">Exposed now: <span id="exposedLanguages"></span></div>
<div class="sub">Original browser tags: <span id="originalLanguages"></span></div>
<div id="languageEditor">
<div class="chips" id="chips"></div>
<div class="inputrow"><input id="languageInput" type="search" autocomplete="off" spellcheck="false" placeholder="Find or enter any BCP-47 language"><button id="languageAdd" type="button">Add</button></div>
<div id="languageOptions" class="list"></div><div id="languageCount" class="count"></div>
<button id="languageSave" class="primary" type="button">Save language order</button>
</div>
<div class="sub">HTTP language headers are not changed.</div>
</div>
<div class="section">
<div class="setting"><span class="label">Intl Locale</span><input id="localeOn" type="checkbox" aria-label="Enable Intl locale override"></div>
<div class="sub">Default: <span id="nativeLocale"></span>. Region overrides its regional subtag.</div>
<div class="inputrow"><input id="localeInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search or enter a BCP-47 locale"><button id="localeSave" class="primary" type="button">Save</button></div>
<div id="localeOptions" class="list"></div><div id="localeCount" class="count"></div>
</div>
<div class="section">
<div class="setting"><span class="label">Chinese Font Protection</span><input id="fontOn" type="checkbox" aria-label="Enable Chinese font masking"></div>
<div class="sub">Masks ${fontFamilies.length} common font names in supported APIs; text still renders normally.</div>
</div>
<div class="section">
<div class="setting"><span class="label">WebRTC CN/HK IP Check</span><input id="rtcOn" type="checkbox" aria-label="Enable WebRTC CN/HK IP check"></div>
<div class="sub">Checks whether observed public WebRTC IPs geolocate to mainland China or Hong Kong. Private IPs ignored; incomplete results are neutral.</div>
<div class="status" id="rtcStatus"></div>
<button id="rtcRetry" class="tiny" type="button">Check again</button>
</div>
<div class="section">
<div class="setting"><span class="label">IP / Timezone / Region Consistency</span><input id="ipConsistencyOn" type="checkbox" aria-label="Enable IP timezone region and language tag checks"></div>
<div class="sub">Checks IP, timezone, selected region and non-zh -CN language tags (including HTTP if available). Other language regions are unrestricted.</div>
</div>
<div class="section"><button id="mailManage" type="button">Mail Websites · <span id="mailSummary">Off</span> ›</button></div>
<div class="actionrow" style="margin-top:12px;justify-content:flex-end"><button id="reset" type="button">Reset to defaults</button></div>
</div>
<div id="mailView" hidden>
<div class="head"><button id="mailBack" class="tiny" type="button">← Back</button><strong>Mail Websites</strong><button id="mailClose" class="tiny" type="button">✕</button></div>
<div class="section"><div class="setting"><span class="label">Enable mail websites</span><input id="mailMaster" type="checkbox" aria-label="Enable selected mail websites"></div>
<div class="sub">Off by default. Choose individual mail websites below. All sites inherit the global environment values; per-site switches control which modules run.</div></div>
<div id="mailSiteList"></div>
<div class="actionrow" style="margin-top:12px;justify-content:flex-end"><button id="mailSave" class="primary" type="button">Save mail settings</button></div>
</div>
</section>
<div class="toast" id="message" role="status" aria-live="polite" hidden></div>
`;
const $ = name => shadow.getElementById(name);
const fab = $('fab');
const panel = $('panel');
const EDGE = 12;
const bound = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const savedPosition = GM_getValue(POSITION_KEY, null);
function validPosition(v) {
return v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1;
}
let position = validPosition(savedPosition) ? { x: savedPosition.x, y: savedPosition.y } : { x: 0, y: 1 };
function bounds() {
const width = document.documentElement.clientWidth || page.innerWidth;
const height = page.innerHeight || document.documentElement.clientHeight;
return { width, height,
maxLeft: Math.max(EDGE, width - EDGE - fab.offsetWidth),
maxTop: Math.max(EDGE, height - EDGE - fab.offsetHeight) };
}
function layout() {
if (panel.hidden) return;
const b = bounds();
const rect = fab.getBoundingClientRect();
const availableTop = Math.max(0, rect.top - EDGE - 8);
const availableBottom = Math.max(0, b.height - rect.bottom - EDGE - 8);
const showBelow = availableBottom >= availableTop;
const available = showBelow ? availableBottom : availableTop;
panel.style.maxHeight = `${Math.max(50, Math.min(650, b.height * .80, available))}px`;
panel.style.left = `${bound(rect.left, EDGE, Math.max(EDGE, b.width - EDGE - panel.offsetWidth))}px`;
const h = panel.getBoundingClientRect().height;
panel.style.top = `${bound(showBelow ? rect.bottom + 8 : rect.top - 8 - h,
EDGE, Math.max(EDGE, b.height - EDGE - h))}px`;
const toast = $('message');
if (!toast.hidden) {
const popup = panel.getBoundingClientRect();
toast.style.width = `${Math.max(50, popup.width - 24)}px`;
toast.style.left = `${popup.left + 12}px`;
toast.style.top = `${Math.max(popup.top + 8,
popup.bottom - toast.offsetHeight - 12)}px`;
}
}
function applyPosition() {
const b = bounds();
host.style.left = `${EDGE + position.x * (b.maxLeft - EDGE)}px`;
host.style.top = `${EDGE + position.y * (b.maxTop - EDGE)}px`;
layout();
}
let drag = null;
let lastDragEnded = -Infinity;
fab.addEventListener('pointerdown', e => {
if (e.button !== 0 || !e.isPrimary) return;
drag = { id:e.pointerId, x:e.clientX, y:e.clientY,
left:parseFloat(host.style.left), top:parseFloat(host.style.top), moved:false };
fab.setPointerCapture(e.pointerId);
});
fab.addEventListener('pointermove', e => {
if (!drag || drag.id !== e.pointerId) return;
const dx = e.clientX - drag.x;
const dy = e.clientY - drag.y;
if (!drag.moved && Math.hypot(dx, dy) < 5) return;
drag.moved = true;
e.preventDefault();
const b = bounds();
const left = bound(drag.left + dx, EDGE, b.maxLeft);
const top = bound(drag.top + dy, EDGE, b.maxTop);
host.style.left = `${left}px`;
host.style.top = `${top}px`;
position = {
x: b.maxLeft === EDGE ? 0 : (left - EDGE) / (b.maxLeft - EDGE),
y: b.maxTop === EDGE ? 0 : (top - EDGE) / (b.maxTop - EDGE),
};
layout();
});
function finishDrag(e) {
if (!drag || drag.id !== e.pointerId) return;
if (drag.moved) {
lastDragEnded = performance.now();
GM_setValue(POSITION_KEY, { ...position });
}
if (fab.hasPointerCapture(e.pointerId)) fab.releasePointerCapture(e.pointerId);
drag = null;
}
fab.addEventListener('pointerup', finishDrag);
fab.addEventListener('pointercancel', finishDrag);
page.addEventListener('resize', applyPosition, { passive:true });
if (typeof GM_addValueChangeListener === 'function') {
GM_addValueChangeListener(POSITION_KEY, (_key,_old,val,remote) => {
if (!remote || !validPosition(val) || drag) return;
position = { x:val.x,y:val.y }; applyPosition();
});
}
let messageTimer = null;
function clearMessage() {
if (messageTimer !== null) page.clearTimeout(messageTimer);
messageTimer = null;
$('message').hidden = true;
}
function message(info, isError = false) {
clearMessage();
const toast = $('message');
toast.className = `toast${isError ? ' error' : ''}`;
toast.textContent = info;
if (panel.hidden) showPanel();
toast.hidden = false;
layout();
messageTimer = page.setTimeout(() => {
toast.hidden = true;
messageTimer = null;
}, isError ? 4800 : 3200);
}
function setting(key, value, reload) {
const result = commit(key, value, reload);
message(result.info, !result.ok);
syncControls();
if (prefs.ipConsistency) runConsistencyCheck();
return result.ok;
}
function renderCoverage() {
const notes=coverageNotes();
const differences=notes.filter(n=>n.kind==='difference');
const unknowns=notes.filter(n=>n.kind==='unknown');
$('coverageSummary').textContent=differences.length
? `Other signals: ${differences.length} observed difference · ${unknowns.length} limits (tap)`
: `Other signals: ${unknowns.length} unverified limits (tap)`;
const list=document.createDocumentFragment();
for (const note of notes) {
const item=document.createElement('div');
item.className=`item ${note.kind}`;
item.textContent=`${note.kind==='difference'?'⚠ ':note.kind==='match'?'✓ ':'• '}${note.text}`;
list.appendChild(item);
}
$('coverageItems').replaceChildren(list);
}
function renderRtc() {
let label = '';
const regionWarning = prefs.ipConsistency && consistencyState.state === 'warning';
switch (rtcState.state) {
case 'leak': label = '⚠ ENV !'; break;
case 'unknown': label = 'ENV ·'; break;
case 'checking': label = 'ENV …'; break;
case 'off': label = 'ENV ⚙'; break;
default: label = 'ENV ✓';
}
if (regionWarning && rtcState.state !== 'leak') label = '⚠ ENV !';
if (rtcState.state === 'limited' && !regionWarning) label = 'ENV ·';
fab.textContent = label;
fab.className = `fab ${rtcState.state === 'leak' ? 'leak' : regionWarning ? 'consistency' : rtcState.state === 'off' ? 'off' : ''}`;
$('rtcStatus').className = `status ${rtcState.state === 'leak' ? 'leak' : rtcState.state === 'safe' ? 'ok' : (rtcState.state === 'off' || rtcState.state === 'limited' || rtcState.state === 'unknown') ? '' : 'warning'}`;
$('rtcStatus').textContent = rtcState.state === 'limited' ? `INCOMPLETE: ${rtcState.details}` : `${rtcState.state.toUpperCase()}: ${rtcState.details}`;
renderCoverage();
}
subscribers.add(renderRtc);
function renderConsistency() {
$('consistencyStatus').className = `status ${consistencyState.state === 'warning' ? 'warning' : consistencyState.state === 'ok' ? 'ok' : ''}`;
$('consistencyStatus').textContent = `${consistencyState.state.toUpperCase()}: ${consistencyState.details}`;
renderRtc();
}
consistencyListeners.add(renderConsistency);
function syncControls() {
$('mailSummary').textContent = prefs.mailEnabled ? mailProviders.filter(x => prefs.mailSites[x.id].enabled).length + ' selected' : 'Off';
$('tzNow').textContent = `Saved: ${prefs.timezone === SYSTEM ? `System (${systemZone})` : prefs.timezone}`;
$('languageOn').checked = prefs.languageEnabled;
$('matchOn').checked = prefs.matchLanguageRegions;
$('regionOn').checked = prefs.regionEnabled;
$('ipConsistencyOn').checked = prefs.ipConsistency;
$('regionEffective').textContent = `Default Intl locale after overrides: ${effectiveLocale(prefs)}`;
$('matchedLanguages').textContent = `Expected after reload: ${effectiveLanguages(prefs).join(', ')}`;
$('exposedLanguages').textContent = Array.from(page.navigator.languages || []).join(', ');
$('localeOn').checked = prefs.localeEnabled;
$('fontOn').checked = prefs.fonts;
$('rtcOn').checked = prefs.rtc;
$('languageEditor').hidden = !prefs.languageEnabled;
renderRtc();
renderConsistency();
}
$('originalLanguages').textContent = originalLanguages.join(', ');
$('nativeLocale').textContent = originalLocale;
function showOptions(root, found, field, countId, max = 90) {
const fragment = document.createDocumentFragment();
for (const item of found.slice(0,max)) {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'option';
btn.textContent = item.label || item.code;
btn.addEventListener('click', () => {
$(field).value = item.code;
$(root).hidden = true;
});
fragment.appendChild(btn);
}
$(root).replaceChildren(fragment);
$(countId).textContent = `Showing ${Math.min(max,found.length)} / ${found.length}`;
$(root).hidden = found.length === 0;
layout();
}
$('tzInput').value = prefs.timezone === SYSTEM ? '' : prefs.timezone;
function tzResults() {
const q = $('tzInput').value;
const {items,hint} = timezoneMatches(q);
showOptions('tzOptions',items,'tzInput','tzCount',75);
$('tzCount').textContent = `${items.length} results${hint ? ' · '+hint : ''}`;
}
$('tzInput').addEventListener('input', tzResults);
$('tzSave').addEventListener('click', () => {
const raw = $('tzInput').value.trim();
const valid = validZone(raw);
if (!valid) return message('Choose a suggestion or enter a valid timezone, GMT offset, or recognized abbreviation.',true);
setting('timezone',valid,true);
});
$('tzSystem').addEventListener('click', () => {
$('tzInput').value = '';
setting('timezone',SYSTEM,true);
});
$('regionInput').value = prefs.region;
function rankedOptions(items, query) {
const q=query.trim().toLowerCase().replace(/[_-]/g,' ');
if (!q) return items.slice(0,90);
return items.map(item => {
const code=item.code.toLowerCase().replace(/[_-]/g,' ');
const label=item.label.toLowerCase().replace(/[_-]/g,' ');
const words=q.split(/\s+/);
const score=code===q ? 0 : label===q ? 1 : code.startsWith(q) ? 2
: label.startsWith(q) ? 3 : label.split(/[^a-z0-9]+/).some(w=>w.startsWith(q)) ? 5
: words.every(w=>label.includes(w)||code.includes(w)) ? 10 : 100;
return {item,score};
}).filter(x=>x.score<100).sort((a,b)=>a.score-b.score || a.item.label.localeCompare(b.item.label))
.map(x=>x.item);
}
function regionResults() {
const q=$('regionInput').value.trim();
const aliases={usa:'US',america:'US',uk:'GB',britain:'GB',england:'GB',uae:'AE',korea:'KR'};
const match=aliases[q.toLowerCase()];
const options=rankedOptions(countries,q);
if (match) {
const first=countries.find(x=>x.code===match);
if (first) options.unshift(first);
}
showOptions('regionOptions', [...new Map(options.map(x=>[x.code,x])).values()],
'regionInput','regionCount',90);
}
$('regionInput').addEventListener('input',regionResults);
$('regionOn').addEventListener('change',e=>{
setting('regionEnabled',e.target.checked,true);
runConsistencyCheck();
});
$('regionSave').addEventListener('click',()=>{
const value = validRegion($('regionInput').value);
if (!value) return message('Unknown country or region. Enter a 2-letter ISO 3166-1 code.',true);
$('regionInput').value = value;
setting('region',value,true);
runConsistencyCheck();
});
$('matchOn').addEventListener('change',e=>setting('matchLanguageRegions',e.target.checked,true));
function localeResults() {
const q=$('localeInput').value.trim().toLowerCase();
showOptions('localeOptions',rankedOptions(languageLabels,q),
'localeInput','localeCount',90);
}
$('localeInput').addEventListener('input',localeResults);
let languageDraft = [...prefs.languages];
function renderChips() {
const fragment = document.createDocumentFragment();
languageDraft.forEach((code,index) => {
const chip = document.createElement('div');
chip.className = 'chip';
const label = document.createElement('span');
label.textContent = code;
chip.appendChild(label);
for (const [txt,delta] of [['↑',-1],['↓',1]]) {
const btn = document.createElement('button');
btn.type = 'button'; btn.className = 'tiny'; btn.textContent = txt;
btn.disabled = index + delta < 0 || index + delta >= languageDraft.length;
btn.addEventListener('click', () => {
const other = index + delta;
[languageDraft[index],languageDraft[other]] = [languageDraft[other],languageDraft[index]];
renderChips();
});
chip.appendChild(btn);
}
const remove = document.createElement('button');
remove.type = 'button'; remove.className = 'tiny'; remove.textContent = '×';
remove.disabled = languageDraft.length < 2;
remove.addEventListener('click', () => {
languageDraft.splice(index,1);
renderChips();
});
chip.appendChild(remove);
fragment.appendChild(chip);
});
$('chips').replaceChildren(fragment);
layout();
}
function langResults() {
const q = $('languageInput').value.toLowerCase().trim();
const found = rankedOptions(languageLabels,q);
showOptions('languageOptions',found,'languageInput','languageCount');
}
$('languageInput').addEventListener('input', langResults);
function addLanguage() {
const code = validLanguage($('languageInput').value);
if (!code) return message('Invalid BCP-47 language tag.',true);
if (!languageDraft.includes(code)) languageDraft.push(code);
$('languageInput').value = '';
renderChips(); langResults();
}
$('languageAdd').addEventListener('click',addLanguage);
$('languageSave').addEventListener('click', () => {
const valid = validLanguages(languageDraft);
if (!valid) return message('Add at least one valid language.',true);
setting('languages',valid,true);
});
$('languageOn').addEventListener('change', e => {
setting('languageEnabled',e.target.checked,true);
});
$('localeInput').value = prefs.locale;
$('localeOn').addEventListener('change', e => {
setting('localeEnabled',e.target.checked,true);
});
$('localeSave').addEventListener('click', () => {
const v = validLanguage($('localeInput').value);
if (!v) return message('Invalid BCP-47 locale.',true);
setting('locale',v,true);
});
$('fontOn').addEventListener('change',e => setting('fonts',e.target.checked,true));
$('rtcOn').addEventListener('change',e => {
if (setting('rtc',e.target.checked,false)) runRtcCheck();
});
$('ipConsistencyOn').addEventListener('change',e=>{
if (setting('ipConsistency',e.target.checked,false)) runConsistencyCheck();
});
$('consistencyRetry').addEventListener('click',()=>{
if (prefs.ipConsistency) runConsistencyCheck(true);
else echoHeaders(true).finally(renderCoverage);
if (prefs.rtc) runRtcCheck();
});
$('rtcRetry').addEventListener('click', () => {
if (!prefs.rtc) return message('Enable automatic WebRTC checks first.',true);
runRtcCheck();
});
$('reset').addEventListener('click', () => {
if (!page.confirm('Restore default settings? Your floating button position will be kept.')) return;
const next = {...defaultConfig, languages:[...originalLanguages], locale:originalLocale};
const reloadKeys = ['timezone','languageEnabled','matchLanguageRegions','languages','regionEnabled','region','localeEnabled','locale','fonts','mailEnabled','mailSites'];
const queued = { before:{}, keys:[] };
for (const key of reloadKeys) {
if (JSON.stringify(prefs[key]) !== JSON.stringify(next[key])) {
queued.before[key] = structuredCloneSafe(prefs[key]); queued.keys.push(key);
}
}
prefs = structuredCloneSafe(next);
applied.rtc = prefs.rtc;
applied.ipConsistency = prefs.ipConsistency;
if (!verifySync('rtc')) { prefs.rtc = false; applied.rtc = false; }
persist();
GM_setValue(PENDING_KEY, queued.keys.length ? queued : null);
languageDraft = [...prefs.languages];
$('localeInput').value = prefs.locale;
$('tzInput').value = '';
renderChips();
$('regionInput').value=prefs.region;
syncControls();
runRtcCheck(); runConsistencyCheck(true);
if (queued.keys.length && page.confirm('Defaults saved. Reload now to apply and verify them?')) {
page.location.reload();
} else {
message('Defaults saved. A manual reload may be needed to apply all changes.');
}
});
let mailDraft = null;
let expandedMailId = null;
function renderMailSettings() {
  $('mailMaster').checked = mailDraft.mailEnabled;
  const container = document.createDocumentFragment();
  for (const provider of mailProviders) {
    const entry = mailDraft.mailSites[provider.id];
    const item = document.createElement('div'); item.className = 'mail-service';
    const row = document.createElement('div'); row.className = 'mail-row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = entry.enabled;
    check.setAttribute('aria-label','Enable ' + provider.name);
    check.addEventListener('change',()=>{entry.enabled=check.checked;});
    const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'mail-expand';
    expand.textContent = provider.name + (expandedMailId === provider.id ? ' ⌃' : ' ⌄');
    expand.addEventListener('click',()=>{expandedMailId=expandedMailId===provider.id?null:provider.id;renderMailSettings();});
    row.append(check,expand);item.appendChild(row);
    if (expandedMailId === provider.id) {
      const options = document.createElement('div'); options.className = 'mail-features';
      for (const [key,label] of Object.entries(mailFeatureLabels)) {
        const line=document.createElement('label');
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=entry.features[key];
        cb.addEventListener('change',()=>{entry.features[key]=cb.checked;});
        line.append(cb,document.createTextNode(label));options.appendChild(line);
      }
      item.appendChild(options);
    }
    container.appendChild(item);
  }
  $('mailSiteList').replaceChildren(container);layout();
}
$('mailManage').addEventListener('click', () => {
  mailDraft = { mailEnabled:prefs.mailEnabled,mailSites:normalizeMailSites(prefs.mailSites) };
  expandedMailId = null;
  $('mainView').hidden = true;$('mailView').hidden = false;
  panel.scrollTop=0;renderMailSettings();
});
$('mailMaster').addEventListener('change',e=>{mailDraft.mailEnabled=e.target.checked;});
$('mailBack').addEventListener('click',()=>{
  $('mailView').hidden=true;$('mainView').hidden=false;panel.scrollTop=0;layout();
});
$('mailClose').addEventListener('click',()=>{clearMessage();panel.hidden=true;});
$('mailSave').addEventListener('click', () => {
  prefs.mailEnabled=mailDraft.mailEnabled;
  prefs.mailSites=normalizeMailSites(mailDraft.mailSites);
  persist();
  $('mailView').hidden=true;$('mainView').hidden=false;panel.scrollTop=0;
  syncControls();layout();
  if (mailService) {
    if (page.confirm('Mail settings saved. Reload now to apply and verify them?')) page.location.reload();
    else message('Saved. Reload manually to apply changes to this mail page.');
  } else message('Mail settings saved. They will apply when selected mail sites load.');
});
showPanel = () => {
languageDraft = [...prefs.languages];
renderChips();
$('mainView').hidden=false;$('mailView').hidden=true;
panel.hidden = false;
syncControls(); tzResults(); langResults(); regionResults(); localeResults(); layout();
};
function closePanel() { clearMessage(); panel.hidden = true; }
fab.addEventListener('click', () => {
if (performance.now() - lastDragEnded < 400) return;
if (panel.hidden) showPanel();
else closePanel();
});
$('close').addEventListener('click', closePanel);
page.addEventListener('keydown',e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
document.body.appendChild(host);
applyPosition();
syncControls();
if (restoredMessage) message(restoredMessage, /failed|could not|unavailable/i.test(restoredMessage));
const observer = new MutationObserver(() => {
if (document.body && !host.isConnected) {
document.body.appendChild(host);
applyPosition();
}
});
observer.observe(document.documentElement,{ childList:true });
}
