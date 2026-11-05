# Branching and Contribution Workflow

## Branches

- **`main`** is the primary development branch and contains the current combined project.
- Work on focused, short-lived branches and merge changes through pull requests.
- Do not keep a permanent development branch solely to collect unrelated work.
- Use release branches only when needed for release stabilization or maintenance.

Suggested branch names:

| Purpose | Pattern | Example |
| --- | --- | --- |
| Feature | `feature/<topic>` | `feature/fingerprint-controls` |
| Bug fix | `fix/<topic>` | `fix/region-warning` |
| Refactor | `refactor/<topic>` | `refactor/settings-ui` |
| Documentation | `docs/<topic>` | `docs/v1-roadmap` |
| Tests | `test/<topic>` | `test/site-compatibility` |
| Release preparation | `release/<version>` | `release/v1.0.0` |

## Pull request flow

1. Create a branch from the latest `main`.
2. Keep each pull request focused on one related change.
3. Update documentation and tests when relevant.
4. Run the project's build and test checks.
5. Confirm required checks pass, then merge the pull request into `main` with a **merge commit**.
6. Delete the merged working branch when it is no longer needed.

Avoid rewriting public shared history, force-pushing `main`, or modifying historical version tags.

## Releases and versions

- The current project remains in the **v0.x.x** development series.
- Prefer **patch** updates for UI changes, fixes, searches, compatibility improvements, optimizations, and small additions.
- Reserve **minor** updates for meaningful functional milestones.
- Plan the device fingerprint privacy feature group for **v1.0**, as listed in [ROADMAP.md](./ROADMAP.md).
- Version changes, Git tags, and GitHub Releases are handled separately from ordinary pull request merges.
- Keep GitHub as the project's source and release platform; do not publish to other script marketplaces without a separate decision.

## Project files

The repository keeps modular source files and a single installable userscript. Commit the rebuilt installable file when source changes require it.

For an overview of supported features and installation, see [README.md](./README.md).
