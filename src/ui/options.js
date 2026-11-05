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
