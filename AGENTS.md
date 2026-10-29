# HBK Spor agent guidance

Use these project-specific checks when planning, changing, or reviewing code. Keep this file as a concise working guide; do not vendor entire third-party prompt libraries into the product.

## Project boundaries

- Treat `hbk-spor-src/` as the source reconstruction/Cloudflare Pages root and `source-rebuild/` as a separate prototype. Do not conflate their databases, bundles, or deployment status.
- Preserve compatibility with existing user data and the legacy built app unless a task explicitly authorizes a migration or replacement. Verify before any production routing or deployment change.
- Put analytics-only experiences in the existing Analiz section, not on Ana, unless the user explicitly changes that scope.
- Do not present self-reported RPE or schematic exercise guidance as measured physiology, injury prediction, or personalized medical advice.
- Keep demo data separate from real user metrics. Never claim that push notifications work until the permission, service, and backend deployment are actually configured.

## Frontend and product review

For interface work, use these review lenses (inspired by the Agency Agents UI Designer, Frontend Developer, and Code Reviewer profiles):

1. **Correctness and data safety:** preserve existing contracts; test empty, malformed, and populated data paths.
2. **Usability and accessibility:** semantic controls, keyboard operation, clear focus/labels, readable contrast, and responsive mobile layouts.
3. **Performance:** avoid unnecessary assets, dependencies, and work on every render; keep the shipped bundle appropriate.
4. **Verification:** add targeted tests, run the relevant test suite and production build, inspect `git diff --check`, and review the final diff.
5. **Review quality:** prioritize correctness, security, user-data integrity, and meaningful tests over stylistic preferences. Make findings specific, evidence-based, and actionable.

## Security review

For security questions, adapt the Cloudflare Security Audit Skill's evidence-first approach:

- First identify architecture, trust boundaries, sensitive data, inputs, and the exact in-scope code/deployment surface.
- Trace candidate issues from attacker-controlled input to a concrete security boundary and observable impact. A checklist gap alone is not a confirmed vulnerability.
- Separate confirmed, disproven, and unresolved leads. Keep unresolved claims explicitly unresolved; do not assign severity without demonstrated impact.
- Include exact files/locations, attack preconditions, and a bounded reproduction or source trace in findings. Recheck that fixes do not break user-data compatibility.
- Be explicit about audit scope and what was not tested. A dependency report, static review, or checklist pass is not by itself a full security audit.
- Do not execute untrusted project code or tests outside the available sandbox and network/resource controls.

**Capability boundary:** the full upstream Cloudflare workflow expects isolated subagents and an OS-enforced execution sandbox. If those capabilities are not available in the active environment, use the guidance/checklists only and state that an independent multi-agent audit was not performed. Never claim the upstream full audit or independent verification was completed when it was not.

## References

These are external agent/workflow references, not application dependencies. Use only the role or audit guidance relevant to the task; check upstream changes before relying on version-sensitive details.

- Cloudflare Security Audit Skill: <https://github.com/cloudflare/security-audit-skill> (reviewed at `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`)
- Agency Agents: <https://github.com/msitarzewski/agency-agents>
  - UI Designer: <https://github.com/msitarzewski/agency-agents/blob/f4ec18a618f14612482e8d160c439d7e9fb25a7e/design/design-ui-designer.md>
  - Frontend Developer: <https://github.com/msitarzewski/agency-agents/blob/6650b67b9aed795313c1b086e4ac1e97e93d835d/engineering/engineering-frontend-developer.md>
  - Code Reviewer: <https://github.com/msitarzewski/agency-agents/blob/6233a445b9b3d0582d574064ba56adc8082f358f/engineering/engineering-code-reviewer.md>
