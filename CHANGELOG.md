# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — unified workspace redesign (2026-11-14, local only, not deployed)
- New Lead button and form: duplicate check, application type, employment situation, Create Lead Only / Create Lead & Invite Client.
- One workspace per file with a compact client header and nine tabs; a lead and an application are the same record.
- Repeatable employments, other income, assets and liabilities with add, remove-with-confirm and undo.
- Portal access, document checklist and secure messages inside the file.
- Portal invitations by one-time setup link with review and confirmation; honest status when email is not configured.
- Configurable lead stages and lead sources (Admin → Organization).
- Calculators start from the open file's figures.
- SIN encrypted at rest, masked on screen and print, excluded from the audit trail.
- Documents: PRODUCT_REDESIGN, CRM_SPECIFICATION, APPLICATION_WORKSPACE, INTEGRATION_ARCHITECTURE, IMPLEMENTATION_PLAN, TEST_RESULTS, USER_GUIDE.

### Added — follow-up round (2026-11-14, local only, not deployed)
- Qualifying defaults (stress buffer, rate floor, revolving percentage) editable in Admin → Organization.
- Total Assets, Total Liabilities and Net Worth calculated from the entries.
- Drag-and-drop upload for staff on the document checklist and on lender conditions.
- Calendar shows each file's closing, conditions and follow-up dates.
- Every new lead creates a "First contact" task for its agent.
- SECURITY_AUDIT and DEPLOYMENT_CHECKLIST (with a production-readiness assessment).

### Security — follow-up round
- Next.js 16.3.5 → 16.4.6; `shadcn` moved to dev dependencies; runtime `npm audit` advisories 18 → 0.

### Security — 2026-11-15 (local only, not deployed)
- Sign-in lockout is counted in the database (new table `login_failures`, migration `0016`) instead of server memory.
- `Strict-Transport-Security`, `Permissions-Policy` and a report-only `Content-Security-Policy` are sent on every page.
- Documents staff attach to lender conditions go through the virus scan when a scanner is configured.

### Fixed — bug audit (2026-11-15, local only)
- Long-name leads no longer fail after being created; Calculated Payment shows on early files; five malformed-input
  cases now refuse cleanly instead of raising a database error. See TEST_RESULTS "Bug audit".
- Second pass: a signed-in client is turned back to the portal from every staff page (four data-free staff screens
  used to render for them); NUL characters in text fields are dropped instead of raising a database error.

### Changed — follow-up round
- Admin menu hidden for agents and assistants.
- Pipeline volume uses price less down payment when no mortgage amount is entered.
- Portal says "Shared with your co-applicant" only when there is one.
- Session provider resets when a different user signs in.

### Changed
- Sidebar: Dashboard, Pipeline, Messages, CRM & Contacts, Tasks & My Day; the deal submenu lists the nine tabs.
- GDS/TDS include additional employments, other income and listed liabilities; mortgage amount falls back to loan amount, then price less down payment.
- Old deal tab URLs redirect to the new tabs.
- "Send new password" renamed "Send password reset link".
- Audit trail no longer records unchanged dates on every save.

### Fixed
- Count the README token badge in CI so it reflects the current default branch instead of a stale hosted count.

## [0.6.1] - 2026-10-05

### Changed
- Generalize cloning guidance: treat each observation as a sample of a rule found by varying width, height, input, and state; use the source's actual files; and build shared components from every observed state.

## [0.6.0] - 2026-10-05

### Changed
- Simplify the shared website-cloning workflow, improve responsive and motion guidance, and align the project documentation.

## [0.5.1] - 2026-09-26

### Changed
- Recommend Claude Code with Opus 5.5 in the README
- Refreshed the static Star History chart through September 2026
- Removed a redundant note about editing the canonical skill from the README

