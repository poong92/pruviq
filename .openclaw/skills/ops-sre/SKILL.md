# SKILL: ops-sre

Role
- Monitor availability, aggregate service health signals, create ops tickets and provide runbooks for incident response.

When to use
- Site or API 5xx/timeout detected, scheduled uptime checks, when alerts fire

Inputs
- Alerts (Upptime, Sentry, Prometheus), incident metadata (timestamps, sample traces)

Outputs
- Incident ticket (summary, first-run checks, logs to collect, suggested next steps)
- Postmortem draft template with timeline + root-cause candidates

Example tasks
- "On /coins/stats 503, gather last 2 hours of logs and create ops ticket with suggested checks"
- "Add Upptime cron for /api endpoints and configure Slack webhook"

Required permissions
- Read access to monitoring dashboards (Sentry, Prometheus) and ability to create issues in repo

Safety constraints
- No automatic server restarts without explicit human approval

Notes
- This skill prepares all necessary context so humans can act quickly. It can also trigger pager routes when configured.
