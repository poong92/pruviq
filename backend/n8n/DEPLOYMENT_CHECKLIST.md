# n8n Workflows - Quick Deployment Checklist

**Status**: Ready for production deployment
**Date**: 2026-03-14
**Workflows**: 3 (error handler, OOS validator, health monitor)

---

## Pre-Deployment (30 min)

### Step 1: Prepare Environment
- [ ] Verify n8n running: `curl http://localhost:5678`
- [ ] Check ~/.env has TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
- [ ] Get n8n API key from n8n UI Settings → API section
- [ ] Store in ~/.env as N8N_API_KEY
- [ ] Test SSH: `ssh -p 2222 root@167.172.81.145 'uptime'`
- [ ] Test PRUVIQ API: `curl https://api.pruviq.com/health`

### Step 2: Review Documentation (5 min)
- [ ] Skim WORKFLOWS_SUMMARY.md (quick overview)
- [ ] Mark page 1 of SETUP_GUIDE.md for reference

### Step 3: Import Workflows to n8n (10 min)
1. Open n8n: http://localhost:5678
2. Go to "Workflows" tab
3. Click "Import from file"
4. Select `/Users/jepo/pruviq/backend/n8n/telegram-error-handler.json`
5. Review nodes → Click "Import"
6. Repeat for `oos-validation-pipeline.json`
7. Repeat for `health-monitoring-extended.json`

---

## Testing (20 min)

### Test 1: telegram-error-handler
```bash
# In n8n UI:
# 1. Open "Telegram Error Handler" workflow
# 2. Click "Execute Workflow" button
# 3. Should show nodes executing
# 4. Check logs for errors

# Optional: Manual webhook test
curl -X POST http://localhost:5678/webhook/telegram-error-handler \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"🚨 Test LaunchAgent crash"}}'
```

**Expected**: Workflow executes, no errors in logs, Telegram notification sent (optional)

### Test 2: oos-validation-pipeline
```bash
# In n8n UI:
# 1. Open "OOS Validation Pipeline" workflow
# 2. Click "Execute Workflow" button
# 3. Check "Calculate OOS Days" node output
# 4. Should show: daysElapsed: 5, oosComplete: false
# 5. Check logs for success
```

**Expected**: Shows 5/90 days OOS, sends progress Telegram (optional)

### Test 3: health-monitoring-extended
```bash
# In n8n UI:
# 1. Open "Extended Health Monitoring" workflow
# 2. Click "Execute Workflow" button
# 3. Check node outputs
# 4. All 3 API checks should pass (green)
# 5. Aggregate should show "HEALTHY"
```

**Expected**: All health checks pass, no alert sent

---

## Activation (5 min)

### Enable Workflows
1. Open each workflow in n8n
2. Look at top-right corner for toggle switch
3. Toggle to ON (blue/enabled state)
4. Repeat for all 3 workflows

### Verify Schedule Activation
- telegram-error-handler: Webhook (no schedule)
- oos-validation-pipeline: Should show "Sun 09:00 UTC"
- health-monitoring-extended: Should show "Every 30 minutes"

---

## Monitoring (1 hour post-activation)

### Check Execution Logs
```bash
# Monitor n8n logs
tail -f ~/logs/n8n-stdout.log | grep -i "workflow\|execute"

# Check n8n execution history
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  http://localhost:5678/api/v1/executions | jq '.executions[0:5]'
```

### Expected Behavior
- **telegram-error-handler**: Idle until webhook triggered (no automatic runs)
- **oos-validation-pipeline**: Runs next Sunday 09:00 UTC (scheduled)
- **health-monitoring-extended**: Runs in 30 min (or immediately if just activated)

### Verify First Run Success
- [ ] health-monitoring runs every 30 min (check after 30 min)
- [ ] OOS validator scheduled for next Sunday
- [ ] Error handler webhook path active in n8n

---

## Post-Deployment

### Daily Checks
- [ ] Monitor n8n execution count: `curl -H "X-N8N-API-KEY: ..." http://localhost:5678/api/v1/executions | jq '.totalPages'`
- [ ] Check for error patterns in logs

### Weekly Checks
- [ ] Review Sunday OOS validation results
- [ ] Analyze 1-week health check history
- [ ] Check Mem0 for error patterns

### Monthly Checks
- [ ] Review OOS progress toward 90-day mark
- [ ] Analyze error handler triggers (if any)
- [ ] Update custom criteria if needed

---

## Credentials Used

| Credential | Source | Used By | Notes |
|------------|--------|---------|-------|
| TELEGRAM_BOT_TOKEN | ~/.env | All 3 workflows | PRUVIQ Alert bot (8057086954) |
| TELEGRAM_CHAT_ID | ~/.env | All 3 workflows | Chat ID for alerts |
| N8N_API_KEY | n8n Settings | error-handler | For retry logic |
| SSH keys | ~/.ssh/ | error-handler | Embedded in SSH commands (not in workflow) |

---

## Quick Reference

### Workflow Triggers
```
telegram-error-handler    → Webhook (POST /telegram-error-handler)
oos-validation-pipeline   → Cron: 0 9 * * 0 (Sunday 09:00 UTC)
health-monitoring-extended → Cron: */30 * * * * (Every 30 minutes)
```

### Expected Execution Times
```
telegram-error-handler:     3-8 seconds
oos-validation-pipeline:    5-20 seconds
health-monitoring-extended: 2-5 seconds
```

### Failure Handling
```
All HTTP calls:    continueOnFail = true
All SSH commands:  timeout 10s, continueOnFail = true
Cascading alerts:  Send Telegram if recovery fails
```

---

## Support

**Issue**: Webhook not triggering
→ Check: TELEGRAM_BOT_TOKEN valid? n8n webhook path correct?

**Issue**: PRUVIQ API timeout
→ Check: API endpoint accessible? `curl https://api.pruviq.com/health`

**Issue**: SSH commands fail
→ Check: SSH key loaded? `ssh -p 2222 root@167.172.81.145 'echo ok'`

**Issue**: Telegram not sending
→ Check: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in ~/.env?

**For detailed help**: See SETUP_GUIDE.md section "Troubleshooting" (pages 14-15)

---

**Estimated Total Time**: 1 hour (30 min prep + 20 min testing + 5 min activation + 5 min observation)

**Status After Deployment**: All 3 workflows operational, automatic execution enabled

Good luck! 🚀