### Security
- Update Next.js and eslint-config-next to 16.3.5 with exact version pins, and refresh vulnerable transitive dependencies. Thanks to @atahan150 for the report in [#117](https://github.com/JCodesMore/ai-website-cloner-template/issues/117) and proposed fix in [#118](https://github.com/JCodesMore/ai-website-cloner-template/pull/118).

## [0.5.0] - 2026-09-17

### Added
- Repository ranking badges in the README

### Changed
- Simplified Quick Start with a copyable agent setup prompt, a template button, and one cloning command example
- Consolidated Claude Code, Codex, Cursor, and OpenCode support around one canonical Agent Skill in `.agents/skills/clone-website/`
- Reduced the Claude Code integration to a thin command bridge that forwards arguments to the canonical skill without creating a duplicate skill in other agents
- Moved the website inspection guide into the canonical skill's on-demand references

### Removed
- Expired sponsor integrations
- Japanese and Simplified Chinese READMEs; the English README is the single maintained entry point
- Redundant workflow diagrams from the READMEs
- Generated skill and instruction copies for unsupported or redundant agent platforms
- The agent-rule and skill synchronization scripts and their generated-file CI gate

## [0.4.0] - 2026-08-10

### Added
- Docker workflows for local development and multi-stage production builds
- Kiro support through a generated workspace `/clone-website` skill
- Complete generated workspace skills for Cline and Roo Code, including a Roo slash-command bridge
- Simplified Chinese and Japanese READMEs with the same onboarding and workflow guidance as the English documentation
- Contributor and security policies, including a private vulnerability-reporting path
- CI enforcement that generated agent rules and skills remain synchronized with their source files
- Compact pipeline diagrams and a static Star History chart in every README

### Changed
- Raised the project Node.js baseline to 24 across local development, CI, Docker, and contributor-facing documentation
- Refreshed Next.js to 16.3, React to 19.2.4, and related dependencies
- Updated `/clone-website` so later runs preserve existing pages and isolate routes, research, components, assets, and downloaders for each target
- Improved multi-origin and query/fragment planning with collision-resistant output namespaces and explicit route verification
- Redesigned README onboarding around the template workflow, Opus 5 recommendation, supported platforms, and community links
- Hardened the rule and skill generators for current platform schemas and deterministic output

### Fixed
- Gemini CLI command validation by adding the required name and flattening the prompt schema
- Cline and Roo Code invocation, frontmatter, and argument handling
- Next.js documentation resolution in generated agent rules
- Vulnerable framework dependencies and generated-file consistency checks

### Removed
- Aider from the officially supported-platform list because its current capabilities cannot run the complete browser and subagent workflow reliably; `.aider.conf.yml` remains available for loading general project context

### Security
- Documented responsible vulnerability disclosure through GitHub private vulnerability reporting
- Updated vulnerable dependencies to patched releases

## [0.3.1] - 2026-03-29

### Fixed
- `sync-agent-rules.sh` failing to resolve `@file` imports on Windows due to CRLF line endings — platform instruction files now correctly inline the Inspection Guide content

## [0.3.0] - 2026-03-29

### Added
- Multi-URL support for `/clone-website` — clone multiple sites in a single command with parallel processing and isolated output
- CI quality gates via GitHub Actions — automated lint, typecheck, and build on every push and PR
- `npm run typecheck` and `npm run check` scripts for local quality validation
- `.gitattributes` for cross-platform line ending normalization
- `.nvmrc` to pin Node.js 20 for contributor consistency

### Changed
- Streamlined PR template — removed redundant checklist items and screenshots section
- Improved project description and README — clearer use cases, limitations, and modern wording
- Refined documentation and agent rules across all platforms for clarity and consistency
- Fixed CRLF handling in `sync-skills.mjs` for reliable Windows operation

### Removed
- Outdated use case from README documentation

## [0.2.0] - 2026-03-28

### Added
- Multi-platform AI agent support: Claude Code, Codex CLI, OpenCode, GitHub Copilot, Cursor, Windsurf, Gemini CLI, Cline/Roo Code, Continue, Amazon Q, Augment Code, Aider
- Platform-specific instruction files and `/clone-website` skill for each supported agent
- `scripts/sync-agent-rules.sh` to regenerate platform instruction files from AGENTS.md
- `scripts/sync-skills.mjs` to regenerate `/clone-website` skill across all platforms
- GEMINI.md for Gemini CLI configuration
- Supported Platforms table in README
- "Updating for Other Platforms" documentation section in README

### Changed
- README now describes the project as multi-agent (Claude Code recommended, not required)
- AGENTS.md updated with sync script reminders

## [0.1.1] - 2026-03-28

### Added
- Bug report and feature request issue templates
- Pull request template with checklist
- CHANGELOG.md following Keep a Changelog format
- Package.json metadata (description, repository, homepage, keywords, engines)

### Fixed
- LICENSE copyright holder now attributed to JCodesMore

## [0.1.0] - 2026-03-28

### Added
- Initial template scaffold for website reverse-engineering with Claude Code
- `/clone-website` skill for full-site cloning pipeline
- `/build-from-spec` and `/customize` skills
- Parallel builder agents with git worktree isolation
- Chrome MCP integration for design token extraction
- Comprehensive inspection guide and project structure documentation
- Next.js 16 + shadcn/ui + Tailwind CSS v4 base scaffold
- MIT license
- README with badges, demo section, quick start, and star history

[Unreleased]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JCodesMore/ai-website-cloner-template/releases/tag/v0.1.0
