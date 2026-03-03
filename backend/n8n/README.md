# PRUVIQ n8n Automation Workflows

Automated data pipeline, monitoring, and content generation for PRUVIQ.

## Architecture

```
┌─ Cron (fallback) ──────────────────────┐
│  02:30 UTC  full_pipeline.sh           │
│  */5 min    monitor.sh                 │
│  hourly     monitor.sh --full          │
│  06:00 UTC  daily_report.sh            │
└────────────────────────────────────────┘

┌─ n8n (preferred) ─────────────────────┐
│  data-sync-workflow.json    (daily)   │
│  monitoring-workflow.json   (5 min)   │
│  daily-report-workflow.json (daily)   │
│  weekly-review-workflow.json (weekly) │
└───────────────────────────────────────┘

┌─ Services ────────────────────────────┐
│  PRUVIQ API     localhost:8080        │
│  n8n            localhost:5678        │
│  Ollama         localhost:11434       │
│  CF Tunnel      api.pruviq.com        │
└───────────────────────────────────────┘
```

## Workflows

### 1. Data Sync (`data-sync-workflow.json`)
- **Schedule**: Daily 02:30 UTC
- **Steps**: Update OHLCV → Regenerate demo data → Reload API → Git push → Health check
- **Shell fallback**: `full_pipeline.sh` (crontab)

### 2. Monitoring (`monitoring-workflow.json`)
- **Schedule**: Every 5 minutes
- **Checks**: API health, response time
- **Full check (hourly)**: + pruviq.com, api.pruviq.com, CF Tunnel, disk
- **Alerts**: Telegram (30 min cooldown)
- **Shell fallback**: `monitor.sh` / `monitor.sh --full`

### 3. Daily Market Report (`daily-report-workflow.json`)
- **Schedule**: Daily 06:00 UTC
- **Data**: BTC/ETH price (Binance), Fear & Greed Index, PRUVIQ simulation
- **Generation**: Ollama qwen2.5:32b
- **Fact check**: Automated price/stats verification
- **Output**: ~/pruviq-reports/YYYY-MM-DD.md (human review required)
- **Shell fallback**: `daily_report.sh`

### 4. Weekly Review (`weekly-review-workflow.json`)
- **Schedule**: Monday 03:00 UTC
- **Content**: Weekly market recap + strategy performance
- **Generation**: Ollama qwen2.5:32b with fact check gate

## Setup

### Prerequisites
- [x] n8n running on Mac Mini (port 5678)
- [x] Ollama with qwen2.5:32b (port 11434)
- [x] PRUVIQ API running (port 8080)
- [ ] Telegram bot token + chat ID

### Step 1: Telegram Bot Setup
1. Create bot: https://t.me/BotFather → /newbot
2. Get chat_id: send message to bot, then visit:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Create .env: `cp backend/.env.example backend/.env`
4. Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

### Step 2: Import n8n Workflows
1. Open n8n at http://localhost:5678
2. Settings → Import from file
3. Import each JSON file from this directory
4. Set n8n environment variables:
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
5. Activate workflows

### Step 3: Verify
```bash
# Test monitoring
./backend/scripts/monitor.sh --full

# Test pipeline (dry run)
./backend/scripts/full_pipeline.sh

# Test daily report
./backend/scripts/daily_report.sh
```

## Hallucination Prevention Rules

1. **Data-only claims**: All numbers must come from API responses
2. **No price predictions**: LLM must not forecast future prices
3. **Source citation**: Every stat must reference its data source
4. **Fact check gate**: Content blocked if fact check fails
5. **Human review**: All content requires manual approval before publishing
6. **Disclaimer required**: "Not financial advice" on every report

## File Structure

```
backend/
├── scripts/
│   ├── full_pipeline.sh     # Data sync + git push + deploy
│   ├── monitor.sh           # Health monitoring + alerts
│   ├── daily_report.sh      # Ollama market report gen
│   ├── update_ohlcv.py      # Binance OHLCV fetcher
│   ├── generate_demo_data.py # Demo data for frontend
│   └── update_data.sh       # Incremental data update
├── n8n/
│   ├── README.md            # This file
│   ├── data-sync-workflow.json
│   ├── monitoring-workflow.json
│   ├── daily-report-workflow.json
│   └── weekly-review-workflow.json
└── .env.example             # Environment template
```
