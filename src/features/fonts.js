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
if (applied.fonts) installFontMask();
