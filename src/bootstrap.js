if (page.top === page) {
if (document.body) createWidget();
else document.addEventListener('DOMContentLoaded',createWidget,{once:true});
}
if (page.top === page) {
if (!mailService || prefs.mailSites[mailService.id].features.network) updateZoneCountries();
if (applied.ipConsistency) runConsistencyCheck(true);
else {
updateConsistency('off','Automatic checks are disabled.');
if (!mailService || prefs.mailSites[mailService.id].features.network)
  echoHeaders().finally(() => { /* Coverage is rendered by the panel when opened. */ });
}
if (applied.rtc) runRtcCheck();
else updateRtc('off','Automatic checking is disabled.');
}
