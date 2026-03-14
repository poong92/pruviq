# n8n Automation Workflows Setup Guide

Complete setup instructions for JEPO system n8n workflows: error handling, OOS validation, and extended health monitoring.

## Overview

| Workflow | Trigger | Purpose | Credentials |
|----------|---------|---------|-------------|
| telegram-error-handler.json | Webhook (PRUVIQ Alert bot) | Auto-remediate errors: LaunchAgent restart, n8n retry, log rotation | Telegram, SSH, n8n API |
| oos-validation-pipeline.json | Schedule (Sunday 09:00 UTC) | Weekly OOS validation: 8-criteria check for trading resumption | PRUVIQ API, Telegram |
| health-monitoring-extended.json | Schedule (every 30 min) | 3-endpoint health checks: rankings, health, simulate + pattern storage | Telegram, Mem0 MCP |

---

## Part 1: Prerequisites

### 1.1 n8n Access
- Running on Mac Mini at `http://localhost:5678`
- Admin account with workflow creation permissions
- API key (Settings → API section)

### 1.2 Telegram Bots
All alerts go to **PRUVIQ Alert** bot (ID: 8057086954):

```bash
# Bot token location
cat ~/.env | grep TELEGRAM_BOT_TOKEN
echo "TELEGRAM_CHAT_ID: $(cat ~/.env | grep TELEGRAM_CHAT_ID)"
```

### 1.3 SSH Access
Workflows execute SSH commands on DO server:
```
SSH Host: 167.172.81.145:2222
User: root
Auth: SSH key (Mac Mini ~/.ssh/id_rsa or ~/.ssh/do_key)
```

### 1.4 PRUVIQ API
- Base: `https://api.pruviq.com`
- Endpoints: `/rankings/daily`, `/health`, `/simulate`
- Public endpoints (no auth required for health checks)

### 1.5 Mem0 MCP Integration
- n8n MCP connector for Mem0 Cloud
- Status: Configured in CLAUDE.md
- Purpose: Error pattern + health pattern storage

---

## Part 2: Import Workflows

### Step 1: Prepare n8n Environment Variables

Create/update n8n environment variables at `~/.n8n/.env`:

```bash
# Telegram
TELEGRAM_BOT_TOKEN=<your_pruviq_alert_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id_with_bot>

# n8n API
N8N_API_KEY=<your_n8n_api_key>

# SSH (optional, embedded in workflow SSH commands)
SSH_HOST=167.172.81.145
SSH_PORT=2222
SSH_USER=root

# Optional: Mem0 API key (if using MCP directly in workflows)
MEM0_API_KEY=<your_mem0_api_key>
```

### Step 2: Import JSON Workflows

1. Open n8n: `http://localhost:5678`
2. Click **Workflows** → **Import from file**
3. Select workflow JSON file:
   - `telegram-error-handler.json`
   - `oos-validation-pipeline.json`
   - `health-monitoring-extended.json`
4. Review imported nodes → **Import**

### Step 3: Configure Workflow Credentials

For each workflow, check credential requirements:

#### telegram-error-handler.json

1. Find nodes: "Telegram Webhook", "Escalate to JEPO", "Notify Recovery Success"
2. In each HTTP node, update Telegram API headers:
   ```
   URL: https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage
   ```
3. Verify webhook path: `POST /telegram-error-handler`

SSH Execute nodes:
- Verify SSH command syntax for your environment
- Test: Run workflow manually → check SSH logs on DO server

#### oos-validation-pipeline.json

1. Verify Cron: `0 9 * * 0` (Sunday 09:00 UTC)
2. Adjust OOS start date if needed:
   ```javascript
   const suspensionDate = new Date('2026-03-09T00:00:00Z');  // ← Edit if needed
   ```
3. PRUVIQ API endpoint: `https://api.pruviq.com/simulate`
   - No auth required (public endpoint)
   - Test response: curl
     ```bash
     curl -X POST https://api.pruviq.com/simulate \
       -H "Content-Type: application/json" \
       -d '{"strategy":"bb-squeeze","direction":"short","sl_pct":10,"tp_pct":8,"date_range_days":90}'
     ```

