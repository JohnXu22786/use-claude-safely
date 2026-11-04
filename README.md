# Use Claude Safely

A browser-side environment management userscript for Claude/Anthropic sites and selected webmail interfaces. It provides configurable timezone, language and region preferences, best-effort Chinese font detection mitigation, WebRTC/network checks, and visible consistency notices.

> This is a browser environment utility, **not** an account-safety guarantee. It does not change your actual IP address, TLS fingerprint, server-side region checks, or a service's terms and eligibility requirements.

## Install

1. Install a trusted userscript manager such as Tampermonkey.
2. Open [browser-environment-guard.user.js](./browser-environment-guard.user.js), copy the script into a new userscript, and save it.
3. Open a supported website and use the draggable **ENV** control. Settings are persisted by the userscript manager and shared across covered domains.
4. Disable older copies of the script so that multiple instances do not override one another.

## Features

- Search the browser's supported IANA timezones, with aliases, offsets and city/country suggestions.
- Override page-visible timezone, browser language preferences, Intl locale and chosen region where supported.
- Optionally match common language tags to their usual regions without forcing all languages to match the IP country.
- Reduce exposure through some common Chinese font detection interfaces. Native rendering and all fingerprinting surfaces cannot be covered.
- Check IP-geolocation and WebRTC candidates using multiple providers. Private LAN addresses alone are not treated as public-IP leaks; failed or timed-out checks stay inconclusive.
- Keep the primary alert focused on IP/timezone/region differences and unexpected non-Chinese `-CN` tags.
- Expand **Other signals** to see potential HTTP Accept-Language/JavaScript differences and remaining testing blind spots.
- Keep the settings button draggable and preserve preferences across browser restarts.

## Domains and network requests

The userscript matches Claude/Anthropic hosts plus selected webmail sites (including Gmail, Outlook, Yahoo Mail, iCloud Mail, Proton Mail and others). The exact list is in the userscript's `@match` metadata.

Some optional checks request online timezone mapping data or contact third-party IP, geolocation and header-echo providers. These services may see the network address used for the request. Review the source and switch off unneeded network checks.

## Limitations

- Userscripts cannot guarantee running before every site script, worker or frame.
- JavaScript-level changes do **not** automatically modify HTTP `Accept-Language`, TLS/JA3/JA4, native font rendering or all WebRTC behavior.
- The HTTP header echo is a request to another service, not a direct read of the exact headers received by Claude or a mail provider.
- A missing mismatch is not proof of anonymity or compliance with service requirements.
- Test functionality on your browser: some websites or browser security policies can limit injection and cross-origin requests.

## Development workflow

The original timezone script was committed directly to `main`. Subsequent milestones are preserved as separate, merged pull requests in the repository's history. There are no copied version-numbered script files. Release tags, a public version scheme, and an open-source license have not yet been selected.
