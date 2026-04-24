BRAVE_API_KEY — provisioning and usage

Purpose

The research agent PoC uses Brave Search API for automated web_search. The agent requires a BRAVE_API_KEY (a secret token) available as an environment variable at runtime.

Where to provision

1) GitHub Actions (recommended for CI runs):
   - Repository > Settings > Secrets and variables > Actions > New repository secret
   - Name: BRAVE_API_KEY
   - Value: <your-brave-api-key>

2) Local / CI runtime environment (for scheduled cron jobs or research scripts):
   - Add BRAVE_API_KEY to the environment variables used by the script runner.
   - Keep the secret scoped to the runner and avoid exposing it in logs.

How code expects it

- The research scripts expect BRAVE_API_KEY to be present in process.env.BRAVE_API_KEY (Node) or the environment where the agent runs. Example (Node.js):

  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY is not set');

- For curl-based quick tests, use: curl -H "Authorization: Bearer $BRAVE_API_KEY" "https://api.search.brave.com/v1/search?q=pruviq"

Security notes

- Never commit the secret into the repository.
- Use GitHub Actions secrets to rotate keys and limit exposure.
- If using shared runner environments, scope access to only the jobs that need the key.

References

- Brave Search API docs: https://search.brave.com/docs (verify the correct docs URL in your environment)

If you'd like, I can also add a small CI workflow that runs the research PoC only if BRAVE_API_KEY is present in secrets (safe-no-op otherwise).