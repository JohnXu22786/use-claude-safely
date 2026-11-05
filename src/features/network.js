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
})().finally(()=>{headerRunning=null;
try { if (typeof showPanel === 'function' && page.top===page) {
// The current panel, when open, is updated by its consistency callback.
for (const cb of consistencyListeners) { try { cb(); } catch {} }
} } catch {}
});
return headerRunning;
}