#### health-monitoring-extended.json

1. Verify schedule: Every 30 minutes
2. Three health check endpoints (all public, no auth):
   - `https://api.pruviq.com/rankings/daily`
   - `https://api.pruviq.com/health`
   - `https://api.pruviq.com/simulate` (POST)
3. Alert destination: `TELEGRAM_CHAT_ID` (via env)

### Step 4: Activate Workflows

1. For each workflow: **Toggle to ON** (top-right)
2. Optional: Set "immediately" trigger for manual testing
3. Monitor: Check execution logs for first run

---

## Part 3: Credential Details & References

### Telegram Bot Integration

**PRUVIQ Alert Bot** (8057086954):

```bash
# Find token in environment
grep -i telegram ~/.env | head -2

# Get chat ID (if unknown)
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" | jq '.result[0].message.chat.id'
```

**n8n Telegram node setup**:
- Node type: HTTP Request (POST)
- URL: `https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage`
- Body parameters:
  - `chat_id` = `{{ $env.TELEGRAM_CHAT_ID }}`
  - `text` = Markdown formatted message
  - `parse_mode` = "Markdown"

### SSH / DO Server

**Connection details**:
```
Host: 167.172.81.145
Port: 2222
User: root
Key: ~/.ssh/id_rsa (or configure SSH credentials in n8n)
```

**Embedded SSH commands in workflows**:

Error Handler workflow includes:
- `launchctl bootout` (restart LaunchAgent)
- `logrotate` (force log rotation)
- Service health checks

**Security note**: SSH commands are executed as-is. Test locally first:
```bash
ssh -p 2222 root@167.172.81.145 'echo "Test connection OK"'
```

### n8n REST API

**Purpose**: Retry failed workflow executions

```bash
# Get API key (n8n settings → API section)
curl -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  http://localhost:5678/api/v1/workflows

# List recent executions
curl -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  http://localhost:5678/api/v1/executions?status=error&limit=10
```

### PRUVIQ API

All endpoints are **public** (no authentication):

```bash
# Rankings (returns top coins by strategy)
curl https://api.pruviq.com/rankings/daily | jq '.data | length'

# Health check
curl https://api.pruviq.com/health | jq '.status'

# Simulate strategy (POST)
curl -X POST https://api.pruviq.com/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "bb-squeeze",
    "direction": "short",
    "sl_pct": 10,
    "tp_pct": 8,
    "date_range_days": 90
  }' | jq '.profit_factor, .win_rate'
```

### Mem0 Cloud Integration

**Purpose**: Store error patterns and health check results

- Status: Integrated via MCP (`mem0-mcp` in `~/.claude/settings.json`)
- Metadata structure:
  ```json
  {
    "type": "error_pattern|oos_validation|health_check",
    "project": "pruviq|autotrader",
    "timestamp": "2026-03-14T12:30:00Z",
    "severity": "critical|high|medium|low",
    "evidence": "description"
  }
  ```
- Workflows include "Save to Mem0" code nodes for pattern storage

---

## Part 4: Testing & Validation

### Test 1: telegram-error-handler.json

**Manual trigger** (simulate error webhook):

```bash
# Option 1: Use n8n UI → Test the webhook manually
curl -X POST http://localhost:5678/webhook/telegram-error-handler \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "text": "🚨 LaunchAgent com.pruviq.monitor crashed",
      "chat": {"id": 1234567890},
      "message_id": 999
    }
  }'

# Option 2: Trigger via actual Telegram bot message
# Send message to PRUVIQ Alert bot → n8n webhook receives it
```

**Expected behavior**:
1. Message parsed → error type classified
2. Route to appropriate handler (LaunchAgent, n8n timeout, log rotation, etc.)
3. SSH command executed on DO server
4. Recovery status → Telegram notification
5. Pattern saved to Mem0

**Validation points**:
- [ ] Error type correctly classified (check "Parse Message" node output)
- [ ] SSH command executed successfully (check exit code = 0)
- [ ] Telegram notification received with recovery details
- [ ] Mem0 entry created (verify via Mem0 API or logs)

### Test 2: oos-validation-pipeline.json

