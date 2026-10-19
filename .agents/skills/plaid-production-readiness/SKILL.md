---
name: plaid-production-readiness
description: Prepare a Plaid integration for production access including the application process, compliance checklist, and sandbox to development to production migration path.
standards-version: 1.10.0
---

# Plaid Production Readiness

> **Coming in v0.7.0** - This skill will provide a comprehensive production readiness checklist covering the Plaid production access application, compliance requirements, and environment migration.

## Trigger

Use this skill when the user:

- Is ready to move from sandbox to development or production
- Needs to apply for Plaid production access
- Wants a compliance checklist for their Plaid integration
- Needs to understand the sandbox -> development -> production path
- Is preparing for Plaid's application review process

## Required Inputs

- **Current environment**: Sandbox or development
- **Target environment**: Development or production
- **Products used**: Which Plaid products the app uses

## Workflow

1. Complete all integration requirements in sandbox
2. Apply for development access to test with real banks
3. Verify integration works with real institutions in development
4. Complete the production access application
5. Address any review feedback from Plaid
6. Migrate configuration and deploy to production

**Planned content:**
- Sandbox to development migration checklist
- Development to production application requirements
- Plaid production access application walkthrough
- Compliance checklist (privacy policy, ToS, data handling)
- Technical requirements (webhook HTTPS, OAuth redirect, error handling)
- Environment variable management across environments
- Load testing and rate limit planning
- Monitoring and alerting setup for production
- Launch day checklist

## Key References

- [Production access](https://plaid.com/docs/account/production/)
- [Going live checklist](https://plaid.com/docs/link/best-practices/)
- [Plaid Dashboard](https://dashboard.plaid.com)

## Example Interaction

**User:** "My Plaid integration works in sandbox. What do I need to do to go live?"

**Agent:**
1. Walks through the development access application
2. Lists technical requirements (HTTPS webhook, error handling, update mode)
3. Provides compliance checklist (privacy policy, data retention, user consent)
4. Shows environment migration steps
5. Notes: "Production approval typically takes 1-2 weeks. Start the application early."

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Verify integration | `plaid_getItemStatus` | Check item health in development |
| Test all products | `plaid_getAccounts` | Verify all products work with real banks |

## Common Pitfalls

1. **Skipping development** - test with real banks in development before applying for production
2. **Missing error handling** - Plaid reviews require proper ITEM_LOGIN_REQUIRED handling
3. **No webhook HTTPS** - production webhooks require HTTPS endpoints
4. **Incomplete privacy policy** - must disclose Plaid data usage to end users

## See Also

- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - complete sandbox testing first
- [Plaid Security Best Practices](../plaid-security-best-practices/SKILL.md) - security requirements for production
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - required error handling for approval
