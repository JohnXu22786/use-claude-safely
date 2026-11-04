// ==UserScript==
// @name         Claude / Anthropic - Environment Manager
// @namespace    https://userscripts.local/claude-anthropic-timezone
// @description  Environment settings for Claude and webmail; cached IANA data and real in-page header verification.
// @match        https://claude.ai/*
// @match        https://*.claude.ai/*
// @match        https://claude.com/*
// @match        https://*.claude.com/*
// @match        https://anthropic.com/*
// @match        https://*.anthropic.com/*
// @match        https://claudeusercontent.com/*
// @match        https://*.claudeusercontent.com/*
// @match        https://mail.google.com/*
// @match        https://outlook.live.com/*
// @match        https://outlook.office.com/*
// @match        https://outlook.office365.com/*
// @match        https://outlook.cloud.microsoft/*
// @match        https://mail.yahoo.com/*
// @match        https://www.icloud.com/mail*
// @match        https://mail.proton.me/*
// @match        https://app.tuta.com/*
// @match        https://app.fastmail.com/*
// @match        https://mail.zoho.com/*
// @match        https://mail.aol.com/*
// @match        https://mail.gmx.com/*
// @match        https://www.gmx.net/*
// @match        https://app.hey.com/*
// @match        https://mail.yandex.com/*
// @match        https://mail.yandex.ru/*
// @match        https://mail.qq.com/*
// @match        https://mail.163.com/*
// @match        https://mail.126.com/*
// @match        https://mail.yeah.net/*
// @match        https://mail.sina.com.cn/*
// @match        https://mail.naver.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @connect      api.ipify.org
// @connect      ipapi.co
// @connect      ipv4.icanhazip.com
// @connect      checkip.amazonaws.com
// @connect      ipwho.is
// @connect      ipinfo.io
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// ==/UserScript==
(() => {
'use strict';
const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const CONFIG_KEY = 'environmentManagerPrefsV3';
const PENDING_KEY = 'environmentManagerPendingV3';
const NOTICE_KEY = 'environmentManagerNoticeV3';
const POSITION_KEY = 'floatingButtonPositionV1';
const LEGACY_TZ_KEY = 'preferredIanaTimezone';
const SYSTEM = 'system';
const NativeDate = page.Date;
const NativeDTF = page.Intl.DateTimeFormat;
const systemZone = new NativeDTF().resolvedOptions().timeZone || 'UTC';
const originalLanguages = [...(page.navigator.languages || [page.navigator.language || 'en-US'])];
const originalLocale = new NativeDTF().resolvedOptions().locale || 'en-US';
const nativeLocaleCtor = page.Intl.Locale;
const defaultConfig = Object.freeze({
timezone: SYSTEM,
languageEnabled: false,
matchLanguageRegions: true,
regionEnabled: false,
region: 'US',
ipConsistency: true,
languages: originalLanguages.length ? originalLanguages : ['en-US'],
localeEnabled: false,
locale: originalLocale,
fonts: true,
rtc: true,
});
const zoneAliases = {
utc:'UTC', gmt:'UTC', z:'UTC', ut:'UTC',
pt:'America/Los_Angeles', pst:'America/Los_Angeles', pdt:'America/Los_Angeles',
et:'America/New_York', est:'America/New_York', edt:'America/New_York',
ct:'America/Chicago', cdt:'America/Chicago',
mt:'America/Denver', mdt:'America/Denver',
jst:'Asia/Tokyo', kst:'Asia/Seoul',
cet:'Europe/Paris', cest:'Europe/Paris',
bst:'Europe/London',
aest:'Australia/Brisbane', aedt:'Australia/Sydney',
acst:'Australia/Darwin', acdt:'Australia/Adelaide',
nzst:'Pacific/Auckland', nzdt:'Pacific/Auckland',
kolkata:'Asia/Kolkata', calcutta:'Asia/Calcutta',
beijing:'Asia/Shanghai', peking:'Asia/Shanghai',
kyiv:'Europe/Kyiv', kiev:'Europe/Kiev',
};
function parseOffset(input) {
if (typeof input !== 'string') return null;
let q = input.trim().toUpperCase().replace(/\s+/g,'');
if (/^(UTC|GMT|UT|Z)$/.test(q)) return 0;
q = q.replace(/^(UTC|GMT)/,'');
const m = /^([+-])(\d{1,2})(?:(?::(\d{1,2}))|(?:(\d{2})))?(?:\.(\d+))?$/.exec(q);
if (!m) return null;
const hours = Number(m[2]);
const minutes = m[3] != null ? Number(m[3]) : m[4] != null ? Number(m[4])
: m[5] != null ? Math.round(Number('0.'+m[5])*60) : 0;
if (hours > 23 || minutes > 59 || (hours===23 && minutes>59)) return null;
return (m[1] === '-' ? -1 : 1)*(hours*60+minutes);
}
function offsetText(minutes) {
const m = Math.abs(minutes);
return `${minutes < 0 ? '-' : '+'}${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function nativeZone(input) {
try { return new NativeDTF('en-US', {timeZone:input}).resolvedOptions().timeZone; }
catch { return null; }
}
function offsetZone(minutes) {
if (minutes === 0) return 'UTC';
const direct = nativeZone(offsetText(minutes));
if (direct) return direct;
if (minutes % 60 === 0 && Math.abs(minutes) <= 14 * 60)
return nativeZone(`Etc/GMT${minutes > 0 ? '-' : '+'}${Math.abs(minutes)/60}`);
return null;
}
function validZone(input) {
if (typeof input !== 'string') return null;
const q = input.trim();
if (q.toLowerCase() === SYSTEM) return SYSTEM;
const shorthand = zoneAliases[q.toLowerCase()];
if (shorthand) return nativeZone(shorthand);
const offset = parseOffset(q);
if (offset !== null) return offsetZone(offset);
return nativeZone(q);
}
function validLanguage(input) {
if (typeof input !== 'string') return null;
try {
const result = page.Intl.getCanonicalLocales(input.trim());
return result.length === 1 ? result[0] : null;
} catch { return null; }
}
function validLanguages(list) {
if (!Array.isArray(list)) return null;
const values = [];
for (const item of list) {
const v = validLanguage(item);
if (!v) return null;
if (!values.includes(v)) values.push(v);
}
return values.length ? values : null;
}
const countryTable = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ').map(code => [code, code]);
const countries = (() => {
const names = typeof page.Intl.DisplayNames === 'function'
? new page.Intl.DisplayNames(['en'], {type:'region'}) : null;
return countryTable.map(([code,name]) => ({code, label:`${names?.of(code) || name} (${code})`}))
.sort((a,b) => a.label.localeCompare(b.label, 'en'));
})();
const validRegions = new Set(countryTable.map(entry => entry[0]));
function validRegion(value) {
if (typeof value !== 'string') return null;
const v = value.trim();
const c = v.toUpperCase();
if (validRegions.has(c)) return c;
const hit = countries.find(item => item.label.toLowerCase() === v.toLowerCase() ||
item.label.replace(/\s*\([A-Z]{2}\)$/, '').toLowerCase() === v.toLowerCase());
return hit?.code || null;
}
function matchLanguageRegion(tag) {
try {
const loc = new nativeLocaleCtor(tag);
if (!loc.region) return loc.toString();
const guessed = new nativeLocaleCtor(loc.language + (loc.script ? `-${loc.script}` : '')).maximize().region;
return guessed && validRegions.has(guessed) ? new nativeLocaleCtor(tag, {region:guessed}).toString() : loc.toString();
} catch { return tag; }
}
function effectiveLanguages(config) {
const input = config.languageEnabled ? config.languages : originalLanguages;
const source = !config.languageEnabled && config.matchLanguageRegions
? input.map(matchLanguageRegion) : input;
return [...new Set(source)];
}
function effectiveLocale(config) {
let value = config.localeEnabled ? config.locale : originalLocale;
if (config.regionEnabled) {
try { value = new nativeLocaleCtor(value, { region:config.region }).toString(); }
catch { /* Verification will not claim that the region is masked. */ }
}
return value;
}
function sanitize(raw) {
const oldTimezone = GM_getValue(LEGACY_TZ_KEY, SYSTEM);
const input = raw && typeof raw === 'object' ? raw : {};
return {
timezone: validZone(input.timezone || oldTimezone) || SYSTEM,
languageEnabled: input.languageEnabled === true,
matchLanguageRegions: input.matchLanguageRegions !== false,
regionEnabled: input.regionEnabled === true,
region: validRegion(input.region) || 'US',
ipConsistency: input.ipConsistency !== false,
languages: validLanguages(input.languages) || defaultConfig.languages.slice(),
localeEnabled: input.localeEnabled === true,
locale: validLanguage(input.locale) || originalLocale,
fonts: input.fonts !== false,
rtc: input.rtc !== false,
};
}
let prefs = sanitize(GM_getValue(CONFIG_KEY, null));
const applied = structuredCloneSafe(prefs);
const zone = applied.timezone;
function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }
function persist() { GM_setValue(CONFIG_KEY, structuredCloneSafe(prefs)); }
function installLanguageOverride() {
if (!applied.languageEnabled && !applied.matchLanguageRegions) return;
const languages = Object.freeze(effectiveLanguages(applied));
try {
Object.defineProperty(page.navigator, 'language', { configurable: true, get: () => languages[0] });
Object.defineProperty(page.navigator, 'languages', { configurable: true, get: () => [...languages] });
} catch { /* Verification will trigger a settings rollback. */ }
}
function installLocaleOverride() {
if (!applied.localeEnabled && !applied.regionEnabled) return;
const locale = effectiveLocale(applied);
const constructors = ['DateTimeFormat', 'NumberFormat', 'Collator', 'PluralRules',
'RelativeTimeFormat', 'ListFormat', 'DisplayNames', 'Segmenter'];
for (const key of constructors) {
const Native = page.Intl[key];
if (typeof Native !== 'function') continue;
function Localized(locales, options) {
const useDefault = locales == null;
const instance = new Native(useDefault ? locale : locales, options);
if (useDefault && applied.regionEnabled && typeof instance.resolvedOptions === 'function') {
const originalResolved = instance.resolvedOptions.bind(instance);
Object.defineProperty(instance, 'resolvedOptions', {
configurable:true,
value:() => ({...originalResolved(),locale}),
});
}
return instance;
}
Object.setPrototypeOf(Localized, Native);
Localized.prototype = Native.prototype;
try { Object.defineProperty(Localized, 'name', { value: key }); page.Intl[key] = Localized; }
catch { /* Unpatchable browser object; see verification. */ }
}
for (const method of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
const nativeMethod = NativeDate.prototype[method];
if (typeof nativeMethod === 'function') {
NativeDate.prototype[method] = function (locales, options) {
return nativeMethod.call(this, locales == null ? locale : locales, options);
};
}
}
for (const proto of [page.Number?.prototype, page.BigInt?.prototype]) {
if (!proto || typeof proto.toLocaleString !== 'function') continue;
const original = proto.toLocaleString;
proto.toLocaleString = function (locales, options) {
return original.call(this, locales == null ? locale : locales, options);
};
}
}
installLanguageOverride();
if (zone !== SYSTEM) {
const dtfParts = new NativeDTF('en-US-u-ca-gregory-nu-latn', {
timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dtfLongName = new NativeDTF('en-US', { timeZone: zone, timeZoneName: 'long' });
const cache = new Map();
const nativeGetTime = NativeDate.prototype.getTime;
const nativeSetTime = NativeDate.prototype.setTime;
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function utcFromFields(p) {
const d = new NativeDate(0);
d.setUTCFullYear(p.y, p.mo - 1, p.d);
d.setUTCHours(p.h, p.mi, p.s, p.ms || 0);
return d.getTime();
}
function partsAt(ms) {
if (!Number.isFinite(ms)) return null;
const sec = Math.floor(ms / 1000);
let p = cache.get(sec);
if (!p) {
const obj = {};
for (const part of dtfParts.formatToParts(new NativeDate(sec * 1000))) {
if (part.type !== 'literal') obj[part.type] = Number(part.value);
}
p = {
y: obj.year, mo: obj.month, d: obj.day,
h: obj.hour, mi: obj.minute, s: obj.second,
};
p.asUtc = utcFromFields({ ...p, ms: 0 });
p.offset = (sec * 1000 - p.asUtc) / 60000; // Same sign as getTimezoneOffset
cache.set(sec, p);
if (cache.size > 32) cache.delete(cache.keys().next().value);
}
return { ...p, ms: new NativeDate(ms).getUTCMilliseconds() };
}
function matchesLocal(a, b) {
return a && a.y === b.y && a.mo === b.mo && a.d === b.d &&
a.h === b.h && a.mi === b.mi && a.s === b.s && a.ms === b.ms;
}
function epochFromLocal(local) {
const target = utcFromFields(local);
if (!Number.isFinite(target)) return NaN;
const offsets = new Set();
for (const delta of [-129600000, -86400000, 0, 86400000, 129600000]) {
const p = partsAt(target + delta);
if (p) offsets.add(p.offset);
}
const candidates = [...offsets].map(offset => {
const instant = target + offset * 60000;
const actual = partsAt(instant);
return { instant, actual, localUtc: actual ? utcFromFields(actual) : NaN };
}).filter(x => Number.isFinite(x.instant));
const exact = candidates.filter(x => matchesLocal(x.actual, local));
if (exact.length) return Math.min(...exact.map(x => x.instant));
const later = candidates.filter(x => x.localUtc >= target)
.sort((a, b) => a.localUtc - b.localUtc);
if (later.length) return later[0].instant;
return candidates.length ? candidates[candidates.length - 1].instant : NaN;
}
function patchGet(name, property) {
Object.defineProperty(NativeDate.prototype, name, {
configurable: true, writable: true,
value: function () {
const p = partsAt(nativeGetTime.call(this));
return p ? p[property] : NaN;
},
});
}
for (const [name, prop] of Object.entries({
getFullYear: 'y', getMonth: 'mo', getDate: 'd',
getHours: 'h', getMinutes: 'mi', getSeconds: 's',
})) {
if (name === 'getMonth') {
Object.defineProperty(NativeDate.prototype, name, {
configurable: true, writable: true,
value: function () {
const p = partsAt(nativeGetTime.call(this));
return p ? p.mo - 1 : NaN;
},
});
} else patchGet(name, prop);
}
NativeDate.prototype.getDay = function () {
const p = partsAt(nativeGetTime.call(this));
if (!p) return NaN;
return new NativeDate(utcFromFields({ ...p, h: 0, mi: 0, s: 0, ms: 0 })).getUTCDay();
};
NativeDate.prototype.getYear = function () { return this.getFullYear() - 1900; };
NativeDate.prototype.getTimezoneOffset = function () {
const p = partsAt(nativeGetTime.call(this));
return p ? p.offset : NaN;
};
function localSetter(method, args, dateOnInvalid) {
const ms = nativeGetTime.call(this);
const p = partsAt(ms) || (dateOnInvalid ?
{ y: 1970, mo: 1, d: 1, h: 0, mi: 0, s: 0, ms: 0 } : null);
if (!p) return nativeSetTime.call(this, NaN);
const scratch = new NativeDate(utcFromFields(p));
const normalizedMethod = 'setUTC' + method.slice(3);
const result = NativeDate.prototype[normalizedMethod].apply(scratch, args);
if (!Number.isFinite(result)) return nativeSetTime.call(this, NaN);
const local = {
y: scratch.getUTCFullYear(), mo: scratch.getUTCMonth() + 1,
d: scratch.getUTCDate(), h: scratch.getUTCHours(),
mi: scratch.getUTCMinutes(), s: scratch.getUTCSeconds(),
ms: scratch.getUTCMilliseconds(),
};
return nativeSetTime.call(this, epochFromLocal(local));
}
for (const name of ['setFullYear', 'setMonth', 'setDate', 'setHours',
'setMinutes', 'setSeconds', 'setMilliseconds']) {
NativeDate.prototype[name] = function (...args) {
return localSetter.call(this, name, args, name === 'setFullYear');
};
}
NativeDate.prototype.setYear = function (year) {
const n = Number(year);
return this.setFullYear(Number.isNaN(n) ? NaN : (n >= 0 && n <= 99 ? n + 1900 : n));
};
function localIsoString(s) {
if (typeof s !== 'string') return null;
const m = /^(\d{4})-(\d\d)-(\d\d)[Tt ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,}))?)?$/.exec(s);
if (!m) return null;
const local = {
y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5],
s: +(m[6] || 0), ms: +((m[7] || '').slice(0, 3).padEnd(3, '0')),
};
if (local.mo < 1 || local.mo > 12 || local.d < 1 || local.d > 31 ||
local.h > 24 || local.mi > 59 || local.s > 59 ||
(local.h === 24 && (local.mi || local.s || local.ms))) return NaN;
const scratch = new NativeDate(utcFromFields(local));
if (scratch.getUTCFullYear() !== local.y || scratch.getUTCMonth() + 1 !== local.mo ||
scratch.getUTCDate() !== local.d || scratch.getUTCHours() !== local.h) {
if (local.h !== 24 || scratch.getUTCHours() !== 0) return NaN;
}
if (local.h === 24) {
const normalized = new NativeDate(utcFromFields(local));
local.y = normalized.getUTCFullYear();
local.mo = normalized.getUTCMonth() + 1;
local.d = normalized.getUTCDate();
local.h = 0;
}
return epochFromLocal(local);
}
function TimezoneDate(...args) {
if (!new.target) return new TimezoneDate().toString();
const finish = value => {
if (new.target !== TimezoneDate) {
Object.setPrototypeOf(value, new.target.prototype);
}
return value;
};
if (args.length === 0) return finish(new NativeDate());
if (args.length === 1) {
const parsed = localIsoString(args[0]);
return finish(new NativeDate(parsed === null ? args[0] : parsed));
}
const p = {
y: Number(args[0]), mo: Number(args[1]) + 1,
d: args.length > 2 ? Number(args[2]) : 1,
h: args.length > 3 ? Number(args[3]) : 0,
mi: args.length > 4 ? Number(args[4]) : 0,
s: args.length > 5 ? Number(args[5]) : 0,
ms: args.length > 6 ? Number(args[6]) : 0,
};
if (p.y >= 0 && p.y <= 99) p.y += 1900;
return finish(new NativeDate(epochFromLocal(p)));
}
Object.setPrototypeOf(TimezoneDate, NativeDate);
TimezoneDate.prototype = NativeDate.prototype;
Object.defineProperty(NativeDate.prototype, 'constructor', { value: TimezoneDate, configurable: true, writable: true });
Object.defineProperty(TimezoneDate, 'name', { value: 'Date' });
TimezoneDate.parse = s => {
const parsed = localIsoString(String(s));
return parsed === null ? NativeDate.parse(s) : parsed;
};
page.Date = TimezoneDate;
function localDateText(p) {
const dow = new NativeDate(utcFromFields({ ...p, h: 0, mi: 0, s: 0, ms: 0 })).getUTCDay();
return `${weekdays[dow]} ${months[p.mo - 1]} ${String(p.d).padStart(2, '0')} ${String(p.y).padStart(4, '0')}`;
}
function localTimeText(ms, p) {
const fmt = n => String(n).padStart(2, '0');
const minutes = -p.offset;
const sign = minutes >= 0 ? '+' : '-';
const abs = Math.abs(Math.round(minutes));
const gmt = `GMT${sign}${fmt(Math.floor(abs / 60))}${fmt(abs % 60)}`;
const displayName = dtfLongName.formatToParts(new NativeDate(ms))
.find(x => x.type === 'timeZoneName')?.value || zone;
return `${fmt(p.h)}:${fmt(p.mi)}:${fmt(p.s)} ${gmt} (${displayName})`;
}
NativeDate.prototype.toDateString = function () {
const p = partsAt(nativeGetTime.call(this));
return p ? localDateText(p) : 'Invalid Date';
};
NativeDate.prototype.toTimeString = function () {
const ms = nativeGetTime.call(this);
const p = partsAt(ms);
return p ? localTimeText(ms, p) : 'Invalid Date';
};
NativeDate.prototype.toString = function () {
const ms = nativeGetTime.call(this);
const p = partsAt(ms);
return p ? `${localDateText(p)} ${localTimeText(ms, p)}` : 'Invalid Date';
};
function DateTimeFormat(locales, options) {
if (options != null && options.timeZone !== undefined) {
return new NativeDTF(locales, options);
}
return new NativeDTF(locales, { ...(options || {}), timeZone: zone });
}
Object.setPrototypeOf(DateTimeFormat, NativeDTF);
DateTimeFormat.prototype = NativeDTF.prototype;
Object.defineProperty(DateTimeFormat, 'name', { value: 'DateTimeFormat' });
page.Intl.DateTimeFormat = DateTimeFormat;
for (const [method, type] of [
['toLocaleString', 'datetime'],
['toLocaleDateString', 'date'],
['toLocaleTimeString', 'time'],
]) {
const original = NativeDate.prototype[method];
NativeDate.prototype[method] = function (locales, options) {
if (!Number.isFinite(nativeGetTime.call(this))) return 'Invalid Date';
if (options != null && options.timeZone !== undefined) {
return original.call(this, locales, options);
}
const opts = { ...(options || {}), timeZone: zone };
if (!options || !Object.keys(options).length) {
if (type !== 'time') Object.assign(opts, { year: 'numeric', month: 'numeric', day: 'numeric' });
if (type !== 'date') Object.assign(opts, { hour: 'numeric', minute: 'numeric', second: 'numeric' });
}
const defaultLocale = (applied.localeEnabled || applied.regionEnabled) ? effectiveLocale(applied) : locales;
return new NativeDTF(locales == null ? defaultLocale : locales, opts).format(this);
};
}
try {
if (page.Temporal?.Now?.timeZoneId) {
Object.defineProperty(page.Temporal.Now, 'timeZoneId', {
value: () => zone, configurable: true, writable: true,
});
}
} catch { /* Some browser implementations disallow this override. */ }
}
installLocaleOverride();
const fontGroups = {
windows: `Microsoft YaHei|Microsoft YaHei UI|Microsoft YaHei Light|Microsoft YaHei UI Light|SimSun|NSimSun|SimSun-ExtB|SimSun-ExtG|SimHei|SimHei-ExtB|DengXian|DengXian Light|FangSong|FangSong_GB2312|KaiTi|KaiTi_GB2312|LiSu|YouYuan|STFangsong|STHeiti|STKaiti|STSong|STXihei|STZhongsong|STLiti|STCaiyun|STHupo|STXinwei|STXingkai|STYuan|MingLiU|PMingLiU|MingLiU_HKSCS|MingLiU-ExtB|PMingLiU-ExtB|MingLiU_HKSCS-ExtB|Microsoft JhengHei|Microsoft JhengHei UI|Microsoft JhengHei Light|Microsoft JhengHei UI Light|DFKai-SB|Arial Unicode MS|MS Song|MS Hei|BiauKai|MingLiU_HKSCS|SimKai|SimFang|Microsoft Himalaya|Microsoft New Tai Lue`,
apple: `PingFang SC|PingFang TC|PingFang HK|PingFang|Heiti SC|Heiti TC|Songti SC|Songti TC|Kaiti SC|Kaiti TC|Baoli SC|Baoli TC|Hiragino Sans GB|Hiragino Sans CNS|Hiragino Sans|Hiragino Mincho ProN|STSongti-SC-Regular|STSongti-TC-Regular|STKaiti-SC-Regular|STKaiti-TC-Regular|STHeitiSC-Light|STHeitiTC-Light|Apple LiGothic|Apple LiSung|LiHei Pro|LiSong Pro|Lantinghei SC|Lantinghei TC|Wawati SC|Wawati TC|Weibei SC|Weibei TC|Hanzipen SC|Hanzipen TC|Xingkai SC|Xingkai TC`,
opensource: `Noto Sans CJK SC|Noto Sans CJK TC|Noto Sans CJK HK|Noto Sans SC|Noto Sans TC|Noto Serif CJK SC|Noto Serif CJK TC|Noto Serif CJK HK|Noto Serif SC|Noto Serif TC|Noto Sans Mono CJK SC|Noto Sans Mono CJK TC|Source Han Sans SC|Source Han Sans TC|Source Han Sans HC|Source Han Sans CN|Source Han Sans TW|Source Han Sans|Source Han Serif SC|Source Han Serif TC|Source Han Serif CN|Source Han Serif TW|Source Han Serif|Source Han Mono SC|Source Han Mono TC|WenQuanYi Micro Hei|WenQuanYi Zen Hei|WenQuanYi Bitmap Song|AR PL UMing CN|AR PL UMing TW|AR PL UKai CN|AR PL UKai TW|AR PL SungtiL GB|AR PL KaitiM GB|Droid Sans Fallback|Droid Sans Chinese|Droid Sans Chinese Fallback|Droid Sans CJK|Droid Sans CJK SC|Droid Sans CJK TC|Sarasa Gothic SC|Sarasa Gothic TC|Sarasa UI SC|Sarasa UI TC|LXGW WenKai|LXGW WenKai Lite|LXGW WenKai Screen|HarmonyOS Sans SC|HarmonyOS Sans TC`,
vendors: `HarmonyOS Sans|HarmonyOS Sans Naskh Arabic|MiSans|MiSans VF|MiSans L3|MiSans Normal|OPPO Sans|OPPOSans|OPPO Sans 3.0|vivo Sans|vivo Sans 2.0|vivo Sans 3.0|HONOR Sans|Honor Sans|HONOR Sans CN|OnePlus Sans|OnePlus Sans 3.0|realme Sans|ColorOS Sans|Alibaba PuHuiTi|Alibaba PuHuiTi 2.0|Alibaba PuHuiTi 3.0|Alimama ShuHeiTi|Tencent Sans|TencentSans|Douyin Sans|ByteDance Sans|Smiley Sans|MIUI Sans|MIUI|WPS Office|WPS Song|WPS Hei|FZSong|FZHei|FZKai|FZFangSong|FZShuSong|FZLanTingHei|FZLanTingHeiS|Founder Type|FZNewShuSong|FZYaoTi|FZCuHeiSong|FZLiShu|FZWeiBei|FZDaHei-B02|FZKai-Z03|HYQiHei|HYHeiTi|HYSongTi|HYSong|HYKaiTi|HanYi|HanYi QiHei|Hanyi Senty|Kingsoft Office|Kingsoft UI`,
};
const localAliasNames = [
'\u5fae\u8f6f\u96c5\u9ed1', '\u5fae\u8f6f\u96c5\u9ed1UI', '\u5b8b\u4f53',
'\u65b0\u5b8b\u4f53', '\u9ed1\u4f53', '\u7b49\u7ebf', '\u4eff\u5b8b',
'\u6977\u4f53', '\u96b6\u4e66', '\u5e7c\u5706', '\u534e\u6587\u7ec6\u9ed1',
'\u534e\u6587\u9ed1\u4f53', '\u534e\u6587\u5b8b\u4f53', '\u534e\u6587\u6977\u4f53',
'\u534e\u6587\u4eff\u5b8b', '\u534e\u6587\u4e2d\u5b8b', '\u534e\u6587\u884c\u6977',
'\u534e\u6587\u96b6\u4e66', '\u534e\u6587\u65b0\u9b4f', '\u65b9\u6b63\u5170\u4ead\u9ed1',
'\u82f9\u65b9', '\u601d\u6e90\u9ed1\u4f53', '\u601d\u6e90\u5b8b\u4f53',
'\u9e3f\u8499\u9ed1\u4f53', '\u5c0f\u7c73\u5170\u4ead', '\u963f\u91cc\u5df4\u5df4\u666e\u60e0\u4f53',
'\u6c49\u4eea\u65d7\u9ed1', '\u6c49\u4eea\u5b8b\u4f53', '\u534e\u6587\u5f69\u4e91',
'\u534e\u6587\u7425\u73c0', '\u65b9\u6b63\u8212\u4f53', '\u65b9\u6b63\u59da\u4f53',
'\u51ac\u9752\u9ed1\u4f53', '\u4eff\u5b8b_GB2312', '\u6977\u4f53_GB2312',
'\u65b0\u7ec6\u660e\u4f53', '\u7ec6\u660e\u4f53', '\u6b63\u9ed1\u4f53',
];
const fontFamilies = [...new Set([...Object.values(fontGroups).flatMap(s => s.split('|')),
...localAliasNames])].filter(Boolean);
const fontTestPattern = new RegExp(fontFamilies
.sort((a, b) => b.length - a.length)
.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
.join('|'), 'i');
function containsProtectedFont(text) { return typeof text === 'string' && fontTestPattern.test(text); }
function fallbackFor(font) {
const match = String(font).match(/,\s*(monospace|sans-serif|serif)\s*$/i);
return match ? match[1] : 'sans-serif';
}
function installFontMask() {
const Ctx2D = page.CanvasRenderingContext2D?.prototype;
if (Ctx2D && typeof Ctx2D.measureText === 'function') {
const original = Ctx2D.measureText;
Ctx2D.measureText = function (...args) {
if (!applied.fonts || !containsProtectedFont(this.font)) return original.apply(this, args);
const oldFont = this.font;
try {
this.font = oldFont.replace(/\s+((?:["'][^"']+["']|[^\s,]+)(?:\s*,.*)?)$/, (_, families) => ' ' + fallbackFor(families));
if (containsProtectedFont(this.font)) this.font = '16px ' + fallbackFor(oldFont);
return original.apply(this, args);
} finally { this.font = oldFont; }
};
}
const Offscreen = page.OffscreenCanvasRenderingContext2D?.prototype;
if (Offscreen && Offscreen !== Ctx2D && typeof Offscreen.measureText === 'function') {
const original = Offscreen.measureText;
Offscreen.measureText = function (...args) {
if (!applied.fonts || !containsProtectedFont(this.font)) return original.apply(this, args);
const previous = this.font;
try {
this.font = previous.replace(/\s+((?:["'][^"']+["']|[^\s,]+)(?:\s*,.*)?)$/, (_, families) => ' ' + fallbackFor(families));
if (containsProtectedFont(this.font)) this.font = '16px ' + fallbackFor(previous);
return original.apply(this, args);
} finally { this.font = previous; }
};
}
const ffp = page.FontFaceSet?.prototype;
if (ffp && typeof ffp.check === 'function') {
const nativeCheck = ffp.check;
ffp.check = function (font, text) {
return applied.fonts && containsProtectedFont(font) ? false : nativeCheck.call(this, font, text);
};
}
if (typeof page.queryLocalFonts === 'function') {
const original = page.queryLocalFonts.bind(page);
try {
page.queryLocalFonts = async (...args) => {
const entries = await original(...args);
return applied.fonts ? entries.filter(f => !containsProtectedFont(
[f.family, f.fullName, f.postscriptName].join(' '))) : entries;
};
} catch { /* The browser may not expose a writable API. */ }
}
const nativeRect = page.Element?.prototype?.getBoundingClientRect;
const offWidth = Object.getOwnPropertyDescriptor(page.HTMLElement?.prototype || {}, 'offsetWidth');
const offHeight = Object.getOwnPropertyDescriptor(page.HTMLElement?.prototype || {}, 'offsetHeight');
let probing = false;
function substituteMetrics(el) {
if (!applied.fonts || probing || !el?.ownerDocument?.body || !el.isConnected) return null;
try {
const style = page.getComputedStyle(el);
if (!containsProtectedFont(style.fontFamily)) return null;
const hidden = style.visibility === 'hidden' || style.opacity === '0' ||
(/^(absolute|fixed)$/.test(style.position) &&
(parseFloat(style.left) < -250 || parseFloat(style.top) < -250));
if (!hidden) return null;
probing = true;
const node = el.ownerDocument.createElement('span');
node.style.cssText = `position:absolute!important;visibility:hidden!important;pointer-events:none!important;left:-100000px!important;top:-100000px!important;display:inline-block!important;white-space:${style.whiteSpace}!important;font-size:${style.fontSize}!important;font-style:${style.fontStyle}!important;font-weight:${style.fontWeight}!important;letter-spacing:${style.letterSpacing}!important;line-height:${style.lineHeight}!important;font-family:${fallbackFor(style.fontFamily)}!important`;
node.textContent = el.textContent || '';
el.ownerDocument.body.appendChild(node);
const rect = nativeRect.call(node);
node.remove();
return { width: rect.width, height: rect.height };
} catch { return null; }
finally { probing = false; }
}
if (nativeRect) {
page.Element.prototype.getBoundingClientRect = function () {
const real = nativeRect.call(this);
const metrics = substituteMetrics(this);
return metrics && typeof page.DOMRect === 'function'
? new page.DOMRect(real.x, real.y, metrics.width, metrics.height) : real;
};
}
for (const [desc, key] of [[offWidth, 'offsetWidth'], [offHeight, 'offsetHeight']]) {
if (desc?.configurable && typeof desc.get === 'function') {
Object.defineProperty(page.HTMLElement.prototype, key, {
configurable: true, enumerable: desc.enumerable,
get: function () {
const metrics = substituteMetrics(this);
return metrics ? Math.round(metrics[key === 'offsetWidth' ? 'width' : 'height']) : desc.get.call(this);
},
});
}
}
}
installFontMask();
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
const rtcState = { state: 'checking', details: 'Starting WebRTC check...', httpIPv4: null, httpIPs:[],ipDisagreement:false };
const subscribers = new Set();
function updateRtc(state, details) {
rtcState.state = state;
rtcState.details = details;
for (const callback of subscribers) { try { callback(); } catch {} }
if (prefs.ipConsistency && state !== 'checking') runConsistencyCheck();
}
function ipv4(ip) {
const values = String(ip).split('.');
return values.length === 4 && values.every(s => /^\d{1,3}$/.test(s) && Number(s) <= 255);
}
function publicIPv4(ip) {
if (!ipv4(ip)) return false;
const [a, b, c] = ip.split('.').map(Number);
if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
if (a === 203 && b === 0 && c === 113) return false;
if (a === 192 && b === 88 && c === 99) return false;
if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
if (a === 172 && b >= 16 && b <= 31) return false;
if (a === 192 && b === 168) return false;
if (a === 169 && b === 254) return false;
if (a === 100 && b >= 64 && b <= 127) return false;
return true;
}
function gmRead(url, timeout = 4800) {
return new Promise(resolve => {
if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
let settled = false, req;
const finish = value => {
if (settled) return;
settled = true;
clearTimeout(watchdog);
resolve(value);
};
const watchdog = setTimeout(() => finish(null), timeout + 500);
try {
req = GM_xmlhttpRequest({method:'GET',url,timeout,
onload:r => finish(r.status === 200 ? String(r.responseText || '') : null),
onerror:()=>finish(null),ontimeout:()=>finish(null),onabort:()=>finish(null)});
} catch { finish(null); }
});
}
const readJSON = async url => { try { return JSON.parse(await gmRead(url)); } catch { return null; } };
const ipSources = [
async () => (await readJSON('https://api.ipify.org?format=json'))?.ip,
async () => (await gmRead('https://ipv4.icanhazip.com/'))?.trim(),
async () => (await gmRead('https://checkip.amazonaws.com/'))?.trim(),
];
async function externalIPv4() {
const first = await Promise.all(ipSources.slice(0,2).map(fn => fn().catch(()=>null)));
let values = first.filter(publicIPv4);
if (values.length < 2 || (values.length === 2 && values[0] !== values[1])) {
const last = await ipSources[2]().catch(()=>null);
if (publicIPv4(last)) values.push(last);
}
const ips = [...new Set(values)];
const counts = ips.map(ip => values.filter(x => x === ip).length);
const best = counts.length ? Math.max(...counts) : 0;
return {ip: ips.length === 1 || best >= 2 ? ips[counts.indexOf(best)] : null,
ips, disagreement:ips.length > 1};
}
const iceServers = [
{name:'Google', urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
{name:'Cloudflare', urls:['stun:stun.cloudflare.com:3478']},
];
function iceAttempt(server) {
return new Promise(resolve => {
if (typeof page.RTCPeerConnection !== 'function')
return resolve({candidates:[],error:'WebRTC unavailable'});
let pc, ended = false;
const candidates = [];
const collect = raw => {
const m = /(?:^|\s)[^\s]+\s+\d+\s+(?:udp|tcp)\s+\d+\s+([^\s]+)\s+\d+\s+typ\s+(host|srflx|relay|prflx)/i.exec(raw || '');
if (m) candidates.push({ip:m[1].replace(/^\[|\]$/g,''),type:m[2]});
};
const finish = error => {
if (ended) return;
ended = true;
clearTimeout(timer);
try { for (const line of (pc?.localDescription?.sdp || '').split('\n'))
if (line.includes('candidate:')) collect(line); } catch {}
try { pc?.close(); } catch {}
resolve({candidates,error:error || null});
};
const timer = setTimeout(()=>finish('timed out'),6400);
try {
pc = new page.RTCPeerConnection({iceServers:[{urls:server.urls}]});
pc.onicecandidate = ev => ev.candidate ? collect(ev.candidate.candidate) : finish(null);
pc.onicegatheringstatechange = () => {
if (pc.iceGatheringState === 'complete') finish(null);
};
pc.createDataChannel('env-network-check');
pc.createOffer().then(offer => pc.setLocalDescription(offer))
.catch(err => finish(err?.message || 'offer failed'));
} catch(err) { finish(err?.message || 'unavailable'); }
});
}
async function iceCandidates() {
const results = await Promise.all(iceServers.map(iceAttempt));
return {candidates:results.flatMap(x=>x.candidates),
completed:results.filter(x=>!x.error).length, attempts:results.length,
errors:results.filter(x=>x.error).map(x=>x.error)};
}
let rtcRunning = null;
async function runRtcCheck() {
if (!applied.rtc) { updateRtc('off', 'Automatic checking is disabled.'); return; }
if (rtcRunning) return rtcRunning;
updateRtc('checking', 'Checking independent HTTP/IP and STUN routes…');
rtcRunning = (async () => {
const [http, ice] = await Promise.all([externalIPv4(), iceCandidates()]);
if (!applied.rtc) { updateRtc('off', 'Automatic checking is disabled.'); return; }
rtcState.httpIPv4 = http.ip;
rtcState.httpIPs = http.ips;
rtcState.ipDisagreement = http.disagreement;
const peerV4 = [...new Set(ice.candidates.filter(c =>
['srflx','prflx','host'].includes(c.type) && publicIPv4(c.ip)).map(c=>c.ip))];
const mismatch = http.ip && !http.disagreement && peerV4.filter(ip => ip !== http.ip);
if (mismatch?.length) {
updateRtc('leak', `Possible public-IP leak: WebRTC ${mismatch.join(', ')} vs HTTP ${http.ip}. Check browser or VPN routing.`);
} else if (http.disagreement) {
updateRtc('limited', `HTTP IP providers disagree (${http.ips.join(', ')}); WebRTC result inconclusive.`);
} else if (!http.ip) {
updateRtc('limited', 'HTTP IP unavailable across backup providers; comparison incomplete.');
} else if (!peerV4.length) {
updateRtc('limited', `No public IPv4 ICE candidate found via ${ice.attempts} STUN routes. Local/private addresses ignored.`);
} else if (ice.completed < ice.attempts) {
updateRtc('limited', `Observed WebRTC IPv4 matches HTTP ${http.ip}, but ${ice.attempts-ice.completed} STUN route(s) incomplete.`);
} else {
updateRtc('safe', `No observed public IPv4 mismatch across ${ice.attempts} STUN routes. IPv6 and blocked paths remain unverified.`);
}
})().catch(err => updateRtc('limited', `Network check incomplete: ${err.message}`))
.finally(() => { rtcRunning = null; });
return rtcRunning;
}
const headerEchoUrls = ['https://httpbingo.org/headers','https://httpbin.org/headers'];
let headerResult = null, headerRunning = null;
async function echoHeaders(redo = false) {
if (redo) headerResult = null;
if (headerResult) return headerResult;
if (headerRunning) return headerRunning;
headerRunning = (async () => {
for (const url of headerEchoUrls) {
const abort = new AbortController();
const timer = setTimeout(()=>abort.abort(),3600);
try {
const response = await page.fetch(url,{mode:'cors',credentials:'omit',
referrerPolicy:'no-referrer',cache:'no-store',signal:abort.signal});
if (!response.ok) continue;
const data = await response.json();
const raw = data.headers;
if (!raw || typeof raw !== 'object') continue;
const get = name => {
const value = Object.entries(raw).find(([k])=>k.toLowerCase()===name.toLowerCase())?.[1];
return Array.isArray(value) ? value[0] : value || null;
};
headerResult = {status:'observed', acceptLanguage:get('Accept-Language'),
userAgent:get('User-Agent'), platform:get('Sec-Ch-Ua-Platform')};
return headerResult;
} catch { /* CSP, CORS, offline, or timeout: try the next independent service. */ }
finally {clearTimeout(timer);}
}
return headerResult={status:'unavailable'};
})().finally(()=>headerRunning=null);
return headerRunning;
}
const consistencyState = { state:'checking', details:'Checking browser language, Intl locale, region, timezone, UTC offset, HTTP IP and WebRTC...' };
const consistencyListeners = new Set();
function updateConsistency(state, details) {
consistencyState.state = state;
consistencyState.details = details;
for (const cb of consistencyListeners) { try { cb(); } catch {} }
}
const geoSources = [
async () => {
const d = await readJSON('https://ipapi.co/json/');
return d && !d.error ? {ip:d.ip, region:d.country_code || d.country, timezone:d.timezone} : null;
},
async () => {
const d = await readJSON('https://ipwho.is/');
return d && d.success !== false ? {ip:d.ip,region:d.country_code,timezone:d.timezone?.id} : null;
},
async () => {
const d = await readJSON('https://ipinfo.io/json');
return d ? {ip:d.ip,region:d.country,timezone:d.timezone} : null;
},
];
async function geoLookup() {
const fetch = async fn => {
try {
const d = await fn();
const region = validRegion(d?.region);
return region ? {ip: String(d.ip||''),region,
timezone:validZone(d.timezone) || null} : null;
} catch { return null; }
};
const first = await Promise.all(geoSources.slice(0,2).map(fetch));
let results = first.filter(Boolean);
if (results.length < 2 || (results.length === 2 && results[0].region !== results[1].region)) {
const third = await fetch(geoSources[2]);
if (third) results.push(third);
}
if (!results.length) return null;
const regions = [...new Set(results.map(x=>x.region))];
const counts = regions.map(r=>results.filter(x=>x.region===r).length);
const best = Math.max(...counts);
if (regions.length > 1 && best < 2) return {disagreement:true,region:null,ip:null,timezone:null};
const region = regions[counts.indexOf(best)];
const chosen = results.find(x=>x.region===region);
return {...chosen, disagreement:regions.length>1};
}
const TZ_CACHE_KEY = 'environmentManagerZoneCountriesV4';
const tzSaved = GM_getValue(TZ_CACHE_KEY, null);
let zoneCountries = tzSaved?.map && typeof tzSaved.map === 'object' ? tzSaved.map : {};
const tzDataUrls = [
'https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab',
'https://cdn.jsdelivr.net/gh/eggert/tz@main/zone1970.tab',
];
function parseZoneCountryData(raw) {
const map = {};
for (const line of String(raw).split(/\r?\n/)) {
if (!line || line.startsWith('#')) continue;
const cols = line.split('\t');
if (cols.length < 3 || !/^([A-Z]{2},)*[A-Z]{2}$/.test(cols[0])) continue;
const canonical = nativeZone(cols[2]) || cols[2];
map[canonical] = [...new Set([...(map[canonical]||[]),...cols[0].split(',')])];
}
return Object.keys(map).length > 200 ? map : null;
}
let zoneDataRequest = null;
async function updateZoneCountries() {
if (tzSaved?.timestamp && Date.now()-tzSaved.timestamp < 30*86400000) return;
if (zoneDataRequest) return zoneDataRequest;
zoneDataRequest = (async () => {
for (const url of tzDataUrls) {
const result = parseZoneCountryData(await gmRead(url,5500));
if (!result) continue;
zoneCountries = result;
GM_setValue(TZ_CACHE_KEY,{timestamp:Date.now(),map:result});
zoneIndex = null;
if (applied.ipConsistency) runConsistencyCheck();
return;
}
})().finally(()=>{zoneDataRequest=null;});
return zoneDataRequest;
}
function countriesForZone(input) {
if (!input || input === SYSTEM) return [];
return zoneCountries[validZone(input)] || zoneCountries[input] || [];
}
function regionInLanguage(tag) {
try { return new nativeLocaleCtor(tag).region || null; }
catch { return null; }
}
function currentOffsetForZone(timeZone, instant = new NativeDate()) {
try {
const f = new NativeDTF('en-US-u-ca-gregory-nu-latn', {
timeZone, year:'numeric', month:'2-digit', day:'2-digit',
hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23',
});
const parts = Object.fromEntries(f.formatToParts(instant)
.filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
const utcFromWall = NativeDate.UTC(parts.year, parts.month - 1, parts.day,
parts.hour, parts.minute, parts.second);
return Math.round((instant.getTime() - utcFromWall) / 60000);
} catch { return null; }
}
function getEnvironmentSnapshot() {
let locale = null, timeZone = null, numberLocale = null;
try {
const resolved = new page.Intl.DateTimeFormat().resolvedOptions();
locale = resolved.locale || null;
timeZone = resolved.timeZone || null;
} catch {}
try { numberLocale = new page.Intl.NumberFormat().resolvedOptions().locale; } catch {}
let primary = null, languageList = [];
try {
primary = page.navigator.language || null;
languageList = Array.from(page.navigator.languages || []);
} catch {}
let offset = null;
try { offset = new page.Date().getTimezoneOffset(); } catch {}
return {
primary, languageList, languageRegion:regionInLanguage(primary),
locale, localeRegion:regionInLanguage(locale),
numberLocale, numberRegion:regionInLanguage(numberLocale),
timeZone, offset,
selectedRegion:applied.regionEnabled ? applied.region : null,
};
}
function compareEnvironment(geo, rtc, headers) {
const v = getEnvironmentSnapshot();
const issues = [];
const add = (a,b,description) => {
if (a && b && a !== b) issues.push(`${description}: ${a} vs ${b}`);
};
const ipCountry = geo?.region || null;
if (geo?.disagreement) issues.push('IP geolocation providers disagree');
if (rtc.ipDisagreement) issues.push('HTTP IP providers disagree');
if (headers?.status === 'observed' && headers.acceptLanguage) {
const first = headers.acceptLanguage.split(',')[0].split(';')[0].trim();
if (first && validLanguage(first) && v.primary && first.toLowerCase() !== v.primary.toLowerCase()) {
issues.push(`HTTP Accept-Language ${first} vs JavaScript ${v.primary}`);
}
}
if (headers?.status === 'observed' && headers.userAgent &&
headers.userAgent !== page.navigator.userAgent) {
issues.push('HTTP User-Agent differs from navigator.userAgent');
}
const zoneRegions = countriesForZone(v.timeZone);
const zoneKnown = zoneRegions.length > 0;
add(v.selectedRegion, ipCountry, 'Selected region vs IP country');
add(v.languageRegion, ipCountry, 'Primary browser language region vs IP country');
add(v.localeRegion, ipCountry, 'Intl date locale region vs IP country');
add(v.numberRegion, ipCountry, 'Intl number locale region vs IP country');
add(v.selectedRegion, v.languageRegion, 'Selected region vs primary language region');
add(v.selectedRegion, v.localeRegion, 'Selected region vs Intl locale region');
add(v.selectedRegion, v.numberRegion, 'Selected region vs number locale region');
add(v.languageRegion, v.localeRegion, 'Primary language region vs Intl locale region');
add(v.localeRegion, v.numberRegion, 'Date vs number locale region');
if (v.primary && v.languageList.length && v.primary !== v.languageList[0]) {
issues.push(`navigator.language ${v.primary} differs from navigator.languages[0] ${v.languageList[0]}`);
}
if (zoneKnown) {
for (const [name,country] of [
['IP country',ipCountry],['selected region',v.selectedRegion],
['primary language region',v.languageRegion],['Intl locale region',v.localeRegion],
]) {
if (country && !zoneRegions.includes(country)) {
issues.push(`Timezone ${v.timeZone} is not mapped to ${name} ${country}`);
}
}
}
const expectedOffset = v.timeZone ? currentOffsetForZone(v.timeZone) : null;
if (expectedOffset !== null && v.offset !== null &&
Number.isFinite(v.offset) && Math.abs(expectedOffset - v.offset) > 1) {
issues.push(`Timezone offset mismatch: Date ${v.offset} min vs ${v.timeZone} expected ${expectedOffset} min`);
}
if (applied.timezone !== SYSTEM && v.timeZone && validZone(applied.timezone) !== v.timeZone) {
issues.push(`Configured timezone ${applied.timezone} differs from exposed ${v.timeZone}`);
}
if (applied.languageEnabled || applied.matchLanguageRegions) {
const expected = effectiveLanguages(applied);
if (JSON.stringify(v.languageList) !== JSON.stringify(expected) || v.primary !== expected[0]) {
issues.push('Browser language override is not returning the expected language order');
}
}
if ((applied.localeEnabled || applied.regionEnabled) && v.localeRegion !==
regionInLanguage(effectiveLocale(applied))) {
issues.push(`Intl locale override is not exposing the expected region`);
}
if (applied.fonts && !verifySync('fonts')) {
issues.push('Font masking did not pass the supported JavaScript checks');
}
if (geo?.ip && rtc.httpIPv4 && !rtc.ipDisagreement && ipv4(geo.ip) && geo.ip !== rtc.httpIPv4) {
issues.push(`HTTP IP providers disagree: ipapi.co ${geo.ip} vs api.ipify.org ${rtc.httpIPv4} (proxy rotation can cause this)`);
}
if (rtc.state === 'leak') issues.push(`WebRTC public-IP mismatch: ${rtc.details}`);
const short = [];
const labels = [
['HTTP Accept-Language', 'HTTP language / JS'],
['HTTP User-Agent', 'HTTP UA / JS'],
['Selected region vs IP country', 'Region / IP'],
['Primary browser language region vs IP country', 'Language / IP'],
['Intl date locale region vs IP country', 'Intl / IP'],
['Intl number locale region vs IP country', 'Intl / IP'],
['Timezone offset mismatch', 'UTC offset'],
['Timezone ', 'Timezone'],
['WebRTC public-IP mismatch', 'WebRTC / IP'],
['HTTP IP providers disagree', 'IP services'],
['IP geolocation providers disagree', 'IP geography'],
['Browser language override', 'Language override'],
['Font masking', 'Font protection'],
['Intl locale override', 'Intl override'],
['Configured timezone', 'Timezone override'],
];
for (const issue of issues) {
const label = labels.find(([prefix]) => issue.startsWith(prefix));
let tiny = label ? label[1] : issue.slice(0, 42);
if (issue.includes(': ') && label && ['Region / IP', 'Language / IP', 'Intl / IP'].includes(tiny)) {
tiny += ' ' + issue.split(': ').pop().replace(' vs ', '/');
}
if (!short.includes(tiny)) short.push(tiny);
}
if (issues.length) return {
state:'warning', details:`${short.length} conflict${short.length === 1 ? '' : 's'}: ${short.slice(0, 3).join(' · ')}${short.length > 3 ? ` · +${short.length - 3}` : ''}`,
};
if (!geo?.region) return {state:'unknown', details:'IP location unavailable or disputed · Comparison incomplete'};
return {state:'ok', details:headers?.status === 'observed' ? 'No observed conflicts · JS + HTTP echo checked (TLS unverified)' : 'No observed JS conflicts · HTTP headers unverified (CSP/CORS)'};
}
let geoResult = null;
let geoPromise = null;
let consistencySequence = 0;
async function runConsistencyCheck(redo = false) {
const serial = ++consistencySequence;
if (!prefs.ipConsistency) {
updateConsistency('off','Consistency check off'); return;
}
updateConsistency('checking','Checking environment…');
if (redo) geoResult = null;
const headerPromise = echoHeaders(redo);
if (!geoResult && !geoPromise) geoPromise = geoLookup().then(result => {
geoResult = result; geoPromise = null; return result;
}, () => { geoPromise = null; return null; });
await Promise.all([geoPromise || Promise.resolve(), headerPromise]);
if (serial !== consistencySequence || !prefs.ipConsistency) return;
const result = compareEnvironment(geoResult, rtcState,headerResult);
updateConsistency(result.state,result.details);
}
const fallbackZones = ['UTC','Asia/Tokyo','Asia/Shanghai','Asia/Singapore','Asia/Kolkata',
'Europe/London','Europe/Paris','Europe/Berlin','America/New_York',
'America/Chicago','America/Denver','America/Los_Angeles','Australia/Sydney'];
const languageCodes = `aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(' ');
const regionalLocales = `en-US en-GB en-AU en-CA en-IN en-NZ zh-CN zh-TW zh-HK zh-SG zh-MO zh-Hans zh-Hant ja-JP ko-KR fr-FR fr-CA fr-BE fr-CH de-DE de-AT de-CH es-ES es-MX es-AR es-CO es-CL es-US pt-BR pt-PT ru-RU it-IT nl-NL nl-BE ar-SA ar-EG ar-AE ar-MA hi-IN bn-BD bn-IN ur-PK ur-IN pa-IN pa-PK ta-IN ta-LK te-IN mr-IN gu-IN kn-IN ml-IN th-TH vi-VN id-ID ms-MY fil-PH tr-TR pl-PL uk-UA ro-RO hu-HU cs-CZ sk-SK sl-SI hr-HR sr-RS sr-Latn-RS bg-BG el-GR he-IL fa-IR sv-SE no-NO nb-NO nn-NO da-DK fi-FI is-IS et-EE lv-LV lt-LT sw-KE sw-TZ af-ZA zu-ZA am-ET so-SO ne-NP si-LK km-KH lo-LA my-MM mn-MN kk-KZ uz-UZ az-AZ ka-GE hy-AM eu-ES ca-ES gl-ES cy-GB ga-IE sq-AL mk-MK bs-BA`.split(' ');
const languageLabels = (() => {
const candidates = [...new Set([...originalLanguages, ...applied.languages,
...languageCodes, ...regionalLocales])];
const supported = page.Intl.DateTimeFormat.supportedLocalesOf(candidates);
const display = typeof page.Intl.DisplayNames === 'function'
? new page.Intl.DisplayNames(['en'], { type: 'language' }) : null;
return supported.map(code => ({
code,
label: display ? `${display.of(code)} (${code})` : code,
})).sort((a, b) => a.label.localeCompare(b.label, 'en'));
})();
const zones = (() => {
let list = [];
try { list = page.Intl.supportedValuesOf?.('timeZone') || []; } catch {}
if (!list.length) list = fallbackZones;
return [...new Set(['UTC', ...list, ...(zone !== SYSTEM ? [zone] : [])])].sort();
})();
let zoneIndex = null;
function timezoneIndex() {
if (zoneIndex) return zoneIndex;
const now = new NativeDate();
const displayRegion = typeof page.Intl.DisplayNames === 'function'
? new page.Intl.DisplayNames(['en'],{type:'region'}) : null;
const entries = zones.map(code => {
const signed = -currentOffsetForZone(code,now);
let abbr = '', generic = '';
try {
const extract = (type) => new NativeDTF('en-US',{timeZone:code,timeZoneName:type})
.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
abbr = extract('short');
generic = extract('longGeneric');
} catch {}
const regions = countriesForZone(code);
const names = regions.map(c => displayRegion?.of(c) || c);
const special = Object.keys(zoneAliases).filter(k => nativeZone(zoneAliases[k]) === code).join(' ');
const offset = Number.isFinite(signed) ? `UTC${offsetText(signed)}` : '';
const label = [code,offset,abbr].filter(Boolean).join('  ·  ');
const city = code.split('/').pop().replaceAll('_',' ');
return {code,label,offset:signed,city:city.toLowerCase(),
terms:`${code} ${code.replaceAll('_',' ')} ${names.join(' ')} ${regions.join(' ')} ${abbr} ${generic} ${special}`.toLowerCase()};
});
zoneIndex = entries;
return entries;
}
function timezoneMatches(query) {
const raw = query.trim();
if (!raw) return {items:timezoneIndex().slice(0,45), hint:'Search city, country, offset, or abbreviation.'};
const q=raw.toLowerCase();
const offset = parseOffset(raw);
if (/^(?:(?:utc|gmt)\s*)?[+-]$/.test(q)) {
const sign=q.includes('+') ? 1 : -1;
const values=[1,2,3,4,5,5.5,6,7,8,9,9.5,10,11,12,13,14];
const items=values.map(h=>Math.round(h*60)*sign).map(minutes=>({
code:offsetZone(minutes),label:`UTC${offsetText(minutes)}  ·  Fixed offset (no DST)`
})).filter(x=>x.code);
return {items,hint:'Enter a number, or select a fixed offset.'};
}
const alias = zoneAliases[q] || ({'pacific time':'America/Los_Angeles','eastern time':'America/New_York','central time':'America/Chicago','mountain time':'America/Denver'})[q];
const results = [];
const candidates=timezoneIndex();
const tokens=q.replace(/[_/]/g,' ').split(/\s+/).filter(Boolean);
for (const item of candidates) {
let score = Infinity;
const city=item.city, code=item.code.toLowerCase();
if (alias && code === (nativeZone(alias) || alias).toLowerCase()) score = 0;
if (code === q || city === q) score = Math.min(score,0);
if (offset !== null && item.offset === offset) score = Math.min(score, 4);
if (code.startsWith(q) || city.startsWith(q)) score = Math.min(score,10);
if (item.terms.split(/[^a-z0-9+-]+/).includes(q)) score = Math.min(score,15);
if (code.includes(q) || city.includes(q)) score = Math.min(score,20);
if (tokens.every(token => item.terms.includes(token))) score = Math.min(score,30);
if (score < Infinity) results.push({ ...item, score });
}
if (offset !== null) {
const fixed=offsetZone(offset);
if (fixed) results.unshift({code:fixed, label:`UTC${offsetText(offset)}  ·  Fixed offset (no DST)`,score:-2,city:''});
}
if (['utc','gmt','ut','z'].includes(q))
results.unshift({code:'UTC',label:'UTC / GMT  ·  UTC+00:00',score:-3,city:''});
let hint='';
if (!results.length || q === 'ptc') {
if (q === 'ptc' || q === 'pacific time canada') {
hint='PTC is not a recognized timezone ID. Did you mean PT (Pacific Time)?';
return {items:candidates.filter(x=>x.code==='America/Los_Angeles' || x.code==='America/Vancouver'),hint};
}
hint='No exact match. Try UTC+9, GMT-5, +05:30, PT, PST, or a city name.';
}
const unique = new Set();
const items=results.sort((a,b)=>a.score-b.score || a.code.localeCompare(b.code))
.filter(x=>!unique.has(x.code) && unique.add(x.code));
return {items,hint};
}
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
.summary {display:flex;gap:6px;align-items:center;margin:10px 0 2px;}
.summary .status {margin:0;flex:1;min-width:0;font-size:11px;padding:8px;}
.summary button {flex:none;padding:6px 10px;}
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
.section {border-color:#34465a;}
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
<div class="head"><strong>Environment Settings</strong><button id="close" class="tiny" type="button" aria-label="Close">✕</button></div>
<div class="summary" id="consistencyTop">
<div class="status" id="consistencyStatus" role="status" aria-live="polite"></div>
<button class="tiny" id="consistencyRetry" type="button" title="Recheck all signals">↻</button>
</div>
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
<div class="setting"><span class="label">Automatic WebRTC Leak Check</span><input id="rtcOn" type="checkbox" aria-label="Enable automatic WebRTC leak check"></div>
<div class="sub">Cross-checks two STUN services and backup HTTP IP providers. Private IPs ignored; incomplete results are neutral.</div>
<div class="status" id="rtcStatus"></div>
<button id="rtcRetry" class="tiny" type="button">Check again</button>
</div>
<div class="section">
<div class="setting"><span class="label">Full Environment Consistency</span><input id="ipConsistencyOn" type="checkbox" aria-label="Enable full environment consistency checks"></div>
<div class="sub">Compares languages, Intl, region, timezone, IP, WebRTC and available font APIs.</div>
</div>
<div class="actionrow" style="margin-top:12px;justify-content:flex-end"><button id="reset" type="button">Reset to defaults</button></div>
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
}
subscribers.add(renderRtc);
function renderConsistency() {
$('consistencyStatus').className = `status ${consistencyState.state === 'warning' ? 'warning' : consistencyState.state === 'ok' ? 'ok' : ''}`;
$('consistencyStatus').textContent = `${consistencyState.state.toUpperCase()}: ${consistencyState.details}`;
renderRtc();
}
consistencyListeners.add(renderConsistency);
function syncControls() {
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
$('consistencyRetry').addEventListener('click',()=>{ runConsistencyCheck(true); if (prefs.rtc) runRtcCheck(); });
$('rtcRetry').addEventListener('click', () => {
if (!prefs.rtc) return message('Enable automatic WebRTC checks first.',true);
runRtcCheck();
});
$('reset').addEventListener('click', () => {
if (!page.confirm('Restore default settings? Your floating button position will be kept.')) return;
const next = {...defaultConfig, languages:[...originalLanguages], locale:originalLocale};
const reloadKeys = ['timezone','languageEnabled','matchLanguageRegions','languages','regionEnabled','region','localeEnabled','locale','fonts'];
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
showPanel = () => {
languageDraft = [...prefs.languages];
renderChips();
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
if (page.top === page) {
if (document.body) createWidget();
else document.addEventListener('DOMContentLoaded',createWidget,{once:true});
}
if (page.top === page) {
updateZoneCountries();
if (applied.ipConsistency) runConsistencyCheck(true);
else updateConsistency('off','Automatic checks are disabled.');
if (applied.rtc) runRtcCheck();
else updateRtc('off','Automatic checking is disabled.');
}
})();