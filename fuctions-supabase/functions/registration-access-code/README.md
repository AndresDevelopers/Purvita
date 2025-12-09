# registration-access-code edge function

Generates and stores the weekly registration access code every Monday at 00:00 (UTC). Configure a Supabase Edge Function schedule to invoke this endpoint with a `POST` request shortly after midnight:

```text
supabase functions deploy registration-access-code --no-verify-jwt
```

Schedule example:

```text
supabase functions schedule create weekly-registration-code \
  --cron "0 0 * * 1" \
  --project-ref your-project-ref \
  --function registration-access-code
```

The function expects the following environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

It persists the generated code into the `registration_access_codes` table for the corresponding week and returns the payload for observability dashboards.