**Manual trigger** (even if not Sunday):

```bash
# In n8n UI: Open workflow → click "Execute Workflow" → Test
```

**Check outputs**:
1. **Calculate OOS Days** node:
   - `daysElapsed` should match current date - 2026-03-09
   - `oosComplete` should be `false` (as of 2026-03-14, only 5 days)

2. **Fetch PRUVIQ Metrics** node:
   - Response includes `profit_factor`, `win_rate`, `max_drawdown_pct`, `total_trades`, etc.

3. **Validate OOS Criteria** node:
   - Outputs 8 criteria checks with actual vs target
   - `readinessScore` calculation (currently ~13% - well under 90 days)

4. **Telegram notification**:
   - Shows current OOS progress
   - Example: "Days Elapsed: 5/90 days, Remaining: 85 days, Completion: 5%"

**Validation checklist**:
- [ ] OOS days calculated correctly
- [ ] PRUVIQ API call succeeds (metrics returned)
- [ ] 8 criteria evaluated (even if most fail due to < 90 days)
- [ ] Notification sent with correct progress percentage
- [ ] Mem0 record created with readiness score

### Test 3: health-monitoring-extended.json

**Manual trigger**:

```bash
# In n8n UI: Execute Workflow
```

**Expected results**:
1. **Check Rankings API** → 500+ coins returned
2. **Check Health Endpoint** → `status: "ok"` or `"healthy"`
3. **Check Simulate Endpoint** → Valid metrics (PF, WR, etc.)
4. **Aggregate Results** → `overallStatus: "HEALTHY"` if all 3 pass
5. **Telegram notification** → ✅ or ⚠️ depending on results
6. **Mem0 entry** → Health check pattern logged

**Validation checklist**:
- [ ] All three API endpoints respond within 15s timeout
- [ ] Rankings data has >= 500 coins (valid dataset)
- [ ] Health endpoint returns status = ok/healthy
- [ ] Simulator returns valid backtest metrics
- [ ] Aggregate result = HEALTHY (if all pass)
- [ ] Mem0 logs health pattern with severity level

---

## Part 5: Configuration Deep Dive

### Error Handler Deduplication

Current implementation uses placeholder logic. To enable full deduplication:

1. **Option A**: Use Mem0 MCP directly (recommended)
   - Call Mem0 API to check error hash frequency
   - Increment counter if same error occurs 3+ times in 60 minutes
   - Auto-processing → manual escalation after threshold

2. **Option B**: Use n8n Variables
   - Store error hashes in n8n global variables
   - Check frequency before routing
   - Manual reset weekly

**Edit** `Check Deduplication` node to call Mem0 API:

```javascript
// Pseudo-code (replace placeholder logic)
const errorHash = $json.errorHash;
const memoryResult = await queryMem0(
  `error hash: ${errorHash} in last 60 minutes`
);
const frequency = memoryResult.count || 0;

if (frequency >= 3) {
  return {
    shouldAutoProcess: false,  // ← Escalate instead
    reason: `Same error seen ${frequency} times in 1h`
  };
}
```

### OOS Validation Criteria Adjustments

Modify `Validate OOS Criteria` node to adjust target values:

```javascript
const criteria = {
  profitFactor: { target: 1.5, ... },      // ← Adjust if needed
  winRate: { target: 45, ... },            // ← %
  maxDD: { target: 15, ... },              // ← %
  totalTrades: { target: 150, ... },       // ← absolute count
  sharpe: { target: 1.0, ... },            // ← ratio
  maxConsecutiveLosses: { target: 8, ... }, // ← count
  oosDays: { target: 90, ... }             // ← days (don't change)
};
```

**Readiness tiers**:
- 8/8 criteria → Ready (Green)
- 6-7/8 criteria → Monitoring (Yellow)
- <6 criteria → Revision needed (Red)

---

## Part 6: Monitoring & Maintenance

### Weekly Checks

```bash
# Check n8n execution history
curl -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  http://localhost:5678/api/v1/executions \
  | jq '.executions[] | {workflow: .workflowName, status: .status, finished: .finished}' | head -20

# Verify launchd services
launchctl list | grep -i "pruviq\|n8n"

# Check DO server health
ssh -p 2222 root@167.172.81.145 "uptime && df -h /var/log"
```

