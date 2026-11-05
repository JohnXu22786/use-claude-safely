import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('src/features/mail.js','utf8');
function run(host,path='/') {
  return vm.runInNewContext(code+'\n({service:detectMailProvider('+JSON.stringify(host)+','+JSON.stringify(path)+')?.id||null, defaults:normalizeMailSites({})})');
}
test('mail host matching is exact and iCloud is restricted to mail',()=>{
  assert.equal(run('mail.google.com').service,'gmail');
  assert.equal(run('www.icloud.com','/mail').service,'icloud');
  assert.equal(run('www.icloud.com','/').service,null);
  assert.equal(run('notmail.google.com').service,null);
});
test('mail sites default off and modules default on when enabled',()=>{
  const sites=run('mail.google.com').defaults;
  assert.equal(sites.gmail.enabled,false);
  assert.equal(sites.outlook.enabled,false);
  assert.equal(sites.gmail.features.timezone,true);
  assert.equal(sites.gmail.features.language,true);
  assert.equal(sites.gmail.features.fonts,true);
  assert.equal(sites.gmail.features.network,true);
});
