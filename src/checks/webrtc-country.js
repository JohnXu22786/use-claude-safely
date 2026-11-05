const sensitiveWebRtcCountries = new Set(['CN','HK']);
function classifyWebRtcCountries(countries) {
  const known = countries.filter(v => typeof v === 'string' && /^[A-Z]{2}$/.test(v));
  const risky = known.filter(v => sensitiveWebRtcCountries.has(v));
  if (risky.length >= 2) return 'risk';
  if (risky.length > 0) return 'unknown';
  return known.length >= 2 ? 'other' : 'unknown';
}
function publicIPv6(ip) {
  const value = String(ip).toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!value.includes(':') || !/^[0-9a-f:]+$/.test(value)) return false;
  if (/^::(?:0|1)?$/.test(value)) return false;
  const groups = value.split(':');
  const first = parseInt(groups[0] || '0',16);
  const second = parseInt(groups[1] || '0',16);
  if (!Number.isFinite(first) || first === 0) return false;
  if (first >= 0xfc00 || (first >= 0xfe80 && first <= 0xfebf)) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  return true;
}
function publicCandidateAddress(ip) {
  const value = String(ip).replace(/^\[|\]$/g,'').split('%')[0];
  const normalized = value.replace(/^::ffff:/i,'');
  if (normalized.includes('.') && normalized.includes(':')) return false;
  return publicIPv4(normalized) || publicIPv6(normalized) ? normalized : null;
}