### Mem0 Pattern Analysis

```bash
# Query Mem0 for error patterns (via Mem0 dashboard or API)
# Filter: type=error_pattern, project=pruviq
# Identify recurring issues → adjust auto-recovery logic
```

### n8n Logs

```bash
# Mac Mini n8n logs
tail -f ~/logs/n8n-stdout.log
tail -f ~/logs/n8n-stderr.log

# Check DO server for SSH command execution logs
ssh -p 2222 root@167.172.81.145 "tail -f /var/log/auth.log | grep ssh"
```

---

## Part 7: Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook doesn't trigger | PRUVIQ Alert bot token invalid | Verify `TELEGRAM_BOT_TOKEN` in ~/.env, get fresh webhook URL from n8n |
| SSH commands fail (exit 1) | Key auth issue or command syntax | Test SSH locally: `ssh -p 2222 root@167.172.81.145 'uptime'` |
| PRUVIQ API returns 403 | Cloudflare blocking request | Check CF Tunnel status: `cloudflared tunnel info` |
| OOS validation stuck at 0% | Wrong suspension date hardcoded | Edit "Calculate OOS Days" node: `const suspensionDate = new Date('YYYY-MM-DD')` |
| Health check always fails | API endpoints down | Test: `curl https://api.pruviq.com/health -v` |
| Mem0 not storing patterns | MCP not configured | Verify n8n MCP in `~/.claude/settings.json` |

---

## Part 8: Integration with JEPO System

### MCP Connection

These workflows integrate with JEPO's Mem0 MCP:

- `mem0-mcp`: Store error patterns, health snapshots, OOS validation results
- Tagged with `project: pruviq` or `project: autotrader`
- Queryable via Mem0 API for pattern analysis

### Telegram Automation

- PRUVIQ Alert bot (8057086954) is **read-only** for alerts
- Webhook handler receives messages → parses → routes
- No manual Telegram commands needed (fully automated)

### Compliance with JEPO Rules

- ✅ All credentials via environment variables (no hardcoding)
- ✅ Evidence-based storage in Mem0 (type, timestamp, metadata)
- ✅ Error handling with graceful fallback (continueOnFail: true)
- ✅ Timeout settings (15-30s per endpoint)
- ✅ Logging of all critical operations (SSH, API calls)

---

## Appendix: JSON Node Reference

### Common n8n Node Types Used

| Type | Used In | Purpose |
|------|---------|---------|
| `scheduleTrigger` | All 3 workflows | Cron-based scheduling |
| `webhook` | error-handler | Receive Telegram updates |
| `httpRequest` | All | HTTP API calls (Telegram, PRUVIQ, n8n) |
| `code` (javaScript) | All | Data parsing, validation, aggregation |
| `switch` | error-handler, oos-validator | Conditional routing |
| `if` | oos-validator, health-monitor | Boolean decision gates |
| `executeCommand` | error-handler | SSH execution on DO server |
| `noOp` | All | Null branch (success path) |

### Environment Variable Reference

```bash
# Required
TELEGRAM_BOT_TOKEN       # PRUVIQ Alert bot token
TELEGRAM_CHAT_ID         # Chat ID with bot

# n8n API
N8N_API_KEY              # For n8n REST API calls

# Optional (can be hardcoded in workflows if preferred)
SSH_HOST                 # 167.172.81.145
SSH_PORT                 # 2222
MEM0_API_KEY             # For direct Mem0 MCP calls
```

---

## References

- **n8n Docs**: https://docs.n8n.io
- **PRUVIQ API**: https://api.pruviq.com
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **JEPO v0.11.1**: See `~/.claude/CLAUDE.md` for system architecture
- **Error Handler Logic**: See `telegram-error-handler.json` nodes
- **OOS Criteria**: See `oos-validation-pipeline.json` validation logic
- **Health Checks**: See `health-monitoring-extended.json` aggregate results

---

**Last Updated**: 2026-03-14
**Status**: Ready for import and testing
