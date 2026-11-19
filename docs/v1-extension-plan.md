# v1 planning: Chromium environment guard

Status: research and proposed backlog, not an approved implementation specification. Baseline: v0.3.3. This document tracks privacy, compatibility and account-recovery work; no fingerprint setting guarantees account access or prevents suspension.

## Product objective and design input

Build a coherent simulated browser environment for Claude that reduces exposure of regional clues (including installed Chinese fonts, timezone and locale) and distinctive device characteristics that can link visits. Expand community fingerprint-browser experience into a systematic inventory and testable controls. Community material is design input, not a proven description of a service's private detection logic. The objective is comprehensive coverage of website-observable signals; where Chromium extensions cannot simulate a surface, show the limitation and evaluate a separate browser-level mechanism rather than claiming coverage. No further external research is required to proceed with this planning revision.

## Scope and priorities

The primary goal is reducing website-visible regional clues and device uniqueness. Prioritize fonts and text metrics, timezone and date behavior, language/locale, navigator and client hints, screen, Canvas, WebGL/WebGPU, audio and their cross-surface consistency. Prefer a stable, coherent, common environment per browser profile or restrict a readout where feasible; assess whether changes themselves create distinctive signals. Do not rotate values on each read. Region, language and font presence alone do not prove a person's identity, and no configuration guarantees unlinkability.

Permissions and other hardware APIs are secondary: address them when they expose device or identifying information, without building a general permission-management product. Browser-profile storage separation and network diagnostics remain supporting dependencies because website-visible identifiers can persist or leak there.

## Simulation inventory

Each surface must have a defined configured value, consistency relationships, injection mechanism, supported contexts, persistence, restoration and a test. Inventory at minimum:

- Navigator: user agent, userAgentData and high-entropy values, platform, vendor, app version, languages, hardware concurrency, device memory, touch points, cookies, DNT, plugins and MIME types.
- Screen/window: dimensions, available area, color/pixel depth, device pixel ratio, orientation, viewport, media queries, pointer and hover capabilities; avoid inconsistent combinations.
- Locale/time: Accept-Language where supported, Intl constructors and resolved options, Date construction/parsing/getters/setters, Temporal, timezone offsets and DST transitions.
- Rendering: Canvas 2D readbacks and serialization, text measurement and font availability, WebGL/WebGL2 parameters, extensions, pixel readbacks, shader precision and WebGPU adapter/device information; preserve coherent outputs across APIs.
- Audio/media: AudioContext and OfflineAudioContext readbacks, codecs and capability queries, media devices, permissions, device labels and IDs. Specify blocking or unavailability when simulation cannot be safely implemented.
- Other signals: geolocation, sensors, battery, network information, Bluetooth, USB, HID, serial, gamepads, clipboard and permission queries; inventory absent APIs and distinguish unsupported from blocked.
- Storage and sessions: cookies, local/session storage, IndexedDB, cache and service workers require separate browser profiles for isolation; extension identity profiles alone do not isolate them.
- Network: observable request headers and client hints, WebRTC candidates, IP/DNS, proxy and transport signatures. Test against a controlled server; classify unmodifiable or browser-controlled fields explicitly.
- Contexts: main and isolated worlds, same/cross-origin frames, dedicated/shared/service workers, popups, navigations and authentication redirects. Identify race conditions and unavailable injection paths.
- Indirect signals: browser features, extension presence, timing, behavior, account state and submitted data. Define diagnostic visibility and limitations instead of claiming to simulate them.

## Architecture decision to validate

Replace Tampermonkey distribution with a Chromium Manifest V3 extension. Keep settings local, use packaged code, a service worker, a settings page and early page-world scripts. Explicitly evaluate extension permissions, installation, release signing and browser support before selecting APIs. Default scope is Claude/Anthropic; third-party login domains require separate informed authorization. A separate browser profile provides storage isolation; an extension profile does not create one. Do not claim full isolation, anonymity, eligibility or ban prevention.

## Ordered backlog and acceptance criteria

- [ ] **P0 — feasibility and threat model.** Inventory Chrome versions and API/permission constraints, injection timing, restricted pages, CSP and extension update behavior. Produce a signal matrix with owner, effective scope, default, failure mode, verification method and documented residual exposure. Validate locally before committing to an API. No detection-evasion or ban-risk score claims.
- [ ] **P1 — extension foundation and migration** (depends on P0). MV3 manifest, local settings, least-privilege host access, versioned schema and recovery, build and reproducible packaging, settings UI and explicit user-directed migration from old settings. Preserve old releases; do not promise automatic access to userscript-manager storage.
- [ ] **P2 — consistent environment** (depends on P1). Stable configurable locale, languages, timezone and supported device/screen values; migrate applicable existing logic. Validate defaults, explicit API arguments, DST and edge cases; test page, frames and workers separately. Report unsupported contexts rather than silently passing.
- [ ] **P3 — fingerprint surface evaluation and controls** (depends on P2). Prioritize Chinese font exposure and text metrics, Canvas, WebGL/WebGPU and audio, then assess media devices and hardware APIs that expose identifying attributes. Prototype configurable protection only where behavior and compatibility can be tested; expose stable per-profile settings and restore path. Avoid promising simulation of real hardware. Track every unsupported surface explicitly.
- [ ] **P4 — network and isolation diagnostics** (depends on P1). Assess request-header controls against actual MV3 API restrictions, JS versus server observations, WebRTC settings, IP and DNS visibility, and optional privacy-preserving checks. Document TLS, HTTP/2/3, IP routing and browser-native limitations. Separate browser profile setup, clearing and recovery instructions; never claim extension settings isolate cookies across browser profiles.
- [ ] **P5 — evidence and user experience** (depends on P2–P4). Status distinguishes applied, tested, unverified, unsupported and failed, with execution context and reload state. Provide recovery and backup guidance without collecting account credentials, message content or authentication cookies. External diagnostic requests require explicit consent and disclose recipients.
- [ ] **P6 — validation and delivery** (depends on P5). Test local server-observed headers, page/frame/worker contexts, profile restarts, rollback, permissions, graceful failure, regression and Claude sign-in/chat compatibility where accessible. Record Chromium versions and untested environments. Document CRX signing and platform installation restrictions; deliver reviewable PR without merge under PLAN2DO.

## Coverage review checklist

- Browser identity, UA and client hints, screen, hardware, input, fonts, Canvas, WebGL/WebGPU, audio, media and permissions.
- Locale, language, region, timezone, dates, system clock and formatting.
- Cookies, storage, cache, service workers, browser profiles, account and authentication history.
- HTTP headers, IP, DNS, WebRTC, proxies, TLS, transport protocols and server-side correlation.
- Top-level page, same/cross-origin frames, dedicated/shared/service workers, popups, redirects, third-party login and restricted browser pages.
- Account security, service policies, support/appeal, user-submitted content, payments, behavior and recovery: informational boundaries, not controllable fingerprint settings.
- New or unknown signals and extension detectability remain possible; negative tests are not proof of absence.

## Research and implementation gates

Verify the official MV3 documentation for each chosen API and its supported Chrome versions during P0. Test whether header modification, early injection and each claimed context actually work before promoting a backlog item to a promise. Review the complete signal matrix and test results before implementation scope is approved. This plan contains no claim that the extension can control browser-native transport, physical location or Anthropic's decisions.
