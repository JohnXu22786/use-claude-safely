import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  'src/features/mail.js',
  'src/core/config.js',
  'src/features/language.js',
  'src/features/timezone.js',
  'src/features/fonts.js',
  'src/core/settings.js',
  'src/features/webrtc.js',
  'src/features/network.js',
  'src/features/geolocation.js',
  'src/features/zone-data.js',
  'src/checks/consistency.js',
  'src/ui/options.js',
  'src/ui/panel.js',
  'src/bootstrap.js',
];
const read = name => readFileSync(resolve(root, name), 'utf8');
// Ordered source fragments share the original lexical scope.
// Build requires no packages or external @require files at page load.
const bundle = read('src/userscript.header.txt') + "(() => {\n'use strict';\n"
  + source.map(read).join('') + '})();\n';
writeFileSync(resolve(root, 'browser-environment-guard.user.js'), bundle);
