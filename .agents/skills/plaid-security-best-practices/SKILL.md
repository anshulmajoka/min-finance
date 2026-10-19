---
name: plaid-security-best-practices
description: Secure Plaid integrations with token encryption, RLS patterns, access token rotation, audit logging, and least-privilege access. Use when the user needs to harden their Plaid implementation.
standards-version: 1.10.0
---

# Plaid Security Best Practices

> **Coming in v0.7.0** - This skill will provide comprehensive security guidance for Plaid integrations including token storage, encryption, RLS, audit logging, and compliance patterns.

## Trigger

Use this skill when the user:

- Needs to store Plaid access tokens securely
- Wants to encrypt sensitive Plaid data at rest
- Is implementing row-level security for multi-tenant apps
- Needs audit logging for Plaid API calls
- Wants to implement access token rotation
- Is preparing for a security audit of their Plaid integration

## Required Inputs

- **Architecture**: Single-tenant vs multi-tenant, database type
- **Compliance requirements**: SOC 2, PCI, GDPR, or general best practices

## Workflow

1. Implement secure token storage with encryption at rest
2. Set up row-level security for multi-tenant access token isolation
3. Implement audit logging for all Plaid API interactions
4. Configure least-privilege access for Plaid products
5. Set up monitoring and alerting for security events

**Planned content:**
- Access token encryption (AES-256-GCM, envelope encryption with KMS)
- Database column encryption patterns (Prisma, TypeORM, raw SQL)
- Row-level security for multi-tenant Plaid data
- Audit logging: who accessed what, when, and why
- Access token rotation strategies
- Least-privilege product selection
- PII handling for identity data
- SOC 2 compliance checklist for Plaid integrations
- Webhook endpoint security (IP allowlisting, TLS, CORS)

## Key References

- [Plaid security guide](https://plaid.com/docs/account/security/)
- [Access token management](https://plaid.com/docs/api/tokens/)
- [Webhook verification](https://plaid.com/docs/api/webhooks/webhook-verification/)

## Example Interaction

**User:** "How should I store Plaid access tokens in my Postgres database?"

**Agent:**
1. Shows AES-256-GCM encryption for the access_token column
2. Implements a decrypt-on-read pattern using application-layer encryption
3. Suggests using a KMS (AWS KMS, GCP KMS) for key management
4. Adds RLS policy for multi-tenant isolation
5. Notes: "Never log access tokens. Use item_id as the non-sensitive identifier."

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Inspect token | `plaid_inspectAccessToken` | Check token metadata without exposing the full token |
| Remove item | `plaid_removeItem` | Securely deactivate an access token |

## Common Pitfalls

1. **Storing access tokens in plain text** - always encrypt at rest
2. **Logging access tokens** - use item_id in logs, never the access token
3. **Client-side token exposure** - access tokens must never reach the browser

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - secure token exchange flow
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle security-related errors
