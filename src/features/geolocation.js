const consistencyState = { state:'checking', details:'Checking IP, timezone, region and -CN language tags…' };
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
