// ==UserScript==
// @name         Claude / Anthropic 全站时区切换（持久记忆）
// @namespace    https://local.userscripts/claude-timezone
// @description  为 Claude/Anthropic 网站指定 IANA 时区，覆盖 Intl 和常见 Date 接口，并跨域持久保存。
// @match        https://claude.ai/*
// @match        https://*.claude.ai/*
// @match        https://claude.com/*
// @match        https://*.claude.com/*
// @match        https://anthropic.com/*
// @match        https://*.anthropic.com/*
// @match        https://claudeusercontent.com/*
// @match        https://*.claudeusercontent.com/*
// @run-at       document-start
// @noframes
// @sandbox      raw
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// ==/UserScript==

(() => {
  'use strict';

  const KEY = 'preferredIanaTimezone';
  const SYSTEM = 'system';
  const NativeDate = Date;
  const NativeDTF = Intl.DateTimeFormat;
  const choices = [
    ['system', '跟随设备系统'],
    ['UTC', 'UTC（世界协调时间）'],
    ['Asia/Shanghai', '中国标准时间 · 北京 / 上海'],
    ['Asia/Tokyo', '日本标准时间 · 东京'],
    ['Asia/Singapore', '新加坡'],
    ['America/New_York', '美国东部 · 纽约（自动夏令时）'],
    ['America/Chicago', '美国中部 · 芝加哥（自动夏令时）'],
    ['America/Los_Angeles', '美国西部 · 洛杉矶（自动夏令时）'],
    ['Europe/London', '英国 · 伦敦（自动夏令时）'],
    ['Europe/Berlin', '欧洲中部 · 柏林（自动夏令时）'],
  ];

  function validateZone(value) {
    if (value === SYSTEM) return SYSTEM;
    try {
      return new NativeDTF('en-US', { timeZone: value }).resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }

  const saved = GM_getValue(KEY, SYSTEM);
  const zone = validateZone(saved) || SYSTEM;

  function saveZone(newZone) {
    const valid = validateZone(newZone.trim());
    if (!valid) {
      alert('时区无效。请填写 IANA 名称，例如 Asia/Shanghai、America/New_York。');
      return false;
    }
    GM_setValue(KEY, valid);
    location.reload();
    return true;
  }

  // -------- 早期覆盖页面常用 JS 时区接口 --------
  // 不修改实际 Unix 时间戳、Date.now()、UTC、网络请求或系统设置。
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

    // 构建“字段被视作 UTC 时”的时间戳，规避 Date.UTC 对年份 0~99 的特判。
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
        p.offset = (sec * 1000 - p.asUtc) / 60000; // 与 getTimezoneOffset 同号
        cache.set(sec, p);
        if (cache.size > 32) cache.delete(cache.keys().next().value);
      }
      return { ...p, ms: new NativeDate(ms).getUTCMilliseconds() };
    }

    function matchesLocal(a, b) {
      return a && a.y === b.y && a.mo === b.mo && a.d === b.d &&
        a.h === b.h && a.mi === b.mi && a.s === b.s && a.ms === b.ms;
    }

    // 本地墙上时间 -> 真实时间戳。处理 DST：重叠时取较早一次，空缺时顺延。
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
      // 春季跳时所造成的不存在的时刻，使用跳时后的下一个对应时刻。
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
      // UTC setter本身支持溢出值（如 32 日、25 时），保持标准 Date 语义。
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
        // 24:00:00 合法，表示次日零时；其他溢出不是合法 ISO 日期。
        if (local.h !== 24 || scratch.getUTCHours() !== 0) return NaN;
      }
      return epochFromLocal(local);
    }

    function TimezoneDate(...args) {
      if (!new.target) return new TimezoneDate().toString();
      if (args.length === 0) return new NativeDate();
      if (args.length === 1) {
        const parsed = localIsoString(args[0]);
        return new NativeDate(parsed === null ? args[0] : parsed);
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
      return new NativeDate(epochFromLocal(p));
    }
    Object.setPrototypeOf(TimezoneDate, NativeDate);
    TimezoneDate.prototype = NativeDate.prototype;
    Object.defineProperty(TimezoneDate, 'name', { value: 'Date' });
    TimezoneDate.parse = s => {
      const parsed = localIsoString(String(s));
      return parsed === null ? NativeDate.parse(s) : parsed;
    };
    window.Date = TimezoneDate;

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

    // Intl.DateTimeFormat() / new Intl.DateTimeFormat() 均走目标时区。
    // 若网页显式传入 timeZone，则尊重网页的显式选择。
    function DateTimeFormat(locales, options) {
      if (options != null && options.timeZone !== undefined) {
        return new NativeDTF(locales, options);
      }
      return new NativeDTF(locales, { ...(options || {}), timeZone: zone });
    }
    Object.setPrototypeOf(DateTimeFormat, NativeDTF);
    DateTimeFormat.prototype = NativeDTF.prototype;
    Object.defineProperty(DateTimeFormat, 'name', { value: 'DateTimeFormat' });
    Intl.DateTimeFormat = DateTimeFormat;

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

    // 若浏览器支持 Temporal，至少使其默认时区查询保持一致。
    try {
      if (typeof Temporal !== 'undefined' && Temporal.Now?.timeZoneId) {
        Object.defineProperty(Temporal.Now, 'timeZoneId', {
          value: () => zone, configurable: true, writable: true,
        });
      }
    } catch { /* 部分浏览器不允许覆盖，跳过 */ }
  }

  // -------- 同一用户脚本的 GM 存储在不同站点之间共享 --------
  const menuText = `🕒 设置时区（当前：${zone === SYSTEM ? '系统' : zone}）`;
  GM_registerMenuCommand(menuText, () => {
    const lines = choices.map(([z, name], i) => `${i}. ${name} [${z}]`);
    const answer = prompt(
      `Claude / Anthropic 全站统一时区\n当前：${zone}\n\n${lines.join('\n')}\n\n输入编号，或直接输入 IANA 时区名称：`,
      zone,
    );
    if (answer === null) return;
    const trimmed = answer.trim();
    const index = /^\d+$/.test(trimmed) ? +trimmed : -1;
    const selected = choices[index]?.[0] || trimmed;
    if (selected) saveZone(selected);
  });

  // 其他 Claude / Anthropic 标签页更改设置时，自动刷新并应用。
  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(KEY, (_key, _old, latest, remote) => {
      if (remote && latest !== zone) location.reload();
    });
  }

  // 移动端也可直接点页面左下角 TZ 按钮，不依赖扩展菜单。
  function addControl() {
    if (!document.body || document.getElementById('claude-tz-widget-root')) return;
    const host = document.createElement('div');
    host.id = 'claude-tz-widget-root';
    host.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        * { box-sizing:border-box; }
        .btn { background:#202733;color:#fff;border:1px solid #657184;border-radius:12px;
          padding:9px 12px;cursor:pointer;font:13px system-ui,sans-serif;box-shadow:0 3px 15px #0003; }
        .panel { width:min(310px,calc(100vw - 28px));margin-bottom:8px;padding:14px;
          background:#fff;color:#18202a;border-radius:14px;border:1px solid #ddd;
          box-shadow:0 5px 24px #0004;font:14px system-ui,sans-serif; }
        .heading { font-weight:700;margin-bottom:5px; }
        .hint { font-size:12px;color:#586273;margin-bottom:9px;overflow-wrap:anywhere; }
        select,input { display:block;width:100%;height:36px;padding:6px;margin:7px 0;
          background:white;color:#18202a;border:1px solid #b8c1cc;border-radius:7px;font:13px system-ui,sans-serif; }
        .actions { display:flex;gap:8px;margin-top:10px; }
        .actions button { flex:1; }
        #apply { background:#2957cc;border-color:#2957cc; }
        [hidden] { display:none !important; }
      </style>
      <div class="panel" id="panel" hidden>
        <div class="heading">Claude / Anthropic 时区</div>
        <div class="hint" id="current"></div>
        <select id="choices" aria-label="选择时区"></select>
        <input id="custom" placeholder="例如 America/Phoenix" aria-label="自定义 IANA 时区" hidden>
        <div class="actions">
          <button class="btn" id="close" type="button">取消</button>
          <button class="btn" id="apply" type="button">保存并刷新</button>
        </div>
      </div>
      <button class="btn" id="toggle" type="button" title="设置 Claude / Anthropic 时区">🕒 TZ</button>
    `;
    const $ = id => root.getElementById(id);
    const selector = $('choices');
    for (const [value, label] of choices) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      selector.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '自定义 IANA 时区…';
    selector.appendChild(customOpt);
    if (choices.some(([value]) => value === zone)) {
      selector.value = zone;
    } else {
      selector.value = '__custom__';
      $('custom').value = zone;
    }
    $('current').textContent = `已保存：${zone === SYSTEM ? '跟随系统' : zone}（全站共享）`;
    function syncCustom() { $('custom').hidden = selector.value !== '__custom__'; }
    syncCustom();
    selector.addEventListener('change', syncCustom);
    $('toggle').addEventListener('click', () => { $('panel').hidden = !$('panel').hidden; });
    $('close').addEventListener('click', () => { $('panel').hidden = true; });
    $('apply').addEventListener('click', () => {
      const v = selector.value === '__custom__' ? $('custom').value : selector.value;
      saveZone(v);
    });
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);
  }
  if (document.body) addControl();
  else document.addEventListener('DOMContentLoaded', addControl, { once: true });
})();