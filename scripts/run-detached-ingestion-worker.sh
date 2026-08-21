#!/usr/bin/env bash
# Detached ingestion-worker launcher for local dev verification.
# Usage: setsid nohup bash scripts/run-detached-ingestion-worker.sh &
set -euo pipefail
cd /mnt/d/study/git/study-planner-web
exec node scripts/dev-ingestion-worker.mjs >> /mnt/d/study/git/study-planner-web/.dev/full-app/logs/ingestion-worker.log 2>&1
