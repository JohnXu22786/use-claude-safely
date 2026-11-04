// ==UserScript==
// @name         Claude / Anthropic - Environment Manager
// @namespace    https://userscripts.local/claude-anthropic-timezone
// @description  Compact environment controls, font privacy, WebRTC checks, and concise consistency alerts. Draggable; settings persist.
// @match        https://claude.ai/*
// @match        https://*.claude.ai/*
// @match        https://claude.com/*
// @match        https://*.claude.com/*
// @match        https://anthropic.com/*
// @match        https://*.anthropic.com/*
// @match        https://claudeusercontent.com/*
// @match        https://*.claudeusercontent.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @connect      api.ipify.org
// @connect      ipapi.co
// ==/UserScript==

(() => {
  'use strict';
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

  function validZone(input) {
    if (typeof input !== 'string') return null;
    if (input.toLowerCase().trim() === SYSTEM) return SYSTEM;
    try { return new NativeDTF('en-US', { timeZone: input.trim() }).resolvedOptions().timeZone; }
    catch { return null; }
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

  // ISO 3166-1 codes; English labels rendered by Intl.DisplayNames when available.
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
  // A language's most likely region comes from the browser's own CLDR data.
  // Explicit custom language lists always win over this automatic normalization.
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
  // These hooks apply in the page's JavaScript realm, not to HTTP headers or OS settings.


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
        // Some engines collapse an unfamiliar language/region pair (en-JP -> en).
        // Preserve the selected region on default-locale resolvedOptions, while
        // leaving explicit locale arguments and native formatting untouched.
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

  // Curated mainstream Chinese font families, not merely a list of five presets.
  // The set covers Windows (including optional CJK packs), macOS/iOS,
  // Linux, Android, Office/WPS, and common device-vendor font families.
  const fontGroups = {
    windows: `Microsoft YaHei|Microsoft YaHei UI|Microsoft YaHei Light|Microsoft YaHei UI Light|SimSun|NSimSun|SimSun-ExtB|SimSun-ExtG|SimHei|SimHei-ExtB|DengXian|DengXian Light|FangSong|FangSong_GB2312|KaiTi|KaiTi_GB2312|LiSu|YouYuan|STFangsong|STHeiti|STKaiti|STSong|STXihei|STZhongsong|STLiti|STCaiyun|STHupo|STXinwei|STXingkai|STYuan|MingLiU|PMingLiU|MingLiU_HKSCS|MingLiU-ExtB|PMingLiU-ExtB|MingLiU_HKSCS-ExtB|Microsoft JhengHei|Microsoft JhengHei UI|Microsoft JhengHei Light|Microsoft JhengHei UI Light|DFKai-SB|Arial Unicode MS|MS Song|MS Hei|BiauKai|MingLiU_HKSCS|SimKai|SimFang|Microsoft Himalaya|Microsoft New Tai Lue`,
    apple: `PingFang SC|PingFang TC|PingFang HK|PingFang|Heiti SC|Heiti TC|Songti SC|Songti TC|Kaiti SC|Kaiti TC|Baoli SC|Baoli TC|Hiragino Sans GB|Hiragino Sans CNS|Hiragino Sans|Hiragino Mincho ProN|STSongti-SC-Regular|STSongti-TC-Regular|STKaiti-SC-Regular|STKaiti-TC-Regular|STHeitiSC-Light|STHeitiTC-Light|Apple LiGothic|Apple LiSung|LiHei Pro|LiSong Pro|Lantinghei SC|Lantinghei TC|Wawati SC|Wawati TC|Weibei SC|Weibei TC|Hanzipen SC|Hanzipen TC|Xingkai SC|Xingkai TC`,
    opensource: `Noto Sans CJK SC|Noto Sans CJK TC|Noto Sans CJK HK|Noto Sans SC|Noto Sans TC|Noto Serif CJK SC|Noto Serif CJK TC|Noto Serif CJK HK|Noto Serif SC|Noto Serif TC|Noto Sans Mono CJK SC|Noto Sans Mono CJK TC|Source Han Sans SC|Source Han Sans TC|Source Han Sans HC|Source Han Sans CN|Source Han Sans TW|Source Han Sans|Source Han Serif SC|Source Han Serif TC|Source Han Serif CN|Source Han Serif TW|Source Han Serif|Source Han Mono SC|Source Han Mono TC|WenQuanYi Micro Hei|WenQuanYi Zen Hei|WenQuanYi Bitmap Song|AR PL UMing CN|AR PL UMing TW|AR PL UKai CN|AR PL UKai TW|AR PL SungtiL GB|AR PL KaitiM GB|Droid Sans Fallback|Droid Sans Chinese|Droid Sans Chinese Fallback|Droid Sans CJK|Droid Sans CJK SC|Droid Sans CJK TC|Sarasa Gothic SC|Sarasa Gothic TC|Sarasa UI SC|Sarasa UI TC|LXGW WenKai|LXGW WenKai Lite|LXGW WenKai Screen|HarmonyOS Sans SC|HarmonyOS Sans TC`,
    vendors: `HarmonyOS Sans|HarmonyOS Sans Naskh Arabic|MiSans|MiSans VF|MiSans L3|MiSans Normal|OPPO Sans|OPPOSans|OPPO Sans 3.0|vivo Sans|vivo Sans 2.0|vivo Sans 3.0|HONOR Sans|Honor Sans|HONOR Sans CN|OnePlus Sans|OnePlus Sans 3.0|realme Sans|ColorOS Sans|Alibaba PuHuiTi|Alibaba PuHuiTi 2.0|Alibaba PuHuiTi 3.0|Alimama ShuHeiTi|Tencent Sans|TencentSans|Douyin Sans|ByteDance Sans|Smiley Sans|MIUI Sans|MIUI|WPS Office|WPS Song|WPS Hei|FZSong|FZHei|FZKai|FZFangSong|FZShuSong|FZLanTingHei|FZLanTingHeiS|Founder Type|FZNewShuSong|FZYaoTi|FZCuHeiSong|FZLiShu|FZWeiBei|FZDaHei-B02|FZKai-Z03|HYQiHei|HYHeiTi|HYSongTi|HYSong|HYKaiTi|HanYi|HanYi QiHei|Hanyi Senty|Kingsoft Office|Kingsoft UI`,
  };
  const localAliasNames = [
    '\u5fae\u8f6f\u96c5\u9ed1', '\u5fae\u8f6f\u96c5\u9ed1UI', '\u5b8b\u4f53',
    '\u65b0\u5b8b\u4f53', '\u9ed1\u4f53', '\u7b49\u7ebf', '\u4eff\u5b8b',
    '\u6977\u4f53', '\u96b6\u4e66', '\u5e7c\u5706', '\u534e\u6587\u7ec6\u9ed1',
    '\u534e\u6587\u9ed1\u4f53', '\u534e\u6587\u5b8b\u4f53', '\u534e\u6587\u6977\u4f53',
    '\u534e\u6587\u4eff\u5b8b', '\u534e\u6587\u4e2d\u5b8b', '\u534e\u6587\u884c\u6977',
    '\u534e\u6587\u96b6\u4e66', '\u534e\u6587\u65b0\u9b4f', '\u65b9\u6b63\u5170\u4ead\u9ed1',
    '\u82f9\u65b9', '\u601d\u6e90\u9ed1\u4f53', '\u601d\u6e90\u5b8b\u4f53',
    '\u9e3f\u8499\u9ed1\u4f53', '\u5c0f\u7c73\u5170\u4ead', '\u963f\u91cc\u5df4\u5df4\u666e\u60e0\u4f53',
    '\u6c49\u4eea\u65d7\u9ed1', '\u6c49\u4eea\u5b8b\u4f53', '\u534e\u6587\u5f69\u4e91',
    '\u534e\u6587\u7425\u73c0', '\u65b9\u6b63\u8212\u4f53', '\u65b9\u6b63\u59da\u4f53',
    '\u51ac\u9752\u9ed1\u4f53', '\u4eff\u5b8b_GB2312', '\u6977\u4f53_GB2312',
    '\u65b0\u7ec6\u660e\u4f53', '\u7ec6\u660e\u4f53', '\u6b63\u9ed1\u4f53',
  ];
  const fontFamilies = [...new Set([...Object.values(fontGroups).flatMap(s => s.split('|')),
    ...localAliasNames])].filter(Boolean);
  const fontTestPattern = new RegExp(fontFamilies
    .sort((a, b) => b.length - a.length)
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'), 'i');
  function containsProtectedFont(text) { return typeof text === 'string' && fontTestPattern.test(text); }
  function fallbackFor(font) {
    const match = String(font).match(/,\s*(monospace|sans-serif|serif)\s*$/i);
    return match ? match[1] : 'sans-serif';
  }
  function installFontMask() {
    // Hooks stay installed; disabling the toggle restores their native behavior.
    const Ctx2D = page.CanvasRenderingContext2D?.prototype;
    if (Ctx2D && typeof Ctx2D.measureText === 'function') {
      const original = Ctx2D.measureText;
      Ctx2D.measureText = function (...args) {
        if (!applied.fonts || !containsProtectedFont(this.font)) return original.apply(this, args);
        const oldFont = this.font;
        try {
          this.font = oldFont.replace(/\s+((?:["'][^"']+["']|[^\s,]+)(?:\s*,.*)?)$/, (_, families) => ' ' + fallbackFor(families));
          if (containsProtectedFont(this.font)) this.font = '16px ' + fallbackFor(oldFont);
          return original.apply(this, args);
        } finally { this.font = oldFont; }
      };
    }
    const Offscreen = page.OffscreenCanvasRenderingContext2D?.prototype;
    if (Offscreen && Offscreen !== Ctx2D && typeof Offscreen.measureText === 'function') {
      const original = Offscreen.measureText;
      Offscreen.measureText = function (...args) {
        if (!applied.fonts || !containsProtectedFont(this.font)) return original.apply(this, args);
        const previous = this.font;
        try {
          this.font = previous.replace(/\s+((?:["'][^"']+["']|[^\s,]+)(?:\s*,.*)?)$/, (_, families) => ' ' + fallbackFor(families));
          if (containsProtectedFont(this.font)) this.font = '16px ' + fallbackFor(previous);
          return original.apply(this, args);
        } finally { this.font = previous; }
      };
    }
    const ffp = page.FontFaceSet?.prototype;
    if (ffp && typeof ffp.check === 'function') {
      const nativeCheck = ffp.check;
      ffp.check = function (font, text) {
        return applied.fonts && containsProtectedFont(font) ? false : nativeCheck.call(this, font, text);
      };
    }
    if (typeof page.queryLocalFonts === 'function') {
      const original = page.queryLocalFonts.bind(page);
      try {
        page.queryLocalFonts = async (...args) => {
          const entries = await original(...args);
          return applied.fonts ? entries.filter(f => !containsProtectedFont(
            [f.family, f.fullName, f.postscriptName].join(' '))) : entries;
        };
      } catch { /* The browser may not expose a writable API. */ }
    }

    // Fingerprint probes frequently measure hidden, off-screen font samples.
    // Modify reported measurements only for those hidden probes, never paint data.
    const nativeRect = page.Element?.prototype?.getBoundingClientRect;
    const offWidth = Object.getOwnPropertyDescriptor(page.HTMLElement?.prototype || {}, 'offsetWidth');
    const offHeight = Object.getOwnPropertyDescriptor(page.HTMLElement?.prototype || {}, 'offsetHeight');
    let probing = false;
    function substituteMetrics(el) {
      if (!applied.fonts || probing || !el?.ownerDocument?.body || !el.isConnected) return null;
      try {
        const style = page.getComputedStyle(el);
        if (!containsProtectedFont(style.fontFamily)) return null;
        const hidden = style.visibility === 'hidden' || style.opacity === '0' ||
          (/^(absolute|fixed)$/.test(style.position) &&
          (parseFloat(style.left) < -250 || parseFloat(style.top) < -250));
        if (!hidden) return null;
        probing = true;
        const node = el.ownerDocument.createElement('span');
        node.style.cssText = `position:absolute!important;visibility:hidden!important;pointer-events:none!important;left:-100000px!important;top:-100000px!important;display:inline-block!important;white-space:${style.whiteSpace}!important;font-size:${style.fontSize}!important;font-style:${style.fontStyle}!important;font-weight:${style.fontWeight}!important;letter-spacing:${style.letterSpacing}!important;line-height:${style.lineHeight}!important;font-family:${fallbackFor(style.fontFamily)}!important`;
        node.textContent = el.textContent || '';
        el.ownerDocument.body.appendChild(node);
        const rect = nativeRect.call(node);
        node.remove();
        return { width: rect.width, height: rect.height };
      } catch { return null; }
      finally { probing = false; }
    }
    if (nativeRect) {
      page.Element.prototype.getBoundingClientRect = function () {
        const real = nativeRect.call(this);
        const metrics = substituteMetrics(this);
        return metrics && typeof page.DOMRect === 'function'
          ? new page.DOMRect(real.x, real.y, metrics.width, metrics.height) : real;
      };
    }
    for (const [desc, key] of [[offWidth, 'offsetWidth'], [offHeight, 'offsetHeight']]) {
      if (desc?.configurable && typeof desc.get === 'function') {
        Object.defineProperty(page.HTMLElement.prototype, key, {
          configurable: true, enumerable: desc.enumerable,
          get: function () {
            const metrics = substituteMetrics(this);
            return metrics ? Math.round(metrics[key === 'offsetWidth' ? 'width' : 'height']) : desc.get.call(this);
          },
        });
      }
    }
  }
  installLanguageOverride();
  if (zone !== SYSTEM) {
    const dtfParts = new NativeDTF('en-US-u-ca-gregory-nu-latn', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const dtfLongName = new NativeDTF('en-US', { timeZone: zone, timeZoneName: 'long' });
    const cache = new Map();
    const nativeGetTime = NativeDate.prototype.getTime;
    const nativeSetTime = NativeDate.prototype.setTime;
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Convert wall-clock fields to a UTC-like timestamp, including years 0-99.
    function utcFromFields(p) {
      const d = new NativeDate(0);
      d.setUTCFullYear(p.y, p.mo - 1, p.d);
      d.setUTCHours(p.h, p.mi, p.s, p.ms || 0);
      return d.getTime();
    }

    function partsAt(ms) {
      if (!Number.isFinite(ms)) return null;
      const sec = Math.floor(ms / 1000);
      let p = cache.get(sec);
      if (!p) {
        const obj = {};
        for (const part of dtfParts.formatToParts(new NativeDate(sec * 1000))) {
          if (part.type !== 'literal') obj[part.type] = Number(part.value);
        }
        p = {
          y: obj.year, mo: obj.month, d: obj.day,
          h: obj.hour, mi: obj.minute, s: obj.second,
        };
        p.asUtc = utcFromFields({ ...p, ms: 0 });
        p.offset = (sec * 1000 - p.asUtc) / 60000; // Same sign as getTimezoneOffset
        cache.set(sec, p);
        if (cache.size > 32) cache.delete(cache.keys().next().value);
      }
      return { ...p, ms: new NativeDate(ms).getUTCMilliseconds() };
    }

    function matchesLocal(a, b) {
      return a && a.y === b.y && a.mo === b.mo && a.d === b.d &&
        a.h === b.h && a.mi === b.mi && a.s === b.s && a.ms === b.ms;
    }

    // Resolve local clock fields to an instant, including DST gaps and overlaps.
    function epochFromLocal(local) {
      const target = utcFromFields(local);
      if (!Number.isFinite(target)) return NaN;
      const offsets = new Set();
      for (const delta of [-129600000, -86400000, 0, 86400000, 129600000]) {
        const p = partsAt(target + delta);
        if (p) offsets.add(p.offset);
      }
      const candidates = [...offsets].map(offset => {
        const instant = target + offset * 60000;
        const actual = partsAt(instant);
        return { instant, actual, localUtc: actual ? utcFromFields(actual) : NaN };
      }).filter(x => Number.isFinite(x.instant));
      const exact = candidates.filter(x => matchesLocal(x.actual, local));
      if (exact.length) return Math.min(...exact.map(x => x.instant));
      // In a spring-forward gap, choose the later corresponding instant.
      const later = candidates.filter(x => x.localUtc >= target)
        .sort((a, b) => a.localUtc - b.localUtc);
      if (later.length) return later[0].instant;
      return candidates.length ? candidates[candidates.length - 1].instant : NaN;
    }

    function patchGet(name, property) {
      Object.defineProperty(NativeDate.prototype, name, {
        configurable: true, writable: true,
        value: function () {
          const p = partsAt(nativeGetTime.call(this));
          return p ? p[property] : NaN;
        },
      });
    }

    for (const [name, prop] of Object.entries({
      getFullYear: 'y', getMonth: 'mo', getDate: 'd',
      getHours: 'h', getMinutes: 'mi', getSeconds: 's',
    })) {
      if (name === 'getMonth') {
        Object.defineProperty(NativeDate.prototype, name, {
          configurable: true, writable: true,
          value: function () {
            const p = partsAt(nativeGetTime.call(this));
            return p ? p.mo - 1 : NaN;
          },
        });
      } else patchGet(name, prop);
    }

    NativeDate.prototype.getDay = function () {
      const p = partsAt(nativeGetTime.call(this));
      if (!p) return NaN;
      return new NativeDate(utcFromFields({ ...p, h: 0, mi: 0, s: 0, ms: 0 })).getUTCDay();
    };
    NativeDate.prototype.getYear = function () { return this.getFullYear() - 1900; };
    NativeDate.prototype.getTimezoneOffset = function () {
      const p = partsAt(nativeGetTime.call(this));
      return p ? p.offset : NaN;
    };

    function localSetter(method, args, dateOnInvalid) {
      const ms = nativeGetTime.call(this);
      const p = partsAt(ms) || (dateOnInvalid ?
        { y: 1970, mo: 1, d: 1, h: 0, mi: 0, s: 0, ms: 0 } : null);
      if (!p) return nativeSetTime.call(this, NaN);
      const scratch = new NativeDate(utcFromFields(p));
      // Native UTC setters normalize overflow, preserving usual Date behavior.
      const normalizedMethod = 'setUTC' + method.slice(3);
      const result = NativeDate.prototype[normalizedMethod].apply(scratch, args);
      if (!Number.isFinite(result)) return nativeSetTime.call(this, NaN);
      const local = {
        y: scratch.getUTCFullYear(), mo: scratch.getUTCMonth() + 1,
        d: scratch.getUTCDate(), h: scratch.getUTCHours(),
        mi: scratch.getUTCMinutes(), s: scratch.getUTCSeconds(),
        ms: scratch.getUTCMilliseconds(),
      };
      return nativeSetTime.call(this, epochFromLocal(local));
    }

    for (const name of ['setFullYear', 'setMonth', 'setDate', 'setHours',
      'setMinutes', 'setSeconds', 'setMilliseconds']) {
      NativeDate.prototype[name] = function (...args) {
        return localSetter.call(this, name, args, name === 'setFullYear');
      };
    }
    NativeDate.prototype.setYear = function (year) {
      const n = Number(year);
      return this.setFullYear(Number.isNaN(n) ? NaN : (n >= 0 && n <= 99 ? n + 1900 : n));
    };

    function localIsoString(s) {
      if (typeof s !== 'string') return null;
      const m = /^(\d{4})-(\d\d)-(\d\d)[Tt ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,}))?)?$/.exec(s);
      if (!m) return null;
      const local = {
        y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5],
        s: +(m[6] || 0), ms: +((m[7] || '').slice(0, 3).padEnd(3, '0')),
      };
      if (local.mo < 1 || local.mo > 12 || local.d < 1 || local.d > 31 ||
          local.h > 24 || local.mi > 59 || local.s > 59 ||
          (local.h === 24 && (local.mi || local.s || local.ms))) return NaN;
      const scratch = new NativeDate(utcFromFields(local));
      if (scratch.getUTCFullYear() !== local.y || scratch.getUTCMonth() + 1 !== local.mo ||
          scratch.getUTCDate() !== local.d || scratch.getUTCHours() !== local.h) {
        // ISO permits 24:00:00 as midnight at the end of the day.
        if (local.h !== 24 || scratch.getUTCHours() !== 0) return NaN;
      }
      if (local.h === 24) {
        const normalized = new NativeDate(utcFromFields(local));
        local.y = normalized.getUTCFullYear();
        local.mo = normalized.getUTCMonth() + 1;
        local.d = normalized.getUTCDate();
        local.h = 0;
      }
      return epochFromLocal(local);
    }

    function TimezoneDate(...args) {
      if (!new.target) return new TimezoneDate().toString();
      // Preserve the prototype when a class extends Date.
      const finish = value => {
        if (new.target !== TimezoneDate) {
          Object.setPrototypeOf(value, new.target.prototype);
        }
        return value;
      };
      if (args.length === 0) return finish(new NativeDate());
      if (args.length === 1) {
        const parsed = localIsoString(args[0]);
        return finish(new NativeDate(parsed === null ? args[0] : parsed));
      }
      const p = {
        y: Number(args[0]), mo: Number(args[1]) + 1,
        d: args.length > 2 ? Number(args[2]) : 1,
        h: args.length > 3 ? Number(args[3]) : 0,
        mi: args.length > 4 ? Number(args[4]) : 0,
        s: args.length > 5 ? Number(args[5]) : 0,
        ms: args.length > 6 ? Number(args[6]) : 0,
      };
      if (p.y >= 0 && p.y <= 99) p.y += 1900;
      return finish(new NativeDate(epochFromLocal(p)));
    }
    Object.setPrototypeOf(TimezoneDate, NativeDate);
    TimezoneDate.prototype = NativeDate.prototype;
    Object.defineProperty(NativeDate.prototype, 'constructor', { value: TimezoneDate, configurable: true, writable: true });
    Object.defineProperty(TimezoneDate, 'name', { value: 'Date' });
    TimezoneDate.parse = s => {
      const parsed = localIsoString(String(s));
      return parsed === null ? NativeDate.parse(s) : parsed;
    };
    page.Date = TimezoneDate;

    function localDateText(p) {
      const dow = new NativeDate(utcFromFields({ ...p, h: 0, mi: 0, s: 0, ms: 0 })).getUTCDay();
      return `${weekdays[dow]} ${months[p.mo - 1]} ${String(p.d).padStart(2, '0')} ${String(p.y).padStart(4, '0')}`;
    }
    function localTimeText(ms, p) {
      const fmt = n => String(n).padStart(2, '0');
      const minutes = -p.offset;
      const sign = minutes >= 0 ? '+' : '-';
      const abs = Math.abs(Math.round(minutes));
      const gmt = `GMT${sign}${fmt(Math.floor(abs / 60))}${fmt(abs % 60)}`;
      const displayName = dtfLongName.formatToParts(new NativeDate(ms))
        .find(x => x.type === 'timeZoneName')?.value || zone;
      return `${fmt(p.h)}:${fmt(p.mi)}:${fmt(p.s)} ${gmt} (${displayName})`;
    }
    NativeDate.prototype.toDateString = function () {
      const p = partsAt(nativeGetTime.call(this));
      return p ? localDateText(p) : 'Invalid Date';
    };
    NativeDate.prototype.toTimeString = function () {
      const ms = nativeGetTime.call(this);
      const p = partsAt(ms);
      return p ? localTimeText(ms, p) : 'Invalid Date';
    };
    NativeDate.prototype.toString = function () {
      const ms = nativeGetTime.call(this);
      const p = partsAt(ms);
      return p ? `${localDateText(p)} ${localTimeText(ms, p)}` : 'Invalid Date';
    };

    // Respect an explicitly supplied timeZone; replace only the default.
    function DateTimeFormat(locales, options) {
      if (options != null && options.timeZone !== undefined) {
        return new NativeDTF(locales, options);
      }
      return new NativeDTF(locales, { ...(options || {}), timeZone: zone });
    }
    Object.setPrototypeOf(DateTimeFormat, NativeDTF);
    DateTimeFormat.prototype = NativeDTF.prototype;
    Object.defineProperty(DateTimeFormat, 'name', { value: 'DateTimeFormat' });
    page.Intl.DateTimeFormat = DateTimeFormat;

    for (const [method, type] of [
      ['toLocaleString', 'datetime'],
      ['toLocaleDateString', 'date'],
      ['toLocaleTimeString', 'time'],
    ]) {
      const original = NativeDate.prototype[method];
      NativeDate.prototype[method] = function (locales, options) {
        if (!Number.isFinite(nativeGetTime.call(this))) return 'Invalid Date';
        if (options != null && options.timeZone !== undefined) {
          return original.call(this, locales, options);
        }
        const opts = { ...(options || {}), timeZone: zone };
        if (!options || !Object.keys(options).length) {
          if (type !== 'time') Object.assign(opts, { year: 'numeric', month: 'numeric', day: 'numeric' });
          if (type !== 'date') Object.assign(opts, { hour: 'numeric', minute: 'numeric', second: 'numeric' });
        }
        const defaultLocale = (applied.localeEnabled || applied.regionEnabled) ? effectiveLocale(applied) : locales;
        return new NativeDTF(locales == null ? defaultLocale : locales, opts).format(this);
      };
    }

    // Override the default Temporal timezone when the API is available.
    try {
      if (page.Temporal?.Now?.timeZoneId) {
        Object.defineProperty(page.Temporal.Now, 'timeZoneId', {
          value: () => zone, configurable: true, writable: true,
        });
      }
    } catch { /* Some browser implementations disallow this override. */ }
  }
  installLocaleOverride();
  installFontMask();

  function verifySync(key) {
    try {
      switch (key) {
        case 'timezone': {
          if (applied.timezone === SYSTEM) return true;
          const actual = new page.Intl.DateTimeFormat().resolvedOptions().timeZone;
          const expected = validZone(applied.timezone);
          if (actual !== expected) return false;
          const sample = new NativeDate();
          const dtf = new NativeDTF('en-US-u-ca-gregory-nu-latn', {
            timeZone: applied.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
          });
          const p = Object.fromEntries(dtf.formatToParts(sample).filter(x => x.type !== 'literal')
            .map(x => [x.type, Number(x.value)]));
          return sample.getFullYear() === p.year && sample.getMonth() + 1 === p.month &&
            sample.getDate() === p.day && sample.getHours() === p.hour;
        }
        case 'languageEnabled':
        case 'matchLanguageRegions':
        case 'languages': {
          if (!applied.languageEnabled && !applied.matchLanguageRegions) return true;
          const expected = effectiveLanguages(applied);
          return page.navigator.language === expected[0] &&
            JSON.stringify([...page.navigator.languages]) === JSON.stringify(expected);
        }
        case 'localeEnabled':
        case 'locale':
        case 'regionEnabled':
        case 'region':
          return (!applied.localeEnabled && !applied.regionEnabled) ||
            new page.Intl.DateTimeFormat().resolvedOptions().locale ===
            (applied.regionEnabled ? effectiveLocale(applied) :
              new NativeDTF(effectiveLocale(applied)).resolvedOptions().locale);
        case 'ipConsistency': return true;
        case 'fonts': {
          if (!applied.fonts) return true;
          const canvas = page.document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return false;
          ctx.font = '18px "Microsoft YaHei", monospace';
          const a = ctx.measureText('Test text').width;
          ctx.font = '18px monospace';
          const b = ctx.measureText('Test text').width;
          if (Math.abs(a - b) > 0.01) return false;
          if (page.document.fonts?.check?.('18px "Microsoft YaHei"') !== false) return false;
          return true;
        }
        case 'rtc': return !applied.rtc || typeof page.RTCPeerConnection === 'function';
        default: return true;
      }
    } catch { return false; }
  }

  let restoredMessage = GM_getValue(NOTICE_KEY, '');
  if (restoredMessage) GM_setValue(NOTICE_KEY, '');
  const pending = GM_getValue(PENDING_KEY, null);
  if (pending && typeof pending === 'object' && pending.before && Array.isArray(pending.keys)) {
    const failed = pending.keys.filter(key => !verifySync(key));
    if (failed.length) {
      for (const key of failed) { prefs[key] = pending.before[key]; applied[key] = pending.before[key]; }
      persist();
      restoredMessage = `Verification failed for ${failed.join(', ')}. Previous values restored. Reload manually to restore page behavior.`;
      GM_setValue(NOTICE_KEY, restoredMessage);
    } else {
      restoredMessage = 'Saved settings passed JavaScript checks after reload.';
    }
    GM_setValue(PENDING_KEY, null);
  }
  // Verify defaults too. An unsupported browser must not show a false ON state.
  if (applied.fonts && !verifySync('fonts')) {
    applied.fonts = false;
    prefs.fonts = false;
    persist();
    restoredMessage = 'Font protection could not be verified and was switched off.';
  }
  if (applied.rtc && !verifySync('rtc')) {
    applied.rtc = false;
    prefs.rtc = false;
    persist();
    restoredMessage = 'WebRTC checking is unavailable in this browser and was switched off.';
  }

  function commit(key, value, requireReload) {
    if (!Object.prototype.hasOwnProperty.call(prefs, key)) return { ok: false, info: 'Unknown setting.' };
    const before = structuredCloneSafe(prefs[key]);
    if (JSON.stringify(before) === JSON.stringify(value)) return { ok: true, info: 'Already selected.' };
    if (requireReload) {
      let queue = GM_getValue(PENDING_KEY, null);
      if (!queue || !queue.before || !Array.isArray(queue.keys)) queue = { before: {}, keys: [] };
      if (!queue.keys.includes(key)) { queue.keys.push(key); queue.before[key] = before; }
      prefs[key] = value;
      persist();
      GM_setValue(PENDING_KEY, queue);
      // Never refresh until the user explicitly approves the prompt.
      const approve = page.confirm('Setting saved. Reload this page now to apply and verify it?');
      if (approve) page.location.reload();
      return { ok: true, info: approve ? 'Reloading for verification...' : 'Saved. Reload manually when ready; verification will run then.' };
    }
    prefs[key] = value;
    applied[key] = value;
    if (!verifySync(key)) {
      prefs[key] = before;
      applied[key] = before;
      return { ok: false, info: 'Verification failed. The switch has returned to its previous state.' };
    }
    persist();
    return { ok: true, info: 'Setting passed its JavaScript check.' };
  }

  const rtcState = { state: 'checking', details: 'Starting external WebRTC check...', httpIPv4: null };
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
  function externalIPv4() {
    return new Promise(resolve => {
      if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
      try {
        GM_xmlhttpRequest({
          method: 'GET', url: 'https://api.ipify.org?format=json', timeout: 5500,
          onload: response => {
            try {
              const ip = JSON.parse(response.responseText).ip;
              resolve(ipv4(ip) ? ip : null);
            } catch { resolve(null); }
          },
          onerror: () => resolve(null), ontimeout: () => resolve(null),
        });
      } catch { resolve(null); }
    });
  }
  function iceCandidates() {
    return new Promise(resolve => {
      if (typeof page.RTCPeerConnection !== 'function') return resolve({ candidates: [], error: 'WebRTC unavailable' });
      let pc = null;
      let completed = false;
      const candidates = [];
      const finish = error => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        try { pc?.close(); } catch {}
        resolve({ candidates, error: error || null });
      };
      const timeout = setTimeout(() => finish('ICE gathering timed out'), 7200);
      try {
        pc = new page.RTCPeerConnection({ iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        ] });
        pc.onicecandidate = ev => {
          if (!ev.candidate) return finish(null);
          const match = /(?:^|\s)(\d+|[\da-f]+)\s+(\d+|udp|tcp)\s+\d+\s+([^\s]+)\s+\d+\s+typ\s+(host|srflx|relay|prflx)/i
            .exec(ev.candidate.candidate || '');
          if (match) candidates.push({ ip: match[3], type: match[4] });
        };
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') finish(null);
        };
        pc.createDataChannel('network-check');
        pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(err => finish(err.message));
      } catch (err) { finish(err.message); }
    });
  }
  let rtcRunning = null;
  async function runRtcCheck() {
    if (!applied.rtc) { updateRtc('off', 'Automatic checking is disabled.'); return; }
    if (rtcRunning) return rtcRunning;
    updateRtc('checking', 'Checking WebRTC…');
    rtcRunning = (async () => {
      const [publicIp, result] = await Promise.all([externalIPv4(), iceCandidates()]);
      if (!applied.rtc) { updateRtc('off', 'Automatic checking is disabled.'); return; }
      rtcState.httpIPv4 = publicIp;
      const peerV4 = [...new Set(result.candidates.filter(c =>
        (c.type === 'srflx' || c.type === 'prflx' || c.type === 'host') && publicIPv4(c.ip))
        .map(c => c.ip))];
      const mismatched = publicIp && peerV4.filter(ip => ip !== publicIp);
      if (mismatched?.length) {
        updateRtc('leak', `WebRTC exposed ${mismatched.join(', ')}, different from the HTTP exit IP ${publicIp}.`);
      } else if (!publicIp) {
        updateRtc('limited', 'HTTP IP unavailable; WebRTC comparison incomplete.');
      } else if (result.error) {
        updateRtc('limited', `ICE incomplete: ${result.error}. No confirmed public-IP mismatch.`);
      } else if (!peerV4.length) {
        // LAN/private candidates and .local mDNS hostnames are explicitly ignored.
        // No public candidate is a limited test, not an IP leak or a warning.
        updateRtc('limited', `No public IPv4 ICE candidate observed; private LAN and mDNS candidates ignored. HTTP exit: ${publicIp}. Public WebRTC routing and IPv6 remain unverified.`);
      } else {
        updateRtc('safe', `No public IPv4 mismatch observed. HTTP exit: ${publicIp}. Private LAN candidates ignored; IPv6 and unobserved paths are not verified.`);
      }
    })().catch(err => updateRtc('limited', `Check incomplete: ${err.message}`)).finally(() => { rtcRunning = null; });
    return rtcRunning;
  }


  // Consistency is a cross-check across ALL script-visible environment signals,
  // not just configured region/timezone. A disagreement is NOT proof of location.
  const consistencyState = { state:'checking', details:'Checking browser language, Intl locale, region, timezone, UTC offset, HTTP IP and WebRTC...' };
  const consistencyListeners = new Set();
  function updateConsistency(state, details) {
    consistencyState.state = state;
    consistencyState.details = details;
    for (const cb of consistencyListeners) { try { cb(); } catch {} }
  }
  function geoLookup() {
    return new Promise(resolve => {
      if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
      try {
        GM_xmlhttpRequest({
          method:'GET', url:'https://ipapi.co/json/', timeout:7000,
          onload: response => {
            try {
              if (response.status !== 200) return resolve(null);
              const d=JSON.parse(response.responseText);
              if (d.error || !validRegion(d.country_code || d.country)) return resolve(null);
              resolve({ip:String(d.ip || ''),region:validRegion(d.country_code || d.country),
                timezone:validZone(d.timezone) || null});
            } catch { resolve(null); }
          },
          onerror:()=>resolve(null),ontimeout:()=>resolve(null),
        });
      } catch { resolve(null); }
    });
  }
  // IANA zones used by a country, including zones with shared offsets.
  const tzPrefixes = {a:'Africa',b:'America',c:'Antarctica',d:'Arctic',e:'Asia',f:'Atlantic',g:'Australia',h:'Europe',i:'Indian',j:'Pacific'};
  const zoneCountries = Object.fromEntries(`h/Andorra=AD|e/Dubai=AEOMRESCTF|e/Kabul=AF|b/Antigua=AG|b/Anguilla=AI|h/Tirane=AL|e/Yerevan=AM|a/Luanda=AO|c/McMurdo=AQ|c/Casey=AQ|c/Davis=AQ|c/DumontDUrville=AQ|c/Mawson=AQ|c/Palmer=AQ|c/Rothera=AQ|c/Syowa=AQ|c/Troll=AQ|c/Vostok=AQ|b/Argentina/Buenos_Aires=AR|b/Argentina/Cordoba=AR|b/Argentina/Salta=AR|b/Argentina/Jujuy=AR|b/Argentina/Tucuman=AR|b/Argentina/Catamarca=AR|b/Argentina/La_Rioja=AR|b/Argentina/San_Juan=AR|b/Argentina/Mendoza=AR|b/Argentina/San_Luis=AR|b/Argentina/Rio_Gallegos=AR|b/Argentina/Ushuaia=AR|j/Pago_Pago=ASUM|h/Vienna=AT|g/Lord_Howe=AU|c/Macquarie=AU|g/Hobart=AU|g/Melbourne=AU|g/Sydney=AU|g/Broken_Hill=AU|g/Brisbane=AU|g/Lindeman=AU|g/Adelaide=AU|g/Darwin=AU|g/Perth=AU|g/Eucla=AU|b/Aruba=AW|h/Mariehamn=AX|e/Baku=AZ|h/Sarajevo=BA|b/Barbados=BB|e/Dhaka=BD|h/Brussels=BELUNL|a/Ouagadougou=BF|h/Sofia=BG|e/Bahrain=BH|a/Bujumbura=BI|a/Porto-Novo=BJ|b/St_Barthelemy=BL|f/Bermuda=BM|e/Brunei=BN|b/La_Paz=BO|b/Kralendijk=BQ|b/Noronha=BR|b/Belem=BR|b/Fortaleza=BR|b/Recife=BR|b/Araguaina=BR|b/Maceio=BR|b/Bahia=BR|b/Sao_Paulo=BR|b/Campo_Grande=BR|b/Cuiaba=BR|b/Santarem=BR|b/Porto_Velho=BR|b/Boa_Vista=BR|b/Manaus=BR|b/Eirunepe=BR|b/Rio_Branco=BR|b/Nassau=BS|e/Thimphu=BT|a/Gaborone=BW|h/Minsk=BY|b/Belize=BZ|b/St_Johns=CA|b/Halifax=CA|b/Glace_Bay=CA|b/Moncton=CA|b/Goose_Bay=CA|b/Blanc-Sablon=CA|b/Toronto=BSCA|b/Iqaluit=CA|b/Atikokan=CA|b/Winnipeg=CA|b/Resolute=CA|b/Rankin_Inlet=CA|b/Regina=CA|b/Swift_Current=CA|b/Edmonton=CA|b/Cambridge_Bay=CA|b/Inuvik=CA|b/Creston=CA|b/Dawson_Creek=CA|b/Fort_Nelson=CA|b/Whitehorse=CA|b/Dawson=CA|b/Vancouver=CA|i/Cocos=CC|a/Kinshasa=CD|a/Lubumbashi=CD|a/Bangui=CF|a/Brazzaville=CG|h/Zurich=CHDELI|a/Abidjan=BFCIGHGMGNISMLMRSHSLSNTG|j/Rarotonga=CK|b/Santiago=CL|b/Coyhaique=CL|b/Punta_Arenas=CL|j/Easter=CL|a/Douala=CM|e/Shanghai=CN|e/Urumqi=CN|b/Bogota=CO|b/Costa_Rica=CR|b/Havana=CU|f/Cape_Verde=CV|b/Curacao=CW|i/Christmas=CX|e/Nicosia=CY|e/Famagusta=CY|h/Prague=CZSK|h/Berlin=DEDKNOSESJ|h/Busingen=DE|a/Djibouti=DJ|h/Copenhagen=DK|b/Dominica=DM|b/Santo_Domingo=DO|a/Algiers=DZ|b/Guayaquil=EC|j/Galapagos=EC|h/Tallinn=EE|a/Cairo=EG|a/El_Aaiun=EH|a/Asmara=ER|h/Madrid=ES|a/Ceuta=ES|f/Canary=ES|a/Addis_Ababa=ET|h/Helsinki=AXFI|j/Fiji=FJ|f/Stanley=FK|j/Chuuk=FM|j/Pohnpei=FM|j/Kosrae=FM|f/Faroe=FO|h/Paris=FRMC|a/Libreville=GA|h/London=GBGGIMJE|b/Grenada=GD|e/Tbilisi=GE|b/Cayenne=GF|h/Guernsey=GG|a/Accra=GH|h/Gibraltar=GI|b/Nuuk=GL|b/Danmarkshavn=GL|b/Scoresbysund=GL|b/Thule=GL|a/Banjul=GM|a/Conakry=GN|b/Guadeloupe=GP|a/Malabo=GQ|h/Athens=GR|f/South_Georgia=GS|b/Guatemala=GT|j/Guam=GUMP|a/Bissau=GW|b/Guyana=GY|e/Hong_Kong=HK|b/Tegucigalpa=HN|h/Zagreb=HR|b/Port-au-Prince=HT|h/Budapest=HU|e/Jakarta=ID|e/Pontianak=ID|e/Makassar=ID|e/Jayapura=ID|h/Dublin=IE|e/Jerusalem=IL|h/Isle_of_Man=IM|e/Kolkata=IN|i/Chagos=IO|e/Baghdad=IQ|e/Tehran=IR|f/Reykjavik=IS|h/Rome=ITSMVA|h/Jersey=JE|b/Jamaica=JM|e/Amman=JO|e/Tokyo=AUJP|a/Nairobi=DJERETKEKMMGSOTZUGYT|e/Bishkek=KG|e/Phnom_Penh=KH|j/Tarawa=KIMHTVUMWF|j/Kanton=KI|j/Kiritimati=KI|i/Comoro=KM|b/St_Kitts=KN|e/Pyongyang=KP|e/Seoul=KR|e/Kuwait=KW|b/Cayman=KY|e/Almaty=KZ|e/Qyzylorda=KZ|e/Qostanay=KZ|e/Aqtobe=KZ|e/Aqtau=KZ|e/Atyrau=KZ|e/Oral=KZ|e/Vientiane=LA|e/Beirut=LB|b/St_Lucia=LC|h/Vaduz=LI|e/Colombo=LK|a/Monrovia=LR|a/Maseru=LS|h/Vilnius=LT|h/Luxembourg=LU|h/Riga=LV|a/Tripoli=LY|a/Casablanca=MA|h/Monaco=MC|h/Chisinau=MD|h/Podgorica=ME|b/Marigot=MF|i/Antananarivo=MG|j/Majuro=MH|j/Kwajalein=MH|h/Skopje=MK|a/Bamako=ML|e/Yangon=CCMM|e/Ulaanbaatar=MN|e/Hovd=MN|e/Macau=MO|j/Saipan=MP|b/Martinique=MQ|a/Nouakchott=MR|b/Montserrat=MS|h/Malta=MT|i/Mauritius=MU|i/Maldives=MVTF|a/Blantyre=MW|b/Mexico_City=MX|b/Cancun=MX|b/Merida=MX|b/Monterrey=MX|b/Matamoros=MX|b/Chihuahua=MX|b/Ciudad_Juarez=MX|b/Ojinaga=MX|b/Mazatlan=MX|b/Bahia_Banderas=MX|b/Hermosillo=MX|b/Tijuana=MX|e/Kuala_Lumpur=MY|e/Kuching=BNMY|a/Maputo=BIBWCDMWMZRWZMZW|a/Windhoek=NA|j/Noumea=NC|a/Niamey=NE|j/Norfolk=NF|a/Lagos=AOBJCDCFCGCMGAGQNENG|b/Managua=NI|h/Amsterdam=NL|h/Oslo=NO|e/Kathmandu=NP|j/Nauru=NR|j/Niue=NU|j/Auckland=AQNZ|j/Chatham=NZ|e/Muscat=OM|b/Panama=CAKYPA|b/Lima=PE|j/Tahiti=PF|j/Marquesas=PF|j/Gambier=PF|j/Port_Moresby=AQFMPG|j/Bougainville=PG|e/Manila=PH|e/Karachi=PK|h/Warsaw=PL|b/Miquelon=PM|j/Pitcairn=PN|b/Puerto_Rico=AGAIAWBLBQCACWDMGDGPKNLCMFMSPRSXTTVCVGVI|e/Gaza=PS|e/Hebron=PS|h/Lisbon=PT|f/Madeira=PT|f/Azores=PT|j/Palau=PW|b/Asuncion=PY|e/Qatar=BHQA|i/Reunion=RE|h/Bucharest=RO|h/Belgrade=BAHRMEMKRSSI|h/Kaliningrad=RU|h/Moscow=RU|h/Simferopol=RUUA|h/Kirov=RU|h/Volgograd=RU|h/Astrakhan=RU|h/Saratov=RU|h/Ulyanovsk=RU|h/Samara=RU|e/Yekaterinburg=RU|e/Omsk=RU|e/Novosibirsk=RU|e/Barnaul=RU|e/Tomsk=RU|e/Novokuznetsk=RU|e/Krasnoyarsk=RU|e/Irkutsk=RU|e/Chita=RU|e/Yakutsk=RU|e/Khandyga=RU|e/Vladivostok=RU|e/Ust-Nera=RU|e/Magadan=RU|e/Sakhalin=RU|e/Srednekolymsk=RU|e/Kamchatka=RU|e/Anadyr=RU|a/Kigali=RW|e/Riyadh=AQKWSAYE|j/Guadalcanal=FMSB|i/Mahe=SC|a/Khartoum=SD|h/Stockholm=SE|e/Singapore=AQMYSG|f/St_Helena=SH|h/Ljubljana=SI|d/Longyearbyen=SJ|h/Bratislava=SK|a/Freetown=SL|h/San_Marino=SM|a/Dakar=SN|a/Mogadishu=SO|b/Paramaribo=SR|a/Juba=SS|a/Sao_Tome=ST|b/El_Salvador=SV|b/Lower_Princes=SX|e/Damascus=SY|a/Mbabane=SZ|b/Grand_Turk=TC|a/Ndjamena=TD|i/Kerguelen=TF|a/Lome=TG|e/Bangkok=CXKHLATHVN|e/Dushanbe=TJ|j/Fakaofo=TK|e/Dili=TL|e/Ashgabat=TM|a/Tunis=TN|j/Tongatapu=TO|h/Istanbul=TR|b/Port_of_Spain=TT|j/Funafuti=TV|e/Taipei=TW|a/Dar_es_Salaam=TZ|h/Kyiv=UA|a/Kampala=UG|j/Midway=UM|j/Wake=UM|b/New_York=US|b/Detroit=US|b/Kentucky/Louisville=US|b/Kentucky/Monticello=US|b/Indiana/Indianapolis=US|b/Indiana/Vincennes=US|b/Indiana/Winamac=US|b/Indiana/Marengo=US|b/Indiana/Petersburg=US|b/Indiana/Vevay=US|b/Chicago=US|b/Indiana/Tell_City=US|b/Indiana/Knox=US|b/Menominee=US|b/North_Dakota/Center=US|b/North_Dakota/New_Salem=US|b/North_Dakota/Beulah=US|b/Denver=US|b/Boise=US|b/Phoenix=CAUS|b/Los_Angeles=US|b/Anchorage=US|b/Juneau=US|b/Sitka=US|b/Metlakatla=US|b/Yakutat=US|b/Nome=US|b/Adak=US|j/Honolulu=US|b/Montevideo=UY|e/Samarkand=UZ|e/Tashkent=UZ|h/Vatican=VA|b/St_Vincent=VC|b/Caracas=VE|b/Tortola=VG|b/St_Thomas=VI|e/Ho_Chi_Minh=VN|j/Efate=VU|j/Wallis=WF|j/Apia=WS|e/Aden=YE|i/Mayotte=YT|a/Johannesburg=LSSZZA|a/Lusaka=ZM|a/Harare=ZW`.split('|').map(record => {
    const [z, codes] = record.split('=');
    return [tzPrefixes[z[0]] + z.slice(1), codes.match(/.{2}/g)];
  }));
  function countriesForZone(input) {
    if (!input || input === SYSTEM) return [];
    const clean = validZone(input);
    if (!clean) return [];
    return zoneCountries[clean] || zoneCountries[input] || [];
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
      // The saved Region is not an exposed browser setting when its switch is off.
      selectedRegion:applied.regionEnabled ? applied.region : null,
    };
  }
  function compareEnvironment(geo, rtc) {
    const v = getEnvironmentSnapshot();
    const issues = [];
    const add = (a,b,description) => {
      if (a && b && a !== b) issues.push(`${description}: ${a} vs ${b}`);
    };
    const ipCountry = geo?.region || null;
    const zoneRegions = countriesForZone(v.timeZone);
    const zoneKnown = zoneRegions.length > 0;
    add(v.selectedRegion, ipCountry, 'Selected region vs IP country');
    add(v.languageRegion, ipCountry, 'Primary browser language region vs IP country');
    add(v.localeRegion, ipCountry, 'Intl date locale region vs IP country');
    add(v.numberRegion, ipCountry, 'Intl number locale region vs IP country');
    add(v.selectedRegion, v.languageRegion, 'Selected region vs primary language region');
    add(v.selectedRegion, v.localeRegion, 'Selected region vs Intl locale region');
    add(v.selectedRegion, v.numberRegion, 'Selected region vs number locale region');
    add(v.languageRegion, v.localeRegion, 'Primary language region vs Intl locale region');
    add(v.localeRegion, v.numberRegion, 'Date vs number locale region');
    if (v.primary && v.languageList.length && v.primary !== v.languageList[0]) {
      issues.push(`navigator.language ${v.primary} differs from navigator.languages[0] ${v.languageList[0]}`);
    }
    if (zoneKnown) {
      for (const [name,country] of [
        ['IP country',ipCountry],['selected region',v.selectedRegion],
        ['primary language region',v.languageRegion],['Intl locale region',v.localeRegion],
      ]) {
        if (country && !zoneRegions.includes(country)) {
          issues.push(`Timezone ${v.timeZone} is not mapped to ${name} ${country}`);
        }
      }
    }
    const expectedOffset = v.timeZone ? currentOffsetForZone(v.timeZone) : null;
    if (expectedOffset !== null && v.offset !== null &&
        Number.isFinite(v.offset) && Math.abs(expectedOffset - v.offset) > 1) {
      issues.push(`Timezone offset mismatch: Date ${v.offset} min vs ${v.timeZone} expected ${expectedOffset} min`);
    }
    if (applied.timezone !== SYSTEM && v.timeZone && validZone(applied.timezone) !== v.timeZone) {
      issues.push(`Configured timezone ${applied.timezone} differs from exposed ${v.timeZone}`);
    }
    if (applied.languageEnabled || applied.matchLanguageRegions) {
      const expected = effectiveLanguages(applied);
      if (JSON.stringify(v.languageList) !== JSON.stringify(expected) || v.primary !== expected[0]) {
        issues.push('Browser language override is not returning the expected language order');
      }
    }
    if ((applied.localeEnabled || applied.regionEnabled) && v.localeRegion !==
        regionInLanguage(effectiveLocale(applied))) {
      issues.push(`Intl locale override is not exposing the expected region`);
    }
    if (applied.fonts && !verifySync('fonts')) {
      issues.push('Font masking did not pass the supported JavaScript checks');
    }
    if (geo?.ip && rtc.httpIPv4 && ipv4(geo.ip) && geo.ip !== rtc.httpIPv4) {
      issues.push(`HTTP IP providers disagree: ipapi.co ${geo.ip} vs api.ipify.org ${rtc.httpIPv4} (proxy rotation can cause this)`);
    }
    if (rtc.state === 'leak') issues.push(`WebRTC public-IP mismatch: ${rtc.details}`);
    // Keep the underlying comparisons; display only a short, deduplicated summary.
    const short = [];
    const labels = [
      ['Selected region vs IP country', 'Region / IP'],
      ['Primary browser language region vs IP country', 'Language / IP'],
      ['Intl date locale region vs IP country', 'Intl / IP'],
      ['Intl number locale region vs IP country', 'Intl / IP'],
      ['Timezone offset mismatch', 'UTC offset'],
      ['Timezone ', 'Timezone'],
      ['WebRTC public-IP mismatch', 'WebRTC / IP'],
      ['HTTP IP providers disagree', 'IP services'],
      ['Browser language override', 'Language override'],
      ['Font masking', 'Font protection'],
      ['Intl locale override', 'Intl override'],
      ['Configured timezone', 'Timezone override'],
    ];
    for (const issue of issues) {
      const label = labels.find(([prefix]) => issue.startsWith(prefix));
      let tiny = label ? label[1] : issue.slice(0, 42);
      if (issue.includes(': ') && label && ['Region / IP', 'Language / IP', 'Intl / IP'].includes(tiny)) {
        tiny += ' ' + issue.split(': ').pop().replace(' vs ', '/');
      }
      if (!short.includes(tiny)) short.push(tiny);
    }
    if (issues.length) return {
      state:'warning', details:`${short.length} conflict${short.length === 1 ? '' : 's'}: ${short.slice(0, 3).join(' · ')}${short.length > 3 ? ` · +${short.length - 3}` : ''}`,
    };
    if (!geo) return {state:'unknown', details:'IP location unavailable · Comparison incomplete'};
    return {state:'ok', details:'No observed conflicts · Checks are limited to accessible signals'};

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
    if (!geoResult && !geoPromise) geoPromise = geoLookup().then(result => {
      geoResult = result; geoPromise = null; return result;
    }, () => { geoPromise = null; return null; });
    if (geoPromise) await geoPromise;
    if (serial !== consistencySequence || !prefs.ipConsistency) return;
    const result = compareEnvironment(geoResult, rtcState);
    updateConsistency(result.state,result.details);
  }

  const fallbackZones = Object.keys(zoneCountries);
  // An enumerable language directory is not provided by browsers. This list
  // includes browser-reported languages and many supported BCP-47 language IDs.
  const languageCodes = `aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(' ');
  const regionalLocales = `en-US en-GB en-AU en-CA en-IN en-NZ zh-CN zh-TW zh-HK zh-SG zh-MO zh-Hans zh-Hant ja-JP ko-KR fr-FR fr-CA fr-BE fr-CH de-DE de-AT de-CH es-ES es-MX es-AR es-CO es-CL es-US pt-BR pt-PT ru-RU it-IT nl-NL nl-BE ar-SA ar-EG ar-AE ar-MA hi-IN bn-BD bn-IN ur-PK ur-IN pa-IN pa-PK ta-IN ta-LK te-IN mr-IN gu-IN kn-IN ml-IN th-TH vi-VN id-ID ms-MY fil-PH tr-TR pl-PL uk-UA ro-RO hu-HU cs-CZ sk-SK sl-SI hr-HR sr-RS sr-Latn-RS bg-BG el-GR he-IL fa-IR sv-SE no-NO nb-NO nn-NO da-DK fi-FI is-IS et-EE lv-LV lt-LT sw-KE sw-TZ af-ZA zu-ZA am-ET so-SO ne-NP si-LK km-KH lo-LA my-MM mn-MN kk-KZ uz-UZ az-AZ ka-GE hy-AM eu-ES ca-ES gl-ES cy-GB ga-IE sq-AL mk-MK bs-BA`.split(' ');
  const languageLabels = (() => {
    const candidates = [...new Set([...originalLanguages, ...applied.languages,
      ...languageCodes, ...regionalLocales])];
    const supported = page.Intl.DateTimeFormat.supportedLocalesOf(candidates);
    const display = typeof page.Intl.DisplayNames === 'function'
      ? new page.Intl.DisplayNames(['en'], { type: 'language' }) : null;
    return supported.map(code => ({
      code,
      label: display ? `${display.of(code)} (${code})` : code,
    })).sort((a, b) => a.label.localeCompare(b.label, 'en'));
  })();
  const zones = (() => {
    let list = [];
    try { list = page.Intl.supportedValuesOf?.('timeZone') || []; } catch {}
    if (!list.length) list = fallbackZones;
    return [...new Set(['UTC', ...list, ...(zone !== SYSTEM ? [zone] : [])])].sort();
  })();

  let showPanel = null;
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open Environment Manager', () => {
      if (showPanel) { showPanel(); return; }
      if (page.top !== page) return;
      if (document.body) { createWidget(); showPanel?.(); }
      else document.addEventListener('DOMContentLoaded', () => { createWidget(); showPanel?.(); }, { once: true });
    });
  }

  function createWidget() {
    if (page.top !== page || !document.body || document.getElementById('ca-env-manager-host')) return;
    const host = document.createElement('div');
    host.id = 'ca-env-manager-host';
    host.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;pointer-events:none;width:0;height:0;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { all:initial;color-scheme:light dark; }
        *, *::before, *::after {box-sizing:border-box;}
        .fab {pointer-events:auto;display:block;position:absolute;top:0;left:0;border:1px solid #536b88;
          border-radius:999px;min-width:72px;min-height:38px;padding:7px 11px;
          color:#fff;background:#263e61;box-shadow:0 4px 15px #0004;
          font:700 13px system-ui,Arial,sans-serif;cursor:grab;touch-action:none;
          user-select:none;-webkit-user-select:none;white-space:nowrap;}
        .fab:active {cursor:grabbing;}
        .fab.leak {background:#af1e29;border-color:#ee8790;animation:warn-pulse 1.8s ease-in-out infinite;}
        .fab.consistency {background:#98610f;border-color:#e8b45b;}
        .fab.off {background:#515861;border-color:#767e87;}
        @keyframes warn-pulse {50% {box-shadow:0 0 0 5px #d32f2f50;}}
        .panel {pointer-events:auto;position:fixed;width:min(390px,calc(100vw - 24px));
          max-height:min(80vh,650px);overflow-y:auto;overscroll-behavior:contain;
          padding:16px;border-radius:15px;border:1px solid #d6dde8;background:#fff;color:#202b39;
          box-shadow:0 14px 48px #0005;font:13px/1.45 system-ui,Arial,sans-serif;}
        .head,.setting,.actionrow,.inputrow,.chip {display:flex;align-items:center;gap:8px;}
        .head,.setting {justify-content:space-between;}
        .head strong {font-size:16px;}
        .muted {color:#64748b;font-size:11px;line-height:1.5;}
        .section {padding:12px 0;border-bottom:1px solid #e6eaf0;}
        .section:last-of-type {border:0;}
        .label {font-size:13px;font-weight:700;}
        .sub {margin:5px 0 8px;color:#657286;font-size:11px;line-height:1.5;overflow-wrap:anywhere;}
        input[type=text],input[type=search] {min-width:0;flex:1;width:100%;height:36px;border-radius:8px;
          border:1px solid #9aa8bd;background:white;color:#1d293a;padding:8px 9px;font:12px system-ui,sans-serif;}
        input:focus, button:focus-visible {outline:2px solid #4576ce;outline-offset:1px;}
        input[type=checkbox] {width:19px;height:19px;flex:0 0 19px;accent-color:#416fd4;cursor:pointer;}
        button {cursor:pointer;border-radius:8px;border:1px solid #bac5d3;background:#f7f9fc;
          color:#26364e;padding:8px 10px;font:600 12px system-ui,sans-serif;}
        .primary {background:#385fd0;color:#fff;border-color:#385fd0;}
        .tiny {font-size:11px;padding:5px 8px;}
        .list {border:1px solid #d7dfe9;border-radius:8px;margin-top:5px;max-height:145px;
          overflow:auto;overscroll-behavior:contain;}
        .option {display:block;width:100%;text-align:left;border:0;border-radius:0;
          border-bottom:1px solid #eff2f7;background:transparent;font-weight:500;padding:7px 9px;
          white-space:normal;overflow-wrap:anywhere;}
        .option:hover,.option:focus {background:#e7efff;}
        .chips {display:flex;flex-direction:column;gap:4px;margin:8px 0;max-height:130px;overflow:auto;}
        .chip {justify-content:space-between;border-radius:7px;background:#f1f4f8;padding:4px 6px;}
        .chip span {flex:1;overflow-wrap:anywhere;}
        .summary {display:flex;gap:6px;align-items:center;margin:10px 0 2px;}
        .summary .status {margin:0;flex:1;min-width:0;font-size:11px;padding:8px;}
        .summary button {flex:none;padding:6px 10px;}
        .status {margin-top:11px;padding:9px;border-radius:9px;background:#f0f4f9;
          color:#32435d;font-size:12px;overflow-wrap:anywhere;white-space:pre-line;}
        .status.ok {background:#eaf7ef;color:#17613c;}
        .status.warning {background:#fff2d7;color:#78520e;}
        .status.leak,.status.error {background:#fce8e9;color:#a22127;}
        /* Separate from the scrolling panel: alerts always float at its visible bottom. */
        .toast {position:fixed;z-index:10;pointer-events:none;margin:0;padding:10px 12px;
          max-height:120px;overflow:hidden;overflow-wrap:anywhere;border-radius:9px;
          border:1px solid #b3dfc3;background:#eaf7ef;color:#17613c;
          box-shadow:0 5px 20px #0005;font:600 12px/1.45 system-ui,Arial,sans-serif;
          text-align:center;}
        .toast.error {background:#fce8e9;border-color:#edabb0;color:#a22127;}
        .count {padding:4px;color:#69788c;font-size:11px;}
        [hidden] {display:none!important;}
        @media (prefers-color-scheme:dark) {
          .panel {background:#17212e;color:#eef2f7;border-color:#39495e;}
          .section {border-color:#34465a;}
          .muted,.sub,.count {color:#acbdd2;}
          input[type=text],input[type=search] {background:#222f41;color:#fff;border-color:#697b92;}
          button {background:#283a4d;color:#f1f5fa;border-color:#53677f;}
          .primary {background:#385fd0;border-color:#385fd0;color:white;}
          .chip {background:#293b4e;}
          .option {border-color:#35485f;}
          .option:hover,.option:focus {background:#354c70;}
          .status {background:#28394c;color:#d3e2f5;}
          .status.ok {background:#164a34;color:#b5f3d0;}
          .status.warning {background:#564018;color:#ffe3a1;}
          .status.leak,.status.error {background:#591f28;color:#ffc2c8;}
          .toast {background:#164a34;border-color:#34775a;color:#b5f3d0;}
          .toast.error {background:#591f28;border-color:#a44350;color:#ffc2c8;}
        }
      </style>
      <button id="fab" class="fab" type="button" aria-label="Environment Manager; drag to move">TZ ⚙</button>
      <section id="panel" class="panel" role="dialog" aria-label="Environment Manager" hidden>
        <div class="head"><strong>Environment Settings</strong><button id="close" class="tiny" type="button" aria-label="Close">✕</button></div>
        <div class="summary" id="consistencyTop">
          <div class="status" id="consistencyStatus" role="status" aria-live="polite"></div>
          <button class="tiny" id="consistencyRetry" type="button" title="Recheck all signals">↻</button>
        </div>
        <div class="section">
          <div class="label">Timezone</div>
          <div class="sub" id="tzNow"></div>
          <div class="inputrow"><input id="tzInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search or enter an IANA timezone"><button class="primary" id="tzSave" type="button">Save</button></div>
          <div class="list" id="tzOptions"></div><div class="count" id="tzCount"></div>
          <button id="tzSystem" class="tiny" type="button">Use system timezone</button>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Region (JavaScript)</span><input id="regionOn" type="checkbox" aria-label="Enable region override"></div>
          <div class="sub">Sets the default Intl region only; not the device or IP.</div>
          <div class="inputrow"><input id="regionInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search a country or enter ISO code, e.g. JP"><button id="regionSave" class="primary" type="button">Save</button></div>
          <div id="regionOptions" class="list"></div><div id="regionCount" class="count"></div>
          <div class="sub" id="regionEffective"></div>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Match Language Regions</span><input id="matchOn" type="checkbox" aria-label="Automatically match browser languages to their usual regions"></div>
          <div class="sub">Matches language tags to their usual regions. Custom lists take priority.</div>
          <div class="sub" id="matchedLanguages"></div>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Browser Languages</span><input id="languageOn" type="checkbox" aria-label="Enable browser language override"></div>
          <div class="sub">Detected: <span id="originalLanguages"></span>. First entry is the primary language.</div>
          <div id="languageEditor">
            <div class="chips" id="chips"></div>
            <div class="inputrow"><input id="languageInput" type="search" autocomplete="off" spellcheck="false" placeholder="Find or enter any BCP-47 language"><button id="languageAdd" type="button">Add</button></div>
            <div id="languageOptions" class="list"></div><div id="languageCount" class="count"></div>
            <button id="languageSave" class="primary" type="button">Save language order</button>
          </div>
          <div class="sub">HTTP language headers are not changed.</div>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Intl Locale</span><input id="localeOn" type="checkbox" aria-label="Enable Intl locale override"></div>
          <div class="sub">Default: <span id="nativeLocale"></span>. Region overrides its regional subtag.</div>
          <div class="inputrow"><input id="localeInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search or enter a BCP-47 locale"><button id="localeSave" class="primary" type="button">Save</button></div>
          <div id="localeOptions" class="list"></div><div id="localeCount" class="count"></div>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Chinese Font Protection</span><input id="fontOn" type="checkbox" aria-label="Enable Chinese font masking"></div>
          <div class="sub">Masks ${fontFamilies.length} common font names in supported APIs; text still renders normally.</div>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Automatic WebRTC Leak Check</span><input id="rtcOn" type="checkbox" aria-label="Enable automatic WebRTC leak check"></div>
          <div class="sub">Checks public IPv4 ICE vs HTTP IP. LAN/mDNS ignored; incomplete checks are neutral. Does not block WebRTC.</div>
          <div class="status" id="rtcStatus"></div>
          <button id="rtcRetry" class="tiny" type="button">Check again</button>
        </div>
        <div class="section">
          <div class="setting"><span class="label">Full Environment Consistency</span><input id="ipConsistencyOn" type="checkbox" aria-label="Enable full environment consistency checks"></div>
          <div class="sub">Compares languages, Intl, region, timezone, IP, WebRTC and available font APIs.</div>
        </div>
        <div class="actionrow" style="margin-top:12px;justify-content:flex-end"><button id="reset" type="button">Reset to defaults</button></div>
      </section>
      <div class="toast" id="message" role="status" aria-live="polite" hidden></div>
    `;
    const $ = name => shadow.getElementById(name);
    const fab = $('fab');
    const panel = $('panel');
    const EDGE = 12;
    const bound = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const savedPosition = GM_getValue(POSITION_KEY, null);
    function validPosition(v) {
      return v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1;
    }
    let position = validPosition(savedPosition) ? { x: savedPosition.x, y: savedPosition.y } : { x: 0, y: 1 };
    function bounds() {
      const width = document.documentElement.clientWidth || page.innerWidth;
      const height = page.innerHeight || document.documentElement.clientHeight;
      return { width, height,
        maxLeft: Math.max(EDGE, width - EDGE - fab.offsetWidth),
        maxTop: Math.max(EDGE, height - EDGE - fab.offsetHeight) };
    }
    function layout() {
      if (panel.hidden) return;
      const b = bounds();
      const rect = fab.getBoundingClientRect();
      const availableTop = Math.max(0, rect.top - EDGE - 8);
      const availableBottom = Math.max(0, b.height - rect.bottom - EDGE - 8);
      const showBelow = availableBottom >= availableTop;
      const available = showBelow ? availableBottom : availableTop;
      panel.style.maxHeight = `${Math.max(50, Math.min(650, b.height * .80, available))}px`;
      panel.style.left = `${bound(rect.left, EDGE, Math.max(EDGE, b.width - EDGE - panel.offsetWidth))}px`;
      const h = panel.getBoundingClientRect().height;
      panel.style.top = `${bound(showBelow ? rect.bottom + 8 : rect.top - 8 - h,
        EDGE, Math.max(EDGE, b.height - EDGE - h))}px`;
      const toast = $('message');
      if (!toast.hidden) {
        const popup = panel.getBoundingClientRect();
        toast.style.width = `${Math.max(50, popup.width - 24)}px`;
        toast.style.left = `${popup.left + 12}px`;
        toast.style.top = `${Math.max(popup.top + 8,
          popup.bottom - toast.offsetHeight - 12)}px`;
      }
    }
    function applyPosition() {
      const b = bounds();
      host.style.left = `${EDGE + position.x * (b.maxLeft - EDGE)}px`;
      host.style.top = `${EDGE + position.y * (b.maxTop - EDGE)}px`;
      layout();
    }
    let drag = null;
    let lastDragEnded = -Infinity;
    fab.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary) return;
      drag = { id:e.pointerId, x:e.clientX, y:e.clientY,
        left:parseFloat(host.style.left), top:parseFloat(host.style.top), moved:false };
      fab.setPointerCapture(e.pointerId);
    });
    fab.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      e.preventDefault();
      const b = bounds();
      const left = bound(drag.left + dx, EDGE, b.maxLeft);
      const top = bound(drag.top + dy, EDGE, b.maxTop);
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      position = {
        x: b.maxLeft === EDGE ? 0 : (left - EDGE) / (b.maxLeft - EDGE),
        y: b.maxTop === EDGE ? 0 : (top - EDGE) / (b.maxTop - EDGE),
      };
      layout();
    });
    function finishDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.moved) {
        lastDragEnded = performance.now();
        GM_setValue(POSITION_KEY, { ...position });
      }
      if (fab.hasPointerCapture(e.pointerId)) fab.releasePointerCapture(e.pointerId);
      drag = null;
    }
    fab.addEventListener('pointerup', finishDrag);
    fab.addEventListener('pointercancel', finishDrag);
    page.addEventListener('resize', applyPosition, { passive:true });
    if (typeof GM_addValueChangeListener === 'function') {
      GM_addValueChangeListener(POSITION_KEY, (_key,_old,val,remote) => {
        if (!remote || !validPosition(val) || drag) return;
        position = { x:val.x,y:val.y }; applyPosition();
      });
    }

    let messageTimer = null;
    function clearMessage() {
      if (messageTimer !== null) page.clearTimeout(messageTimer);
      messageTimer = null;
      $('message').hidden = true;
    }
    function message(info, isError = false) {
      clearMessage();
      const toast = $('message');
      toast.className = `toast${isError ? ' error' : ''}`;
      toast.textContent = info;
      if (panel.hidden) showPanel();
      toast.hidden = false;
      layout();
      messageTimer = page.setTimeout(() => {
        toast.hidden = true;
        messageTimer = null;
      }, isError ? 4800 : 3200);
    }
    function setting(key, value, reload) {
      const result = commit(key, value, reload);
      message(result.info, !result.ok);
      syncControls();
      if (prefs.ipConsistency) runConsistencyCheck();
      return result.ok;
    }
    function renderRtc() {
      let label = '';
      const regionWarning = prefs.ipConsistency && consistencyState.state === 'warning';
      switch (rtcState.state) {
        case 'leak': label = '⚠ TZ !'; break;
        case 'unknown': label = 'TZ ·'; break;
        case 'checking': label = 'TZ …'; break;
        case 'off': label = 'TZ ⚙'; break;
        default: label = 'TZ ✓';
      }
      if (regionWarning && rtcState.state !== 'leak') label = '⚠ TZ !';
      if (rtcState.state === 'limited' && !regionWarning) label = 'TZ ·';
      fab.textContent = label;
      fab.className = `fab ${rtcState.state === 'leak' ? 'leak' : regionWarning ? 'consistency' : rtcState.state === 'off' ? 'off' : ''}`;
      $('rtcStatus').className = `status ${rtcState.state === 'leak' ? 'leak' : rtcState.state === 'safe' ? 'ok' : (rtcState.state === 'off' || rtcState.state === 'limited' || rtcState.state === 'unknown') ? '' : 'warning'}`;
      $('rtcStatus').textContent = rtcState.state === 'limited' ? `INCOMPLETE: ${rtcState.details}` : `${rtcState.state.toUpperCase()}: ${rtcState.details}`;
    }
    subscribers.add(renderRtc);
    function renderConsistency() {
      $('consistencyStatus').className = `status ${consistencyState.state === 'warning' ? 'warning' : consistencyState.state === 'ok' ? 'ok' : ''}`;
      $('consistencyStatus').textContent = `${consistencyState.state.toUpperCase()}: ${consistencyState.details}`;
      renderRtc();
    }
    consistencyListeners.add(renderConsistency);
    function syncControls() {
      $('tzNow').textContent = `Saved: ${prefs.timezone === SYSTEM ? `System (${systemZone})` : prefs.timezone}`;
      $('languageOn').checked = prefs.languageEnabled;
      $('matchOn').checked = prefs.matchLanguageRegions;
      $('regionOn').checked = prefs.regionEnabled;
      $('ipConsistencyOn').checked = prefs.ipConsistency;
      $('regionEffective').textContent = `Default Intl locale after overrides: ${effectiveLocale(prefs)}`;
      $('matchedLanguages').textContent = `Effective languages: ${effectiveLanguages(prefs).join(', ')}`;
      $('localeOn').checked = prefs.localeEnabled;
      $('fontOn').checked = prefs.fonts;
      $('rtcOn').checked = prefs.rtc;
      $('languageEditor').hidden = !prefs.languageEnabled;
      renderRtc();
      renderConsistency();
    }
    $('originalLanguages').textContent = originalLanguages.join(', ');
    $('nativeLocale').textContent = originalLocale;

    function showOptions(root, found, field, countId, max = 90) {
      const fragment = document.createDocumentFragment();
      for (const item of found.slice(0,max)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option';
        btn.textContent = item.label || item.code;
        btn.addEventListener('click', () => {
          $(field).value = item.code;
          $(root).hidden = true;
        });
        fragment.appendChild(btn);
      }
      $(root).replaceChildren(fragment);
      $(countId).textContent = `Showing ${Math.min(max,found.length)} / ${found.length}`;
      $(root).hidden = found.length === 0;
      layout();
    }
    $('tzInput').value = prefs.timezone === SYSTEM ? '' : prefs.timezone;
    function tzResults() {
      const q = $('tzInput').value.toLowerCase().trim().replaceAll(' ', '_');
      const found = zones.filter(z => z.toLowerCase().includes(q)).map(z => ({ code:z, label:z }));
      showOptions('tzOptions',found,'tzInput','tzCount');
    }
    $('tzInput').addEventListener('input', tzResults);
    $('tzSave').addEventListener('click', () => {
      const valid = validZone($('tzInput').value);
      if (!valid) return message('Invalid IANA timezone. Example: America/New_York.',true);
      setting('timezone',valid,true);
    });
    $('tzSystem').addEventListener('click', () => {
      $('tzInput').value = '';
      setting('timezone',SYSTEM,true);
    });

    $('regionInput').value = prefs.region;
    function regionResults() {
      const q=$('regionInput').value.trim().toLowerCase();
      showOptions('regionOptions', countries.filter(x => x.code.toLowerCase().includes(q) || x.label.toLowerCase().includes(q)),
        'regionInput','regionCount',90);
    }
    $('regionInput').addEventListener('input',regionResults);
    $('regionOn').addEventListener('change',e=>{
      setting('regionEnabled',e.target.checked,true);
      runConsistencyCheck();
    });
    $('regionSave').addEventListener('click',()=>{
      const value = validRegion($('regionInput').value);
      if (!value) return message('Unknown country or region. Enter a 2-letter ISO 3166-1 code.',true);
      $('regionInput').value = value;
      setting('region',value,true);
      runConsistencyCheck();
    });
    $('matchOn').addEventListener('change',e=>setting('matchLanguageRegions',e.target.checked,true));
    function localeResults() {
      const q=$('localeInput').value.trim().toLowerCase();
      showOptions('localeOptions',languageLabels.filter(x=>x.code.toLowerCase().includes(q) || x.label.toLowerCase().includes(q)),
        'localeInput','localeCount',90);
    }
    $('localeInput').addEventListener('input',localeResults);
    let languageDraft = [...prefs.languages];
    function renderChips() {
      const fragment = document.createDocumentFragment();
      languageDraft.forEach((code,index) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        const label = document.createElement('span');
        label.textContent = code;
        chip.appendChild(label);
        for (const [txt,delta] of [['↑',-1],['↓',1]]) {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'tiny'; btn.textContent = txt;
          btn.disabled = index + delta < 0 || index + delta >= languageDraft.length;
          btn.addEventListener('click', () => {
            const other = index + delta;
            [languageDraft[index],languageDraft[other]] = [languageDraft[other],languageDraft[index]];
            renderChips();
          });
          chip.appendChild(btn);
        }
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'tiny'; remove.textContent = '×';
        remove.disabled = languageDraft.length < 2;
        remove.addEventListener('click', () => {
          languageDraft.splice(index,1);
          renderChips();
        });
        chip.appendChild(remove);
        fragment.appendChild(chip);
      });
      $('chips').replaceChildren(fragment);
      layout();
    }
    function langResults() {
      const q = $('languageInput').value.toLowerCase().trim();
      const found = languageLabels.filter(x => x.label.toLowerCase().includes(q) || x.code.toLowerCase().includes(q));
      showOptions('languageOptions',found,'languageInput','languageCount');
    }
    $('languageInput').addEventListener('input', langResults);
    function addLanguage() {
      const code = validLanguage($('languageInput').value);
      if (!code) return message('Invalid BCP-47 language tag.',true);
      if (!languageDraft.includes(code)) languageDraft.push(code);
      $('languageInput').value = '';
      renderChips(); langResults();
    }
    $('languageAdd').addEventListener('click',addLanguage);
    $('languageSave').addEventListener('click', () => {
      const valid = validLanguages(languageDraft);
      if (!valid) return message('Add at least one valid language.',true);
      setting('languages',valid,true);
    });
    $('languageOn').addEventListener('change', e => {
      setting('languageEnabled',e.target.checked,true);
    });
    $('localeInput').value = prefs.locale;
    $('localeOn').addEventListener('change', e => {
      setting('localeEnabled',e.target.checked,true);
    });
    $('localeSave').addEventListener('click', () => {
      const v = validLanguage($('localeInput').value);
      if (!v) return message('Invalid BCP-47 locale.',true);
      setting('locale',v,true);
    });
    $('fontOn').addEventListener('change',e => setting('fonts',e.target.checked,true));
    $('rtcOn').addEventListener('change',e => {
      if (setting('rtc',e.target.checked,false)) runRtcCheck();
    });
    $('ipConsistencyOn').addEventListener('change',e=>{
      if (setting('ipConsistency',e.target.checked,false)) runConsistencyCheck();
    });
    $('consistencyRetry').addEventListener('click',()=>runConsistencyCheck(true));
    $('rtcRetry').addEventListener('click', () => {
      if (!prefs.rtc) return message('Enable automatic WebRTC checks first.',true);
      runRtcCheck();
    });
    $('reset').addEventListener('click', () => {
      if (!page.confirm('Restore default settings? Your floating button position will be kept.')) return;
      const next = {...defaultConfig, languages:[...originalLanguages], locale:originalLocale};
      const reloadKeys = ['timezone','languageEnabled','matchLanguageRegions','languages','regionEnabled','region','localeEnabled','locale','fonts'];
      const queued = { before:{}, keys:[] };
      for (const key of reloadKeys) {
        if (JSON.stringify(prefs[key]) !== JSON.stringify(next[key])) {
          queued.before[key] = structuredCloneSafe(prefs[key]); queued.keys.push(key);
        }
      }
      prefs = structuredCloneSafe(next);
      // Font hooks cannot be cleanly removed or added within the current page.
      // Keep the old runtime until a user-approved reload verifies the reset.
      applied.rtc = prefs.rtc;
      applied.ipConsistency = prefs.ipConsistency;
      if (!verifySync('rtc')) { prefs.rtc = false; applied.rtc = false; }
      persist();
      GM_setValue(PENDING_KEY, queued.keys.length ? queued : null);
      languageDraft = [...prefs.languages];
      $('localeInput').value = prefs.locale;
      $('tzInput').value = '';
      renderChips();
      $('regionInput').value=prefs.region;
      syncControls();
      runRtcCheck(); runConsistencyCheck(true);
      if (queued.keys.length && page.confirm('Defaults saved. Reload now to apply and verify them?')) {
        page.location.reload();
      } else {
        message('Defaults saved. A manual reload may be needed to apply all changes.');
      }
    });

    showPanel = () => {
      languageDraft = [...prefs.languages];
      renderChips();
      panel.hidden = false;
      syncControls(); tzResults(); langResults(); regionResults(); localeResults(); layout();
    };
    function closePanel() { clearMessage(); panel.hidden = true; }
    fab.addEventListener('click', () => {
      if (performance.now() - lastDragEnded < 400) return;
      if (panel.hidden) showPanel();
      else closePanel();
    });
    $('close').addEventListener('click', closePanel);
    page.addEventListener('keydown',e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
    document.body.appendChild(host);
    applyPosition();
    syncControls();
    if (restoredMessage) message(restoredMessage, /failed|could not|unavailable/i.test(restoredMessage));
    // Keep the floating button on screen if a SPA replaces the document body.
    const observer = new MutationObserver(() => {
      if (document.body && !host.isConnected) {
        document.body.appendChild(host);
        applyPosition();
      }
    });
    observer.observe(document.documentElement,{ childList:true });
  }
  if (page.top === page) {
    if (document.body) createWidget();
    else document.addEventListener('DOMContentLoaded',createWidget,{once:true});
  }
  if (page.top === page) {
    if (applied.ipConsistency) runConsistencyCheck(true);
    else updateConsistency('off','Automatic checks are disabled.');
    if (applied.rtc) runRtcCheck();
    else updateRtc('off','Automatic checking is disabled.');
  }
})();