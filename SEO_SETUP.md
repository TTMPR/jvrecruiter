# JVRecruit SEO activation

The application already provides:

- canonical URLs on `https://jvrecruiter.xyz`
- `robots.txt`
- dynamic `sitemap.xml`
- `noindex, nofollow` for `/admin`
- dynamic metadata for every published role
- `JobPosting` JSON-LD
- branded Open Graph images for the site and individual roles
- clean unique job slugs

## Google Search Console

1. Add `jvrecruiter.xyz` as a property in Google Search Console.
2. Complete domain verification through DNS.
3. Submit:
   `https://jvrecruiter.xyz/sitemap.xml`
4. If using Google's HTML meta verification method, add the verification token to Vercel as:
   `GOOGLE_SITE_VERIFICATION`

## Google Indexing API

Google limits the Indexing API to eligible JobPosting and livestream pages.

Before enabling it:

1. Create or select a Google Cloud project.
2. Enable the Indexing API.
3. Create a dedicated service account.
4. Add the service-account email as an owner of the verified Search Console property.
5. Store the credentials only as server-side Vercel environment variables:
   - `GOOGLE_INDEXING_CLIENT_EMAIL`
   - `GOOGLE_INDEXING_PRIVATE_KEY`
6. Never expose those values through `NEXT_PUBLIC_*` variables.

Once credentials are connected, publishing a role should send `URL_UPDATED`, while closing/removing a role should send `URL_DELETED`.

Do not use the Indexing API for non-job pages.
