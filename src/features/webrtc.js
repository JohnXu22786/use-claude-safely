const rtcState = { state: 'checking', details: 'Starting WebRTC check...' };
const subscribers = new Set();
function updateRtc(state, details) {
rtcState.state = state;
rtcState.details = details;
for (const callback of subscribers) { try { callback(); } catch {} }
if (applied.ipConsistency && state !== 'checking') runConsistencyCheck();
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
// Geolocate public ICE candidates only, never private/mDNS candidates.
const candidateGeographyProviders = [
  async ip => { const d=await readJSON('https://ipwho.is/' + encodeURIComponent(ip));
    return d && d.success !== false ? d : null; },
  async ip => { const d=await readJSON('https://ipapi.co/' + encodeURIComponent(ip) + '/json/');
    return d && !d.error ? d : null; },
  async ip => { const d=await readJSON('https://ipinfo.io/' + encodeURIComponent(ip) + '/json');
    return d && !d.error ? d : null; },
];
const candidateGeoCache = new Map();
async function locateCandidateCountry(ip) {
  const cached=candidateGeoCache.get(ip);
  if (cached && Date.now()-cached.time < 900000) return cached.result;
  const lookup=async fn=>{
    try {
      const d=await fn(ip);
      if (!d || (d.ip && d.ip.toLowerCase() !== ip.toLowerCase())) return null;
      const country=String(d.country_code || d.country || '').toUpperCase();
      return /^[A-Z]{2}$/.test(country) ? country : null;
    } catch { return null; }
  };
  const results=await Promise.all(candidateGeographyProviders.slice(0,2).map(lookup));
  let classification=classifyWebRtcCountries(results);
  if (classification==='unknown') {
    results.push(await lookup(candidateGeographyProviders[2]));
    classification=classifyWebRtcCountries(results);
  }
  const result={classification,countries:results.filter(Boolean)};
  candidateGeoCache.set(ip,{time:Date.now(),result});
  return result;
}
let rtcRunning = null;
async function runRtcCheck() {
  if (!applied.rtc) { updateRtc('off','Automatic checking is disabled.'); return; }
  if (rtcRunning) return rtcRunning;
  updateRtc('checking','Collecting public WebRTC candidates and checking CN/HK location…');
  rtcRunning=(async()=>{
    const ice=await iceCandidates();
    if (!applied.rtc) return updateRtc('off','Automatic checking is disabled.');
    const candidates=[...new Set(ice.candidates
      .filter(c=>['srflx','prflx','host'].includes(c.type))
      .map(c=>publicCandidateAddress(c.ip)).filter(Boolean))];
    if (!candidates.length) return updateRtc('limited',
      'No public ICE candidate found. Private and mDNS addresses ignored; geographic check incomplete.');
    const sample=candidates.slice(0,8);
    const checked=await Promise.all(sample.map(async ip=>({ip,...await locateCandidateCountry(ip)})));
    if (!applied.rtc) return updateRtc('off','Automatic checking is disabled.');
    const flagged=checked.filter(c=>c.classification==='risk');
    const uncertain=checked.filter(c=>c.classification==='unknown');
    if (flagged.length) return updateRtc('leak',
      'CN/HK public WebRTC IP observed: '+flagged.map(x=>x.ip+' ('+x.countries.join('/')+')').join(', '));
    if (uncertain.length || candidates.length>sample.length || ice.completed<ice.attempts)
      return updateRtc('limited','Geographic check incomplete: '+uncertain.length+
        ' unverified public IP(s), '+(ice.attempts-ice.completed)+' incomplete STUN route(s). No confirmed CN/HK candidate.');
    updateRtc('safe','No CN/HK location detected among '+checked.length+
      ' verified public WebRTC IP(s). This is not a guarantee against other leaks.');
  })().catch(err=>updateRtc('limited','WebRTC location check incomplete: '+String(err?.message||err)))
    .finally(()=>{rtcRunning=null;});
  return rtcRunning;
}
