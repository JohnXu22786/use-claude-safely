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
