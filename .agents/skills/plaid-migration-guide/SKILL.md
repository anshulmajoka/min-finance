---
name: plaid-migration-guide
description: Migrate from Yodlee, MX, Finicity, or other aggregators to Plaid. Covers data mapping, institution coverage comparison, and migration strategies.
standards-version: 1.10.0
---

# Plaid Migration Guide

> **Coming in v0.7.0** - This skill will provide comprehensive migration guidance from competing aggregators to Plaid with data mapping, coverage comparison, and transition strategies.

## Trigger

Use this skill when the user:

- Is migrating from Yodlee, MX, Finicity, or another aggregator to Plaid
- Needs to compare institution coverage between providers
- Wants to map data fields from another provider to Plaid's schema
- Is planning a phased migration strategy
- Needs to handle dual-provider operation during transition

## Required Inputs

- **Source provider**: Yodlee, MX, Finicity, or other aggregator
- **Data types**: Transactions, accounts, identity, investments, etc.
- **Migration scope**: Full replacement or hybrid/gradual

## Workflow

1. Audit current integration and data dependencies
2. Map source provider fields to Plaid equivalents
3. Compare institution coverage for your user base
4. Plan migration phases (new users first, then existing)
5. Implement dual-provider operation if needed
6. Migrate existing connections with minimal user disruption

**Planned content:**
- Field mapping tables: Yodlee to Plaid, MX to Plaid, Finicity to Plaid
- Institution coverage comparison methodology
- Phased migration strategies
- Dual-provider architecture patterns
- User re-linking workflows
- Data reconciliation and validation
- Rollback planning

## Key References

- [Plaid migration guide](https://plaid.com/docs/link/best-practices/)
- [Plaid product comparison](https://plaid.com/docs/)

## Example Interaction

**User:** "We're migrating from Yodlee to Plaid. We have 50,000 connected accounts. What's the best approach?"

**Agent:**
1. Recommends a phased approach: new users on Plaid first, then batch migrate
2. Maps Yodlee fields to Plaid equivalents
3. Identifies coverage gaps for the user's institution mix
4. Designs a re-linking flow that minimizes user friction
5. Notes: "Budget 3-6 months for a full migration at this scale"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Check coverage | `plaid_searchInstitutions` | Verify institution support for your user base |
| List products | `plaid_listProducts` | Compare available products |

## Common Pitfalls

1. **Big-bang migration** - gradual migration reduces risk; don't switch all users at once
2. **Assuming identical coverage** - some institutions may not be available on Plaid
3. **Not mapping categories** - different providers use different category taxonomies

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - re-link users during migration
- [Plaid Production Readiness](../plaid-production-readiness/SKILL.md) - prepare for production after migration
