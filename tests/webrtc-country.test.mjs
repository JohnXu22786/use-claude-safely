import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('src/checks/webrtc-country.js','utf8');
const probe=expr=>vm.runInNewContext(code+'\n'+expr,{publicIPv4:ip=>/^8\.8\.8\.8$/.test(ip)});
test('two independent CN/HK country matches are required for red status',()=>{
 assert.equal(probe("classifyWebRtcCountries(['CN','HK'])"),'risk');
 assert.equal(probe("classifyWebRtcCountries(['CN','JP'])"),'unknown');
 assert.equal(probe("classifyWebRtcCountries(['JP','US'])"),'other');
 assert.equal(probe("classifyWebRtcCountries(['HK'])"),'unknown');
});
test('private and documentation IPv6 addresses are excluded',()=>{
 assert.equal(probe("publicIPv6('fe80::1')"),false);
 assert.equal(probe("publicIPv6('fd12::1')"),false);
 assert.equal(probe("publicIPv6('2001:db8::1')"),false);
 assert.equal(probe("publicIPv6('2001:4860:4860::8888')"),true);
});
