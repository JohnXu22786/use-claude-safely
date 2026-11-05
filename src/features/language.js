function installLanguageOverride() {
if (!applied.languageEnabled && !applied.matchLanguageRegions) return;
const languages = Object.freeze(effectiveLanguages(applied));
try {
Object.defineProperty(page.navigator, 'language', { configurable: true, get: () => languages[0] });
Object.defineProperty(page.navigator, 'languages', { configurable: true, get: () => [...languages] });
} catch { /* Verification will trigger a settings rollback. */ }
}
function installLocaleOverride() {
if (!applied.localeEnabled && !applied.regionEnabled) return;
const locale = effectiveLocale(applied);
const constructors = ['DateTimeFormat', 'NumberFormat', 'Collator', 'PluralRules',
'RelativeTimeFormat', 'ListFormat', 'DisplayNames', 'Segmenter'];
for (const key of constructors) {
const Native = page.Intl[key];
if (typeof Native !== 'function') continue;
function Localized(locales, options) {
const useDefault = locales == null;
const instance = new Native(useDefault ? locale : locales, options);
if (useDefault && applied.regionEnabled && typeof instance.resolvedOptions === 'function') {
const originalResolved = instance.resolvedOptions.bind(instance);
Object.defineProperty(instance, 'resolvedOptions', {
configurable:true,
value:() => ({...originalResolved(),locale}),
});
}
return instance;
}
Object.setPrototypeOf(Localized, Native);
Localized.prototype = Native.prototype;
try { Object.defineProperty(Localized, 'name', { value: key }); page.Intl[key] = Localized; }
catch { /* Unpatchable browser object; see verification. */ }
}
for (const method of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
const nativeMethod = NativeDate.prototype[method];
if (typeof nativeMethod === 'function') {
NativeDate.prototype[method] = function (locales, options) {
return nativeMethod.call(this, locales == null ? locale : locales, options);
};
}
}
for (const proto of [page.Number?.prototype, page.BigInt?.prototype]) {
if (!proto || typeof proto.toLocaleString !== 'function') continue;
const original = proto.toLocaleString;
proto.toLocaleString = function (locales, options) {
return original.call(this, locales == null ? locale : locales, options);
};
}
}
installLanguageOverride();
