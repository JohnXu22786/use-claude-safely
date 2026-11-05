function verifySync(key) {
try {
switch (key) {
case 'timezone': {
if (applied.timezone === SYSTEM) return true;
const actual = new page.Intl.DateTimeFormat().resolvedOptions().timeZone;
const expected = validZone(applied.timezone);
if (actual !== expected) return false;
const sample = new NativeDate();
const dtf = new NativeDTF('en-US-u-ca-gregory-nu-latn', {
timeZone: applied.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const p = Object.fromEntries(dtf.formatToParts(sample).filter(x => x.type !== 'literal')
.map(x => [x.type, Number(x.value)]));
return sample.getFullYear() === p.year && sample.getMonth() + 1 === p.month &&
sample.getDate() === p.day && sample.getHours() === p.hour;
}
case 'languageEnabled':
case 'matchLanguageRegions':
case 'languages': {
if (!applied.languageEnabled && !applied.matchLanguageRegions) return true;
const expected = effectiveLanguages(applied);
return page.navigator.language === expected[0] &&
JSON.stringify([...page.navigator.languages]) === JSON.stringify(expected);
}
case 'localeEnabled':
case 'locale':
case 'regionEnabled':
case 'region':
return (!applied.localeEnabled && !applied.regionEnabled) ||
new page.Intl.DateTimeFormat().resolvedOptions().locale ===
(applied.regionEnabled ? effectiveLocale(applied) :
new NativeDTF(effectiveLocale(applied)).resolvedOptions().locale);
case 'ipConsistency': return true;
case 'fonts': {
if (!applied.fonts) return true;
const canvas = page.document.createElement('canvas');
const ctx = canvas.getContext('2d');
if (!ctx) return false;
ctx.font = '18px "Microsoft YaHei", monospace';
const a = ctx.measureText('Test text').width;
ctx.font = '18px monospace';
const b = ctx.measureText('Test text').width;
if (Math.abs(a - b) > 0.01) return false;
if (page.document.fonts?.check?.('18px "Microsoft YaHei"') !== false) return false;
return true;
}
case 'rtc': return !applied.rtc || typeof page.RTCPeerConnection === 'function';
default: return true;
}
} catch { return false; }
}
let restoredMessage = GM_getValue(NOTICE_KEY, '');
if (restoredMessage) GM_setValue(NOTICE_KEY, '');
const pending = GM_getValue(PENDING_KEY, null);
if (pending && typeof pending === 'object' && pending.before && Array.isArray(pending.keys)) {
const failed = pending.keys.filter(key => !verifySync(key));
if (failed.length) {
for (const key of failed) { prefs[key] = pending.before[key]; applied[key] = pending.before[key]; }
persist();
restoredMessage = `Verification failed for ${failed.join(', ')}. Previous values restored. Reload manually to restore page behavior.`;
GM_setValue(NOTICE_KEY, restoredMessage);
} else {
restoredMessage = 'Saved settings passed JavaScript checks after reload.';
}
GM_setValue(PENDING_KEY, null);
}
if (applied.fonts && !verifySync('fonts')) {
applied.fonts = false;
prefs.fonts = false;
persist();
restoredMessage = 'Font protection could not be verified and was switched off.';
}
if (applied.rtc && !verifySync('rtc')) {
applied.rtc = false;
prefs.rtc = false;
persist();
restoredMessage = 'WebRTC checking is unavailable in this browser and was switched off.';
}
function commit(key, value, requireReload) {
if (!Object.prototype.hasOwnProperty.call(prefs, key)) return { ok: false, info: 'Unknown setting.' };
const before = structuredCloneSafe(prefs[key]);
if (JSON.stringify(before) === JSON.stringify(value)) return { ok: true, info: 'Already selected.' };
if (requireReload) {
let queue = GM_getValue(PENDING_KEY, null);
if (!queue || !queue.before || !Array.isArray(queue.keys)) queue = { before: {}, keys: [] };
if (!queue.keys.includes(key)) { queue.keys.push(key); queue.before[key] = before; }
prefs[key] = value;
persist();
GM_setValue(PENDING_KEY, queue);
const approve = page.confirm('Setting saved. Reload this page now to apply and verify it?');
if (approve) page.location.reload();
return { ok: true, info: approve ? 'Reloading for verification...' : 'Saved. Reload manually when ready; verification will run then.' };
}
prefs[key] = value;
applied[key] = value;
if (!verifySync(key)) {
prefs[key] = before;
applied[key] = before;
return { ok: false, info: 'Verification failed. The switch has returned to its previous state.' };
}
persist();
return { ok: true, info: 'Setting passed its JavaScript check.' };
}
