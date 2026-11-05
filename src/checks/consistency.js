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
function compareEnvironment(geo, _rtc, headers) {
const v = getEnvironmentSnapshot();
const issues = [];
const add = text => { if (!issues.includes(text)) issues.push(text); };
const ip = geo?.disagreement ? null : geo?.region || null;
const region = v.selectedRegion; // Only an explicitly enabled Region is a geographic choice.
const zone = v.timeZone;
const countries = countriesForZone(zone);
const mapped = countries.length > 0;
const geoZone = geo?.timezone;
let zoneChecked = false;

if (ip && region && region !== ip) add(`Region ${region} / IP ${ip}`);
if (zone) {
if (mapped) {
zoneChecked = Boolean(ip);
if (ip && !countries.includes(ip)) add(`Timezone / IP ${ip}`);
if (region && !countries.includes(region)) add(`Timezone / Region ${region}`);
} else if (geoZone && ip) {
// A timezone's current offset can be compared, but equal offsets do not prove
// that the timezone belongs to the IP country.
const a = currentOffsetForZone(zone), b = currentOffsetForZone(geoZone);
if (a !== null && b !== null && a !== b) {
zoneChecked = true;
add('Timezone / IP offset');
}
}
const expected = currentOffsetForZone(zone);
if (expected !== null && v.offset !== null && Number.isFinite(v.offset) &&
Math.abs(expected - v.offset) > 1) add('Timezone / Date offset');
if (applied.timezone !== SYSTEM && validZone(applied.timezone) !== zone)
add('Saved / exposed timezone');
}

// Language geography is NOT matched to the IP, locale, timezone, or Region.
// Only non-Chinese language tags ending in -CN are reported.
const unwantedCN = tags => [...new Set(tags.filter(x =>
/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*-cn$/i.test(x) && !/^zh(?:-|$)/i.test(x)))];
const jsCN = unwantedCN([v.primary, ...v.languageList].filter(x => typeof x === 'string'));
const httpCN = headers?.status === 'observed' && typeof headers.acceptLanguage === 'string'
? unwantedCN(headers.acceptLanguage.split(',').map(part=>part.split(';')[0].trim())) : [];
if (jsCN.length) add(`JS -CN: ${jsCN.slice(0,2).join(', ')}${jsCN.length > 2 ? ` +${jsCN.length - 2}` : ''}`);
if (httpCN.length) add(`HTTP -CN: ${httpCN.slice(0,2).join(', ')}${httpCN.length > 2 ? ` +${httpCN.length - 2}` : ''}`);

if (issues.length) return {state:'warning', details:`${issues.length} issue${issues.length > 1 ? 's' : ''}: ${issues.slice(0,3).join(' · ')}${issues.length > 3 ? ` · +${issues.length - 3}` : ''}`};
if (geo?.disagreement) return {state:'unknown',details:'IP location sources disagree'};
if (!ip) return {state:'unknown',details:'IP location unavailable · language tags checked'};
if (!zoneChecked) return {state:'unknown',details:'Timezone / IP location not verified · no -CN detected'};
return {state:'ok',details:`IP ${ip} / timezone${region ? ` / region ${region}` : ''} align · no non-zh -CN${headers?.status === 'observed' ? '' : ' (HTTP unverified)'}`};
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
// Coverage notes are separate from the top-level geographic consistency status.
// A third-party echo sees its own request, not necessarily the site's navigation request.
function observedLanguagePair() {
const js = getEnvironmentSnapshot().primary;
if (headerResult?.status !== 'observed' || !headerResult.acceptLanguage)
return {kind:'unknown', detail:'HTTP Accept-Language unverified: echo blocked, unavailable, or omitted.'};
const choices = String(headerResult.acceptLanguage).split(',').map((raw, index) => {
const [tag, ...rest] = raw.trim().split(';');
const quality = rest.find(s=>/^\s*q\s*=/i.test(s));
const q = quality ? Number(quality.split('=')[1]) : 1;
return {tag:validLanguage(tag),q:Number.isFinite(q)?q:0,index};
}).filter(x=>x.tag&&x.q>0).sort((a,b)=>b.q-a.q||a.index-b.index);
const http = choices[0]?.tag;
if (!http || !js) return {kind:'unknown',detail:'HTTP or JavaScript primary language could not be established.'};
if (http.toLowerCase()===js.toLowerCase()) return {kind:'match',detail:`HTTP/JS primary language ${js}: matched on external echo only.`};
const base = s => s.toLowerCase().split('-')[0];
if (base(http)===base(js) && (!http.includes('-') || !js.includes('-')))
return {kind:'unknown',detail:`HTTP ${http} / JS ${js}: region was omitted in one signal; not necessarily a conflict.`};
return {kind:'difference',detail:`HTTP ${http} / JS ${js}: different on external echo; target-site header unverified.`};
}
function coverageNotes() {
const result=[];
const language=observedLanguagePair();
result.push({kind:language.kind, text:language.detail});
if (applied.timezone!==SYSTEM || applied.regionEnabled || applied.localeEnabled || applied.languageEnabled || applied.matchLanguageRegions)
result.push({kind:'unknown',text:'Workers, cross-origin frames and native browser signals: overrides not verified.'});
if (applied.fonts)
result.push({kind:'unknown',text:'Font masking is partial; native rendering and all font probes are not verified.'});
if (applied.rtc)
result.push({kind:'unknown',text:rtcState.state==='limited'||rtcState.state==='unknown'
? 'WebRTC collection incomplete; IPv6 and blocked routes not verified.'
: 'WebRTC IPv6 and routes blocked by browser/network policy are not verified.'});
if (applied.ipConsistency || applied.rtc)
result.push({kind:'unknown',text:'External IP lookups may use a different path than this website’s connection.'});
result.push({kind:'unknown',text:'TLS/JA3/JA4 and high-entropy Client Hints are not verified by this userscript.'});
return result;
}

