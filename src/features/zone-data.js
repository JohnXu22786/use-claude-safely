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
