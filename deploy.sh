#!/usr/bin/env bash
# ==============================================================================
# KO Broker Platform — Production Deployment Script
# ==============================================================================
# Usage:
#   ./deploy.sh [--skip-migrations] [--skip-build] [--check-health-only]
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}               KO BROKER PLATFORM — PRODUCTION DEPLOYMENT           ${NC}"
echo -e "${BLUE}====================================================================${NC}"

# ── 1. Parse Arguments ─────────────────────────────────────────────────────────
SKIP_MIGRATIONS=false
SKIP_BUILD=false
HEALTH_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --check-health-only)
      HEALTH_ONLY=true
      shift
      ;;
    *)
      ;;
  esac
done

# ── 2. Environment Verification ────────────────────────────────────────────────
if [ -f ".env" ]; then
  echo -e "${GREEN}✓ Found root .env file${NC}"
  set -a
  source .env
  set +a
elif [ -f "apps/web/.env.local" ]; then
  echo -e "${YELLOW}! Using apps/web/.env.local${NC}"
  set -a
  source apps/web/.env.local
  set +a
else
  echo -e "${RED}✗ Error: Neither .env nor apps/web/.env.local found!${NC}"
  exit 1
fi

# Required variables check
REQUIRED_VARS=(
  "DATABASE_URL"
  "CLERK_SECRET_KEY"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
)

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR:-}" ]; then
    echo -e "${RED}✗ Missing required environment variable: $VAR${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✓ Core environment variables verified.${NC}"

# Check CRON_SECRET
if [ -z "${CRON_SECRET:-}" ]; then
  echo -e "${YELLOW}! WARNING: CRON_SECRET is not set. In production, cron endpoints will return 503 Service Unavailable.${NC}"
else
  echo -e "${GREEN}✓ CRON_SECRET is configured.${NC}"
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3001}"

# ── 3. Health Check Only Mode ──────────────────────────────────────────────────
if [ "$HEALTH_ONLY" = true ]; then
  echo -e "\n${BLUE}── Running Health Checks on $APP_URL ──${NC}"
  if [ -n "${CRON_SECRET:-}" ]; then
    echo -e "Testing /api/cron/intelligence-rates..."
    curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/intelligence-rates" | grep -q "ok" && \
      echo -e "${GREEN}✓ BoE Rates Ingest Cron is healthy${NC}" || echo -e "${RED}✗ BoE Rates Ingest Cron failed${NC}"

    echo -e "Testing /api/cron/intelligence-prices..."
    curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/intelligence-prices" | grep -q "ok" && \
      echo -e "${GREEN}✓ HMLR Prices Ingest Cron is healthy${NC}" || echo -e "${RED}✗ HMLR Prices Ingest Cron failed${NC}"
  fi
  exit 0
fi

# ── 4. Apply Database Migrations ───────────────────────────────────────────────
if [ "$SKIP_MIGRATIONS" = false ]; then
  echo -e "\n${BLUE}── Step 1: Applying Database Migrations (Supabase) ──${NC}"
  pnpm db:generate
  pnpm db:migrate:deploy
  echo -e "${GREEN}✓ Database migrations successfully applied.${NC}"
else
  echo -e "\n${YELLOW}! Skipping database migrations (--skip-migrations)${NC}"
fi

# ── 5. Build Web Application ───────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo -e "\n${BLUE}── Step 2: Building Application Bundles ──${NC}"
  pnpm --filter @ko/web build
  echo -e "${GREEN}✓ Application build complete.${NC}"
else
  echo -e "\n${YELLOW}! Skipping application build (--skip-build)${NC}"
fi

# ── 6. Summary and Run Instructions ────────────────────────────────────────────
echo -e "\n${BLUE}====================================================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT PREPARATION FINISHED SUCCESSFULLY!${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "To start the production service, run:"
echo -e "  ${YELLOW}pnpm --filter @ko/web start${NC}   (or restart systemd/docker)"
echo -e "\nTo verify the live deployment:"
echo -e "  ${YELLOW}./deploy.sh --check-health-only${NC}"
echo -e "${BLUE}====================================================================${NC}\n"
