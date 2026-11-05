# Use Claude Safely

A browser-side environment management userscript for Claude/Anthropic sites and selected webmail interfaces.

**Current version: v0.3.2**

This is an environment utility, not an account-safety guarantee. It does not change your actual IP address, TLS fingerprint, server-side region checks, or a service's terms and eligibility requirements.

## Installation

1. Install a userscript manager such as Tampermonkey or Violentmonkey.
2. Open the [v0.3.2 userscript](https://raw.githubusercontent.com/JohnXu22786/use-claude-safely/v0.3.2/browser-environment-guard.user.js) and approve the manager's installation prompt.
3. Visit a supported website and open the draggable **ENV** control to configure preferences.
4. Disable older copies of this script to prevent multiple instances from overriding one another.

## Features

- Search supported IANA timezones using aliases, UTC offsets, and city or country names.
- Configure page-visible timezone, browser language preferences, `Intl` locale, and region where supported.
- Optionally match common language tags with their usual regions.
- Apply best-effort mitigation for some Chinese font-detection interfaces.
- Check IP geolocation and WebRTC candidates through multiple providers.
- Show focused consistency notices and separate additional signals and coverage notes.
- Drag the **ENV** control and persist preferences through the userscript manager.

## Supported websites

The userscript runs on the following hosts, as defined by its `@match` metadata:

- Claude and Anthropic: `claude.ai`, `claude.com`, `anthropic.com`, and `claudeusercontent.com` (including their subdomains where matched).
- Email: Gmail, Outlook, Yahoo Mail, iCloud Mail, Proton Mail, Tuta, Fastmail, Zoho Mail, AOL Mail, GMX, HEY, Yandex Mail, QQ Mail, NetEase Mail (`163.com`, `126.com`, `yeah.net`), Sina Mail, and Naver Mail.

## Network requests

Optional checks may request timezone mapping data or contact third-party IP, geolocation, and header-echo providers. Those services may see the network address used for the request. Review the source and disable checks you do not need.

## Known limitations

- Userscripts cannot guarantee execution before every site script, worker, or frame.
- JavaScript changes do not automatically change HTTP `Accept-Language`, TLS/JA3/JA4, native font rendering, or every WebRTC surface.
- The header-echo check contacts another service; it does not read the exact headers received by Claude or a mail provider.
- A missing mismatch does not prove anonymity, account safety, or compliance with a service's requirements.
- Browser security policies and site changes may limit script injection or cross-origin requests.

## Releases and versioning

The project remains in the `0.x` series. Minor versions mark major feature milestones or significant functional expansion. Patch versions cover bug fixes, UI and search improvements, compatibility fixes, performance work, small additions, and documentation. Patch versions are preferred when a minor bump is not warranted.

The release tags are attached to their historical commits. Historical releases are retrospective and do not imply that GitHub published them on those past dates.

| Version | Release |
| --- | --- |
| v0.3.2 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.3.2) |
| v0.3.1 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.3.1) |
| v0.3.0 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.3.0) |
| v0.2.6 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.6) |
| v0.2.5 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.5) |
| v0.2.4 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.4) |
| v0.2.3 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.3) |
| v0.2.2 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.2) |
| v0.2.1 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.1) |
| v0.2.0 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.2.0) |
| v0.1.2 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.1.2) |
| v0.1.1 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.1.1) |
| v0.1.0 | [Release](https://github.com/JohnXu22786/use-claude-safely/releases/tag/v0.1.0) |

See [CHANGELOG.md](./CHANGELOG.md) for the milestone summaries.

## Building from source

Source is maintained in ordered fragments under `src/` (core, features, checks, UI and bootstrap).
`npm run build` concatenates these fragments into the single self-contained
`browser-environment-guard.user.js`. This intentionally preserves the original
shared JavaScript scope and `document-start` behavior without runtime `@require`
network dependencies. Make changes in `src/`, not only in the generated bundle.

Run `npm run build`, `npm test`, then `node --check browser-environment-guard.user.js`.
The GitHub Actions workflow checks that the committed generated file is current.


## Mail website controls

Select **Mail Websites** in the ENV settings panel to configure mail support.
The master switch and all individual mail services are **off by default**.
Enable the master switch and choose the specific services you want; expanding
a service allows independent toggles for timezone, language/locale/region,
font protection, and network checks. Selected mail sites inherit global
environment values. Disabling a site causes its userscript to return before
environment patching, external checks, or widget injection. Reload an already
open mail page to apply a change; the UI asks before reloading.


## WebRTC CN/HK geographic check

When enabled, the userscript collects ICE candidates through independent STUN
servers, ignores private/mDNS addresses, and checks observed **public** IPv4/IPv6
addresses with multiple IP geolocation services. Two sources must classify a
candidate in mainland China (CN) or Hong Kong (HK) to display a red alert.
Disagreements, unavailable lookups, or incomplete ICE gathering are inconclusive,
not proof of safety. This check is independent of the IP/timezone/region consistency
check and does not compare WebRTC candidates to the HTTP exit IP.

Candidate public IP addresses may be sent to the third-party geolocation providers
for classification; disable automatic WebRTC checking if that is undesirable.
