---
name: plaid-identity-verification
description: Implement Plaid Identity and Identity Verification products for KYC flows, document verification, and match scores. Use when the user needs to verify account holder identity.
standards-version: 1.10.0
---

# Plaid Identity Verification

## Trigger

Use this skill when the user:

- Needs to verify the identity of account holders
- Is implementing KYC (Know Your Customer) flows
- Wants to retrieve account holder names, addresses, and contact info
- Needs document verification (ID, passport, driver's license)
- Wants match scores comparing Plaid data to user-provided info
- Needs to handle joint accounts with multiple owners

## Required Inputs

- **Access token**: A Plaid access token with the `identity` product
- **Use case**: Basic identity retrieval, identity matching, or full KYC verification

## Workflow

1. **Connect with the identity product.** Request `identity` during Link:

   ```typescript
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Identity],
     country_codes: [CountryCode.Us],
     language: "en",
   });
   ```

2. **Retrieve identity data.** Returns names, addresses, emails, and phone numbers for each account holder:

   ```typescript
   const response = await plaidClient.identityGet({
     access_token: accessToken,
   });

   for (const account of response.data.accounts) {
     for (const owner of account.owners) {
       console.log(`Name: ${owner.names.join(", ")}`);
       for (const addr of owner.addresses) {
         console.log(
           `Address: ${addr.data.street}, ${addr.data.city}, ` +
             `${addr.data.region} ${addr.data.postal_code}`,
         );
         console.log(`  primary: ${addr.primary}`);
       }
       for (const email of owner.emails) {
         console.log(`Email: ${email.data} (${email.type}, primary: ${email.primary})`);
       }
       for (const phone of owner.phone_numbers) {
         console.log(`Phone: ${phone.data} (${phone.type}, primary: ${phone.primary})`);
       }
     }
   }
   ```

3. **Handle multiple owners.** Joint accounts return multiple `owners` entries. Always iterate rather than assuming a single owner:

   ```typescript
   const owners = account.owners;
   if (owners.length > 1) {
     // Joint account - match against any owner
     const matched = owners.some((owner) =>
       owner.names.some((name) =>
         fuzzyMatch(name, userProvidedName),
       ),
     );
   }
   ```

4. **Identity match scoring.** Compare Plaid identity data against user-provided info using the Identity Match endpoint:

   ```typescript
   const matchResponse = await plaidClient.identityMatch({
     access_token: accessToken,
     user: {
       legal_name: "Jane Doe",
       phone_number: "+14155551234",
       email_address: "jane@example.com",
       address: {
         street: "123 Main St",
         city: "San Francisco",
         region: "CA",
         postal_code: "94105",
         country: "US",
       },
     },
   });

   for (const account of matchResponse.data.accounts) {
     const scores = account.legal_name;
     // scores.score - 0-100, higher is better
     // scores.is_nickname_match, scores.is_first_name_or_last_name_match
     console.log(`Name match score: ${scores?.score}`);
     console.log(`Address match: ${account.address?.score}`);
     console.log(`Email match: ${account.email_address?.score}`);
     console.log(`Phone match: ${account.phone_number?.score}`);
   }
   ```

   | Score Range | Interpretation | Action |
   |-------------|---------------|--------|
   | 90–100 | Strong match | Auto-approve |
   | 70–89 | Likely match | Review edge cases |
   | 50–69 | Weak match | Request additional verification |
   | 0–49 | Mismatch | Flag for manual review |

5. **Identity Verification product (KYC).** For full KYC with document and selfie verification, use the Identity Verification product - a separate Plaid product from Identity:

   ```typescript
   // Create an Identity Verification session via Link
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.IdentityVerification],
     identity_verification: {
       template_id: "idvtmp_xxxxxxxxx", // from Plaid Dashboard
     },
     country_codes: [CountryCode.Us],
     language: "en",
   });
   // After the user completes the flow in Link, retrieve results
   // via the IDENTITY_VERIFICATION webhook or /identity_verification/get
   ```

   Document types supported: passport, driver's license, national ID, residence permit.

6. **Sandbox testing.** Sandbox items return synthetic identity data:

   ```typescript
   // Use plaid_createSandboxItem then plaid_getIdentity MCP tools
   // Sandbox returns predictable test names and addresses
   ```

## Data Availability

Identity data coverage varies by institution. Not all banks return all fields:

| Field | Coverage | Notes |
|-------|----------|-------|
| Names | High | Almost always available |
| Addresses | High | May have multiple (current + previous) |
| Emails | Medium | Not all institutions return email |
| Phone numbers | Medium | May return landline or mobile |
| Date of birth | Low | Rare outside Identity Verification |

## Key References

- [Identity product](https://plaid.com/docs/identity/)
- [Identity Verification](https://plaid.com/docs/identity-verification/)
- [Identity match](https://plaid.com/docs/api/products/identity/#identitymatch)
- [Identity get](https://plaid.com/docs/api/products/identity/#identityget)

## Example Interaction

**User:** "I need to verify that the person connecting their bank account is who they say they are for KYC compliance."

**Agent:**
1. Explains the difference between Identity (data retrieval) and Identity Verification (KYC flow with document scanning)
2. Creates a sandbox item with `identity` product via `plaid_createSandboxItem`
3. Retrieves identity data via `plaid_getIdentity`
4. Shows how to compare names and addresses with match scoring
5. Recommends Identity Verification product for stricter KYC requirements
6. Notes: "Identity data availability varies by institution - always handle missing fields gracefully"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create sandbox item | `plaid_createSandboxItem` | Create a test item with `identity` product |
| Get accounts | `plaid_getAccounts` | List accounts for the item |
| Get identity | `plaid_getIdentity` | Retrieve account holder names, addresses, emails, phones |
| Create Link token | `plaid_createLinkToken` | Create Link token with `identity` product |
| Search institutions | `plaid_searchInstitutions` | Find institutions supporting identity |

## Common Pitfalls

1. **Assuming a single owner** - joint accounts return multiple `owners` entries. Always iterate through all owners when matching.
2. **Using exact string matching for names** - name variations are common (Bob vs. Robert, Jr./Sr. suffixes). Use fuzzy matching or the Identity Match endpoint.
3. **Expecting all fields to be present** - email and phone coverage varies. Check for empty arrays before accessing.
4. **Confusing Identity and Identity Verification** - Identity retrieves bank-reported data. Identity Verification is a separate KYC product with document scanning and selfie matching.
5. **Not handling address formatting differences** - institutions may return addresses in different formats. Normalize before comparing.
6. **Storing PII in plain text** - identity data is sensitive. Encrypt at rest and limit access to authorized services only.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - connect with identity product
- [Plaid Account Verification](../plaid-account-verification/SKILL.md) - verify account ownership via Auth
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle identity endpoint errors
