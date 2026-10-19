---
name: plaid-institution-search
description: Search Plaid institutions by name, routing number, products supported, and country. Use when the user needs to find bank coverage, check institution availability, or look up institution details.
standards-version: 1.10.0
---

# Plaid Institution Search

## Trigger

Use this skill when the user:

- Wants to check if a specific bank is supported by Plaid
- Needs to search institutions by name or routing number
- Wants to filter institutions by supported products
- Needs institution details (logo, URL, products, MFA type)
- Is checking country-level coverage
- Needs to handle OAuth institutions differently from credential-based ones

## Required Inputs

- **Search query**: Institution name, routing number, or institution ID
- **Country codes** (optional, default US): ISO 3166-1 alpha-2 codes
- **Products** (optional): Filter by specific Plaid products

## Workflow

1. **Search by name** using `/institutions/search`:

   ```typescript
   import { PlaidApi, CountryCode, Products } from "plaid";

   const response = await plaidClient.institutionsSearch({
     query: "Chase",
     products: [Products.Transactions],
     country_codes: [CountryCode.Us],
     options: {
       include_optional_metadata: true,
     },
   });

   for (const inst of response.data.institutions) {
     console.log(`${inst.name} (${inst.institution_id})`);
     console.log(`  Products: ${inst.products.join(", ")}`);
     console.log(`  OAuth: ${inst.oauth}`);
     console.log(`  URL: ${inst.url}`);
   }
   ```

2. **Search by routing number** when you have an ABA routing number instead of a bank name:

   ```typescript
   const response = await plaidClient.institutionsSearch({
     query: "",
     products: null,
     country_codes: [CountryCode.Us],
     options: {
       routing_numbers: ["021000021"],
       include_optional_metadata: true,
     },
   });
   ```

   When filtering by routing number, pass an empty `query` string and `null` for `products`.

3. **Get institution details by ID** when you already know the institution ID:

   ```typescript
   const response = await plaidClient.institutionsGetById({
     institution_id: "ins_3",
     country_codes: [CountryCode.Us],
     options: {
       include_optional_metadata: true,
       include_status: true,
     },
   });

   const inst = response.data.institution;
   console.log(`Status: ${JSON.stringify(inst.status)}`);
   ```

   The `include_status` option returns real-time health data for the institution including transaction, auth, and identity update status.

4. **Handle OAuth institutions.** Many large US banks (Chase, Wells Fargo, Bank of America, Capital One) use OAuth:

   ```typescript
   if (institution.oauth) {
     // Must configure redirect_uri in Link token
     const linkToken = await plaidClient.linkTokenCreate({
       user: { client_user_id: userId },
       client_name: "My App",
       products: [Products.Transactions],
       country_codes: [CountryCode.Us],
       language: "en",
       redirect_uri: "https://myapp.com/plaid-oauth-callback",
     });
   }
   ```

   For OAuth institutions:
   - Register your redirect URI in the Plaid Dashboard
   - Handle the OAuth redirect flow in your app
   - The user authenticates on their bank's website, not in the Plaid Link modal

5. **Check product coverage.** Not all institutions support all products:

   | Product | Typical coverage |
   |---------|-----------------|
   | transactions | ~11,000 US institutions |
   | auth | ~6,000 US institutions |
   | identity | ~5,000 US institutions |
   | balance | Same as transactions |
   | investments | ~3,500 US brokerages |
   | liabilities | ~3,000 US institutions |

   Always check `institution.products` before requesting a product in Link.

6. **Common sandbox institutions for testing:**

   | Institution | ID | Notes |
   |-------------|-----|-------|
   | First Platypus Bank | `ins_109508` | Default sandbox institution with MFA |
   | Houndstooth Bank | `ins_109510` | No MFA required |
   | Platypus OAuth Bank | `ins_127989` | OAuth flow testing |
   | Tattersall Federal Credit Union | `ins_109512` | Credit union testing |

## Key References

- [Institutions search endpoint](https://plaid.com/docs/api/institutions/#institutionssearch)
- [Institutions get by ID](https://plaid.com/docs/api/institutions/#institutionsget_by_id)
- [OAuth guide](https://plaid.com/docs/link/oauth/)
- [Supported institutions](https://plaid.com/docs/link/duplicate-items/)
- [Institution status](https://status.plaid.com/)

## Example Interaction

**User:** "Does Plaid support Chase bank for transactions and identity?"

**Agent:**

1. Searches for "Chase" using `/institutions/search` with products filter
2. Returns Chase (ins_3): supports Transactions, Auth, Identity, Balance, Investments, Liabilities
3. Notes that Chase uses OAuth - redirect_uri must be configured in Link token
4. Shows the search code and Link token creation with OAuth support

**User:** "I have routing number 021000021, which bank is that?"

**Agent:**

1. Uses `/institutions/search` with `options.routing_numbers: ["021000021"]`
2. Returns JPMorgan Chase Bank, NA (ins_3)
3. Lists supported products and OAuth requirement
4. Notes: routing number search requires an empty query string and null products

**User:** "Is my bank available in Canada?"

**Agent:**

1. Asks for bank name, then searches with `country_codes: ["CA"]`
2. Shows results filtered to Canadian institutions
3. Notes that CA institutions support fewer products than US (no Auth, no Transfer)
4. Points to `plaid_listCountryCoverage` for the full country/product matrix

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Search by name | `plaid_searchInstitutions` | Search institutions by name with product and country filters |
| Get details | `plaid_getInstitution` | Get full institution details by ID including status and metadata |
| Check coverage | `plaid_listCountryCoverage` | Show supported countries and products per country |
| List products | `plaid_listProducts` | List all Plaid products to understand what you can filter by |

## Common Pitfalls

1. **Assuming all institutions support all products** - product support varies widely. A bank may support transactions but not auth or investments. Always check `institution.products` in the search response.
2. **Not handling OAuth institutions** - large banks like Chase, Wells Fargo, and Bank of America require OAuth. If you do not configure a `redirect_uri`, Link will fail for these institutions.
3. **Hardcoding institution IDs** - IDs like `ins_3` are stable but can change. Always search dynamically in production rather than storing a static list.
4. **Passing products when searching by routing number** - the routing number search requires `products: null`. Passing a products array with routing numbers returns empty results.
5. **Ignoring `include_optional_metadata`** - without this option, the response omits the institution URL, logo, and primary color. Always include it for user-facing displays.
6. **Not checking institution health** - use `include_status: true` with `institutionsGetById` before blaming your code for connection failures. The institution may be experiencing an outage.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - connect to discovered institutions via Link
- [Plaid API Reference](../plaid-api-reference/SKILL.md) - institution endpoint parameter details
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - test institution IDs and sandbox credentials
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle institution-level errors
