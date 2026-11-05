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
