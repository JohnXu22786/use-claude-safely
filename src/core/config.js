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
