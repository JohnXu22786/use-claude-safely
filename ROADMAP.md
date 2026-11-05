# Roadmap

This document describes **planned features**, not release dates or implementation details.

## Current development: v0.x

- Maintain and improve timezone, language, locale, and region settings.
- Refine font protection, WebRTC checks, and environment consistency notices.
- Improve website compatibility, stability, and interface usability.
- Maintain optional mail-site controls and a simple installation experience.

## Planned for v1.0

### Device fingerprint privacy

- **Device identity controls:** Manage the device details and browser identity information exposed to websites, including device model and UA Client Hints.
- **Canvas fingerprint protection:** Provide configurable protection for Canvas-based device fingerprinting.
- **WebGL and GPU fingerprint protection:** Provide controls for graphics-related fingerprint information.
- **Audio fingerprint protection:** Provide controls for audio-based device fingerprinting.
- **Network fingerprint privacy:** Add protection and visibility for network fingerprint signals, including TLS and HTTP/2.
- **Unified fingerprint controls:** Manage individual fingerprint protection features from one settings panel.
- **Protection status and consistency:** Show concise, understandable alerts for observable inconsistencies and incomplete protection.
- **Saved preferences and recovery:** Remember selected options and make it easy to restore original behavior.

## Planning principles

- Keep controls optional and understandable.
- Prioritize stable behavior and the ability to turn features off.
- Do not describe features as guarantees of anonymity or account safety.
- Final scope may change based on testing and user feedback.

See [BRANCHING.md](./BRANCHING.md) for the contribution and release workflow.
