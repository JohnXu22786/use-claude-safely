# Use Claude Safely

**Browser Environment Guard** is an open-source Tampermonkey userscript for managing selected browser-visible environment settings and reviewing consistency or coverage limitations on Claude / Anthropic websites and supported webmail services.

> **Scope:** This is a browser-side privacy and environment utility, not an account-safety guarantee, a complete device emulator, or a way to change a service's region eligibility. It cannot prevent sites from detecting all modifications.

**[Install from main](https://raw.githubusercontent.com/JohnXu22786/use-claude-safely/main/browser-environment-guard.user.js)** · [Releases](https://github.com/JohnXu22786/use-claude-safely/releases) · [Changelog](./CHANGELOG.md) · [Issues](https://github.com/JohnXu22786/use-claude-safely/issues)

## Features

| Area | Features |
| --- | --- |
| Timezone | Select browser-supported IANA zones; search by region, city, UTC/GMT offset, or common abbreviations. |
| Browser language | Customize JavaScript-visible language preferences and optionally match common language tags to their usual regions. |
| Intl locale and region | Select locale / region values for supported JavaScript formatting APIs. |
| Chinese font protection | Best-effort suppression of certain detection techniques for common Chinese font names without removing installed fonts. |
| WebRTC CN/HK check | Inspect observable **public** ICE candidate addresses for mainland China (`CN`) or Hong Kong (`HK`) geolocation. Private addresses and unavailable results are not treated as confirmed leaks. |
| Consistency | Show short IP/timezone/region and unexpected non-Chinese `-CN` tag notices, plus separately expandable notes about other observable signals. |
| Webmail controls | Opt-in master switch, per-provider switches and independent feature toggles in a separate Mail Websites panel. |
| Interface | English UI, movable ENV control, persistent settings, searchable suggestions, and explicit reload prompts where needed. |

## Install

1. Install a compatible userscript manager such as **Tampermonkey**.
2. Open the [single-file userscript on GitHub](https://raw.githubusercontent.com/JohnXu22786/use-claude-safely/main/browser-environment-guard.user.js) and approve its installation, or paste the source into a newly created userscript if automatic installation is unavailable.
3. Disable any older installed copies to prevent duplicate patches.
4. Visit a supported page and click the draggable **ENV** control. Settings are stored by the userscript manager.

**GitHub is the project's distribution channel.** Installing the script does not require Greasy Fork or another userscript marketplace.

The latest historical release is **v0.3.2**. The **main** branch may contain unreleased changes; the version metadata is not automatically advanced on every merged pull request.

## Supported websites

**Claude / Anthropic:** `claude.ai`, `claude.com`, `anthropic.com`, and `claudeusercontent.com`, including matching subdomains.

**Email:** Gmail, Outlook/Hotmail, Microsoft 365 Outlook, Yahoo Mail, iCloud Mail, Proton Mail, Tuta, Fastmail, Zoho Mail, AOL Mail, GMX Mail, HEY, Yandex Mail, QQ Mail, NetEase Mail (163 / 126 / yeah), Sina Mail, and Naver Mail.

The authoritative URL list is in the userscript's `@match` metadata. Third-party sign-in domains are not automatically covered unless explicitly matched.

### Mail Websites

Email support is **disabled by default**. Under **ENV → Mail Websites**, enable the master switch, select providers, and optionally control timezone, language / locale / region, font protection, and network checking individually.

Each mail site inherits the global environment values; this is not a separate profile system. Disabled sites should exit before applying environment overrides or initiating their optional checks. Reload an already-open page after changing site enablement.

## What the checks actually mean

- **Applied / verified:** The selected script-accessible APIs returned expected values in the checked context. It is not a claim that the server received the same values.
- **WebRTC CN/HK:** The check examines collected *public* ICE candidates. A red result requires multiple geolocation confirmations of a `CN` or `HK` address. An incomplete check or a lack of candidates is **not proof of no leaks**.
- **IP / Region / Timezone:** Geographic comparisons are approximate; IP geolocation and timezones are not definitive indicators of physical location.
- **Other signals:** JavaScript and HTTP `Accept-Language` can differ. Cross-origin echo tests cannot read the exact request headers that another website receives.
- **Fonts:** Masking known font-detection methods does not guarantee invisibility to Canvas, DOM measurement, native rendering, or other fingerprinting methods.

### Device fingerprint boundaries

The current userscript is **not a full device-fingerprint simulator**. Some JavaScript-facing fields can be changed, but:

- UA Client Hints may also be sent in browser-generated HTTP `Sec-CH-UA-*` headers that userscript overrides do not control.
- Canvas, WebGL and Web Audio behavior is tied to browser rendering and native implementation details; modifying a few JavaScript readout paths does not reproduce another device's complete rendering fingerprint.
- TLS/JA3/JA4, HTTP/2 framing and genuine GPU hardware/driver behavior cannot be reliably overridden by a userscript.
- Injection at `document-start` does not guarantee precedence over every website script, worker, iframe or browser-native interface.

Avoid interpreting any test result as a guarantee of anonymity, account eligibility or immunity from detection.

## Privacy and network access

Optional checks use external STUN, IP geolocation, header-echo or timezone-mapping providers, depending on the enabled features. Those third parties may receive your public IP or public WebRTC candidates. Disable unneeded network checks if this is undesirable.

This project should not need access to email message contents, account passwords or authentication cookies to provide environment controls. Review the source and permissions before installing or updating.

## Build from source

GitHub keeps **multiple source files** while users install **one self-contained script**:

```text
src/
  bootstrap.js
  core/
  features/
  checks/
  ui/
scripts/build.mjs
tests/
browser-environment-guard.user.js    # generated install file
```

Source fragments are concatenated in a fixed order into the userscript's original shared JavaScript scope. There are no runtime `@require` dependencies. This preserves early initialization without waiting for external JavaScript modules.

Requires Node.js 22 or later:

```bash
npm run build
npm test
node --check browser-environment-guard.user.js
```

Edit the source under `src/`, then rebuild the generated `.user.js`. Pull requests are checked by GitHub Actions for test results, syntax validity, and generated-file reproducibility.

## Contributions and releases

Bug reports and focused pull requests are welcome. Include your browser and operating system, reproduction steps, what you expected, and what actually happened; do **not** include email content, login data, or unredacted public IPs.

The project is in the `0.x` development series. Minor versions indicate larger capability milestones; patch versions cover UI, fixes, compatibility, search and small improvements. Not every PR is a new release.

See [CHANGELOG.md](./CHANGELOG.md) and [GitHub Releases](https://github.com/JohnXu22786/use-claude-safely/releases). Git tags represent historical snapshots and must not be rewritten.

## License

See [LICENSE](./LICENSE).
