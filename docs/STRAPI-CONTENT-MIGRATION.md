# Strapi Content Migration And Seed Safety

This baseplate separates Strapi schema/code from Strapi content.

## Source Of Truth

- Git is the source of truth for Strapi schemas, components, routes, controllers, services, and frontend rendering code.
- Live Strapi is the source of truth for published production content once editors have changed it.
- `backend/.tmp/data.db` and `backend/public/uploads` are runtime data. They are not Git-owned content.

## Current Seed Policy

This baseplate intentionally carries no project-specific content types and no seed routine.

- Do not add content seeds until the target project has confirmed CMS requirements.
- Do not run seeds unconditionally in production.
- If a future project adds seed behavior, keep production seed settings disabled unless a deliberate one-time bootstrap is being run.
- Seeds should create missing records only. Do not overwrite editor-owned live content during normal deploys.

When adding a new CMS-backed page or content type that needs default content:

1. Add or update the Strapi schema in `backend/src/api` and `backend/src/components`.
2. Add narrowly scoped create-if-missing seed behavior only when default CMS content is required.
3. Avoid overwriting existing fields for records that already exist.
4. Back up live Strapi before enabling the seed on a remote environment.
5. Enable the seed only for the intended one-time bootstrap, confirm the intended records were created, then disable it again.

## Local To Live Content Transfer

Use Strapi transfer only when local content should replace or migrate into the remote CMS.

Before transferring:

1. Confirm the remote target is correct.
2. Back up the remote database and uploaded media.
3. Create a remote transfer token in Strapi Admin:

```text
Settings -> Global settings -> Transfer Tokens
```

4. Run the transfer from local `backend/`:

```bash
cd backend
npx strapi transfer --to https://your-remote-cms/admin --to-token "YOUR_TRANSFER_TOKEN"
```

After transfer:

- Confirm key records in the remote Strapi admin.
- Confirm the public frontend after any revalidation window.
- Keep production seed settings disabled unless another one-time bootstrap is planned.

## Safe Deployment Checklist

Before pushing backend changes:

- Check whether backend seed utilities were introduced or changed.
- Confirm production seed settings are disabled unless a one-time bootstrap is scheduled.
- Back up `backend/.tmp/data.db` and `backend/public/uploads` before any live transfer or intentional seed run.
- Run `npm run build:backend` from the repository root.
