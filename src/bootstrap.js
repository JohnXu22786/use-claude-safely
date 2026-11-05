if (page.top === page) {
if (document.body) createWidget();
else document.addEventListener('DOMContentLoaded',createWidget,{once:true});
}
if (page.top === page) {
updateZoneCountries();
if (applied.ipConsistency) runConsistencyCheck(true);
else {
updateConsistency('off','Automatic checks are disabled.');
echoHeaders().finally(() => { /* Coverage is rendered by the panel when opened. */ });
}
if (applied.rtc) runRtcCheck();
else updateRtc('off','Automatic checking is disabled.');
}
