// ==UserScript==
// @name         Claude / Anthropic - Global Time Zone Switcher
// @namespace    https://userscripts.local/claude-anthropic-timezone
// @description  Override the browser-reported time zone on Claude and Anthropic websites. Search all supported IANA zones, enter a custom ID, and remember one setting across domains.
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
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// ==/UserScript==

(() => {
  'use strict';

  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const KEY = 'preferredIanaTimezone';
  const SYSTEM = 'system';
  const NativeDate = page.Date;
  const NativeDTF = page.Intl.DateTimeFormat;
  const systemZone = new NativeDTF('en-US').resolvedOptions().timeZone || 'UTC';

  function validateZone(raw) {
    if (typeof raw !== 'string') return null;
    const name = raw.trim();
    if (name.toLowerCase() === SYSTEM) return SYSTEM;
    if (!name) return null;
    try {
      return new NativeDTF('en-US', { timeZone: name }).resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }

  const saved = GM_getValue(KEY, SYSTEM);
  const zone = validateZone(saved) || SYSTEM;

  function saveZone(input, message) {
    const valid = validateZone(input);
    if (!valid) {
      if (message) message('Invalid time zone. Enter a valid IANA identifier, such as America/Phoenix.', true);
      return false;
    }
    if (valid !== zone) GM_setValue(KEY, valid);
    page.location.reload();
    return true;
  }

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
        return new NativeDTF(locales, opts).format(this);
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


  // A single Tampermonkey script store is shared by all matched domains.
  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(KEY, (_name, _oldValue, newValue, remote) => {
      if (remote && newValue !== zone) page.location.reload();
    });
  }

  // The live browser list is authoritative. This static fallback covers older browsers.
  const fallbackZones = ["Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Asmara","Africa/Asmera","Africa/Bamako","Africa/Bangui","Africa/Banjul","Africa/Bissau","Africa/Blantyre","Africa/Brazzaville","Africa/Bujumbura","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Conakry","Africa/Dakar","Africa/Dar_es_Salaam","Africa/Djibouti","Africa/Douala","Africa/El_Aaiun","Africa/Freetown","Africa/Gaborone","Africa/Harare","Africa/Johannesburg","Africa/Juba","Africa/Kampala","Africa/Khartoum","Africa/Kigali","Africa/Kinshasa","Africa/Lagos","Africa/Libreville","Africa/Lome","Africa/Luanda","Africa/Lubumbashi","Africa/Lusaka","Africa/Malabo","Africa/Maputo","Africa/Maseru","Africa/Mbabane","Africa/Mogadishu","Africa/Monrovia","Africa/Nairobi","Africa/Ndjamena","Africa/Niamey","Africa/Nouakchott","Africa/Ouagadougou","Africa/Porto-Novo","Africa/Sao_Tome","Africa/Timbuktu","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Anguilla","America/Antigua","America/Araguaina","America/Argentina/Buenos_Aires","America/Argentina/Catamarca","America/Argentina/ComodRivadavia","America/Argentina/Cordoba","America/Argentina/Jujuy","America/Argentina/La_Rioja","America/Argentina/Mendoza","America/Argentina/Rio_Gallegos","America/Argentina/Salta","America/Argentina/San_Juan","America/Argentina/San_Luis","America/Argentina/Tucuman","America/Argentina/Ushuaia","America/Aruba","America/Asuncion","America/Atikokan","America/Atka","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Blanc-Sablon","America/Boa_Vista","America/Bogota","America/Boise","America/Buenos_Aires","America/Cambridge_Bay","America/Campo_Grande","America/Cancun","America/Caracas","America/Catamarca","America/Cayenne","America/Cayman","America/Chicago","America/Chihuahua","America/Ciudad_Juarez","America/Coral_Harbour","America/Cordoba","America/Costa_Rica","America/Coyhaique","America/Creston","America/Cuiaba","America/Curacao","America/Danmarkshavn","America/Dawson","America/Dawson_Creek","America/Denver","America/Detroit","America/Dominica","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Ensenada","America/Fort_Nelson","America/Fort_Wayne","America/Fortaleza","America/Glace_Bay","America/Godthab","America/Goose_Bay","America/Grand_Turk","America/Grenada","America/Guadeloupe","America/Guatemala","America/Guayaquil","America/Guyana","America/Halifax","America/Havana","America/Hermosillo","America/Indiana/Indianapolis","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Indianapolis","America/Inuvik","America/Iqaluit","America/Jamaica","America/Jujuy","America/Juneau","America/Kentucky/Louisville","America/Kentucky/Monticello","America/Knox_IN","America/Kralendijk","America/La_Paz","America/Lima","America/Los_Angeles","America/Louisville","America/Lower_Princes","America/Maceio","America/Managua","America/Manaus","America/Marigot","America/Martinique","America/Matamoros","America/Mazatlan","America/Mendoza","America/Menominee","America/Merida","America/Metlakatla","America/Mexico_City","America/Miquelon","America/Moncton","America/Monterrey","America/Montevideo","America/Montreal","America/Montserrat","America/Nassau","America/New_York","America/Nipigon","America/Nome","America/Noronha","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Nuuk","America/Ojinaga","America/Panama","America/Pangnirtung","America/Paramaribo","America/Phoenix","America/Port-au-Prince","America/Port_of_Spain","America/Porto_Acre","America/Porto_Velho","America/Puerto_Rico","America/Punta_Arenas","America/Rainy_River","America/Rankin_Inlet","America/Recife","America/Regina","America/Resolute","America/Rio_Branco","America/Rosario","America/Santa_Isabel","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Shiprock","America/Sitka","America/St_Barthelemy","America/St_Johns","America/St_Kitts","America/St_Lucia","America/St_Thomas","America/St_Vincent","America/Swift_Current","America/Tegucigalpa","America/Thule","America/Thunder_Bay","America/Tijuana","America/Toronto","America/Tortola","America/Vancouver","America/Virgin","America/Whitehorse","America/Winnipeg","America/Yakutat","America/Yellowknife","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Palmer","Antarctica/Rothera","Antarctica/South_Pole","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Arctic/Longyearbyen","Asia/Aden","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Ashkhabad","Asia/Atyrau","Asia/Baghdad","Asia/Bahrain","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Calcutta","Asia/Chita","Asia/Choibalsan","Asia/Chongqing","Asia/Chungking","Asia/Colombo","Asia/Dacca","Asia/Damascus","Asia/Dhaka","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Harbin","Asia/Hebron","Asia/Ho_Chi_Minh","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Asia/Istanbul","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Kashgar","Asia/Kathmandu","Asia/Katmandu","Asia/Khandyga","Asia/Kolkata","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Kuwait","Asia/Macao","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Phnom_Penh","Asia/Pontianak","Asia/Pyongyang","Asia/Qatar","Asia/Qostanay","Asia/Qyzylorda","Asia/Rangoon","Asia/Riyadh","Asia/Saigon","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Tel_Aviv","Asia/Thimbu","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ujung_Pandang","Asia/Ulaanbaatar","Asia/Ulan_Bator","Asia/Urumqi","Asia/Ust-Nera","Asia/Vientiane","Asia/Vladivostok","Asia/Yakutsk","Asia/Yangon","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faeroe","Atlantic/Faroe","Atlantic/Jan_Mayen","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/St_Helena","Atlantic/Stanley","Australia/ACT","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Canberra","Australia/Currie","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/LHI","Australia/Lindeman","Australia/Lord_Howe","Australia/Melbourne","Australia/NSW","Australia/North","Australia/Perth","Australia/Queensland","Australia/South","Australia/Sydney","Australia/Tasmania","Australia/Victoria","Australia/West","Australia/Yancowinna","Brazil/Acre","Brazil/DeNoronha","Brazil/East","Brazil/West","Canada/Atlantic","Canada/Central","Canada/Eastern","Canada/Mountain","Canada/Newfoundland","Canada/Pacific","Canada/Saskatchewan","Canada/Yukon","Chile/Continental","Chile/EasterIsland","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/Belfast","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Busingen","Europe/Chisinau","Europe/Copenhagen","Europe/Dublin","Europe/Gibraltar","Europe/Guernsey","Europe/Helsinki","Europe/Isle_of_Man","Europe/Istanbul","Europe/Jersey","Europe/Kaliningrad","Europe/Kiev","Europe/Kirov","Europe/Kyiv","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Mariehamn","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Nicosia","Europe/Oslo","Europe/Paris","Europe/Podgorica","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/San_Marino","Europe/Sarajevo","Europe/Saratov","Europe/Simferopol","Europe/Skopje","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Tiraspol","Europe/Ulyanovsk","Europe/Uzhgorod","Europe/Vaduz","Europe/Vatican","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zagreb","Europe/Zaporozhye","Europe/Zurich","Indian/Antananarivo","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Comoro","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Mayotte","Indian/Reunion","Mexico/BajaNorte","Mexico/BajaSur","Mexico/General","Pacific/Apia","Pacific/Auckland","Pacific/Bougainville","Pacific/Chatham","Pacific/Chuuk","Pacific/Easter","Pacific/Efate","Pacific/Enderbury","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Johnston","Pacific/Kanton","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Kwajalein","Pacific/Majuro","Pacific/Marquesas","Pacific/Midway","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Palau","Pacific/Pitcairn","Pacific/Pohnpei","Pacific/Ponape","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Saipan","Pacific/Samoa","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Truk","Pacific/Wake","Pacific/Wallis","Pacific/Yap","US/Alaska","US/Aleutian","US/Arizona","US/Central","US/East-Indiana","US/Eastern","US/Hawaii","US/Indiana-Starke","US/Michigan","US/Mountain","US/Pacific","US/Samoa"];
  function getSupportedZones() {
    let values = [];
    try {
      if (typeof page.Intl.supportedValuesOf === 'function') {
        values = page.Intl.supportedValuesOf('timeZone');
      }
    } catch { /* Fall back to the bundled IANA directory. */ }
    if (!Array.isArray(values) || values.length === 0) values = fallbackZones;
    return [...new Set(['UTC', ...values, ...(zone !== SYSTEM ? [zone] : [])])].sort();
  }

  let openPicker = null;
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(`Choose time zone (${zone === SYSTEM ? 'System' : zone})`, () => {
      if (openPicker) return openPicker();
      if (page.top === page && document.body) {
        createWidget();
        if (openPicker) openPicker();
      } else if (page.top === page) {
        document.addEventListener('DOMContentLoaded', () => {
          createWidget();
          if (openPicker) openPicker();
        }, { once: true });
      }
    });
  }

  function createWidget() {
    if (page.top !== page || !document.body || document.getElementById('ca-tz-host')) return;
    const host = document.createElement('div');
    host.id = 'ca-tz-host';
    host.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:2147483647;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme:light dark; }
        * { box-sizing:border-box; }
        .fab { appearance:none;background:#242b39;color:#fff;border:1px solid #65738a;
          border-radius:12px;padding:9px 12px;font:600 13px system-ui,sans-serif;cursor:pointer;
          box-shadow:0 4px 14px #0004; }
        .panel { width:min(370px,calc(100vw - 28px));max-height:min(74vh,620px);overflow:auto;
          margin-bottom:9px;padding:16px;border:1px solid #d6dae4;border-radius:15px;
          background:#fff;color:#171f2e;box-shadow:0 12px 40px #0005;font:14px system-ui,sans-serif; }
        .header { display:flex;justify-content:space-between;align-items:center;gap:10px; }
        .title { font-size:16px;font-weight:750; }
        .caption { font-size:12px;color:#586478;margin-top:5px;overflow-wrap:anywhere; }
        .selected { padding:9px 10px;margin-top:12px;border-radius:8px;background:#eef3fd;
          font-size:13px;overflow-wrap:anywhere; }
        .selected strong { display:block;margin-top:3px; }
        label { display:block;margin-top:14px;margin-bottom:6px;font-size:12px;font-weight:700; }
        input { width:100%;height:40px;border:1px solid #abb8ca;border-radius:8px;
          padding:9px 10px;background:white;color:#182334;font:13px system-ui,sans-serif; }
        input:focus { outline:2px solid #4d76d6;outline-offset:1px; }
        .list { border:1px solid #d5dce9;border-radius:8px;margin-top:6px;
          max-height:216px;overflow-y:auto;overscroll-behavior:contain; }
        .item { display:block;width:100%;border:0;border-bottom:1px solid #edf0f5;
          border-radius:0;background:transparent;color:#1a273a;text-align:left;
          padding:8px 10px;font:13px system-ui,sans-serif;cursor:pointer; }
        .item:hover,.item:focus { background:#eef4ff;outline:none; }
        .item.active { background:#e4edfc;font-weight:700; }
        .count,.error { font-size:12px;margin-top:7px; }
        .count { color:#637087; }
        .error { color:#b42318; }
        .actions { display:flex;gap:8px;margin-top:12px; }
        .action { appearance:none;flex:1;border-radius:9px;border:1px solid #aeb9c9;
          background:#fff;color:#213047;padding:10px 8px;font:600 13px system-ui,sans-serif;cursor:pointer; }
        .primary { border-color:#385ed0;background:#385ed0;color:#fff; }
        .system { width:100%;text-align:center;margin-top:9px; }
        .tip { margin-top:12px;color:#637087;font-size:11px;line-height:1.5; }
        [hidden] { display:none !important; }
        @media (prefers-color-scheme:dark) {
          .panel { background:#19212e;color:#f2f4f8;border-color:#3c485c; }
          .caption,.count,.tip { color:#a8b5ca; }
          .selected { background:#2d3a4e; }
          input { background:#232f40;color:#f2f4f8;border-color:#627088; }
          .list { border-color:#455369; }
          .item { color:#f2f4f8;border-bottom-color:#364356; }
          .item:hover,.item:focus,.item.active { background:#354665; }
          .action { background:#28364a;color:#f1f4f9;border-color:#60718b; }
          .primary { background:#385ed0;border-color:#385ed0;color:#fff; }
          .error { color:#ff9b91; }
        }
      </style>
      <section id="panel" class="panel" role="dialog" aria-label="Time zone switcher" hidden>
        <div class="header"><span class="title">Time zone switcher</span>
          <button id="closeX" class="action" type="button" style="flex:0 0 auto;padding:5px 10px" aria-label="Close">✕</button>
        </div>
        <div class="caption">One setting for Claude and Anthropic websites. Automatically handles daylight saving time.</div>
        <div class="selected">Current setting:<strong id="current"></strong></div>
        <label for="search">Search or enter any IANA time zone</label>
        <input id="search" type="search" autocomplete="off" spellcheck="false"
          placeholder="e.g. America/Phoenix" aria-label="Search time zones" />
        <div id="list" class="list" role="listbox" aria-label="Available time zones"></div>
        <div id="count" class="count"></div>
        <div id="error" class="error" role="alert" hidden></div>
        <div class="actions">
          <button id="cancel" class="action" type="button">Cancel</button>
          <button id="save" class="action primary" type="button">Save &amp; reload</button>
        </div>
        <button id="system" class="action system" type="button">Use system time zone</button>
        <div class="tip">Search the complete list, or type a valid IANA alias not shown in it. Press Enter to save your typed time zone. JavaScript time zone only; it does not change your IP, device settings, or server-side account region.</div>
      </section>
      <button id="toggle" class="fab" type="button" title="Choose time zone">🕒 TZ</button>
    `;
    const $ = id => shadow.getElementById(id);
    const list = $('list');
    const search = $('search');
    const allZones = getSupportedZones();
    let selected = zone;
    const maxVisible = 120;

    const currentLabel = x => x === SYSTEM ? `System (${systemZone})` : x;
    function showStatus() {
      $('current').textContent = currentLabel(selected);
    }
    function error(message, isError = false) {
      $('error').hidden = !isError;
      $('error').textContent = isError ? message : '';
    }
    function renderResults() {
      const q = search.value.trim().toLowerCase().replaceAll(' ', '_');
      const found = q ? allZones.filter(z => z.toLowerCase().includes(q)) : allZones;
      const fragment = document.createDocumentFragment();
      for (const value of found.slice(0, maxVisible)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'item' + (value === selected ? ' active' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(value === selected));
        item.textContent = value;
        item.addEventListener('click', () => {
          selected = value;
          search.value = value;
          showStatus();
          error('');
          renderResults();
        });
        fragment.appendChild(item);
      }
      list.replaceChildren(fragment);
      $('count').textContent = found.length === 0
        ? 'No exact list match. You can still enter any valid IANA alias.'
        : `Showing ${Math.min(found.length, maxVisible)} of ${found.length} matching time zones`;
    }
    function applySelection() {
      const typed = search.value.trim();
      // Blank search means keep the current selection.
      saveZone(typed || selected, error);
    }
    openPicker = () => {
      selected = zone;
      search.value = '';
      showStatus();
      error('');
      renderResults();
      $('panel').hidden = false;
      search.focus();
    };
    $('toggle').addEventListener('click', () => {
      if ($('panel').hidden) openPicker();
      else $('panel').hidden = true;
    });
    $('closeX').addEventListener('click', () => { $('panel').hidden = true; });
    $('cancel').addEventListener('click', () => { $('panel').hidden = true; });
    $('system').addEventListener('click', () => saveZone(SYSTEM, error));
    $('save').addEventListener('click', applySelection);
    search.addEventListener('input', () => { error(''); renderResults(); });
    search.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applySelection(); }
      if (event.key === 'Escape') { event.preventDefault(); $('panel').hidden = true; }
    });
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);
  }

  if (page.top === page) {
    if (document.body) createWidget();
    else document.addEventListener('DOMContentLoaded', createWidget, { once: true });
  }
})();