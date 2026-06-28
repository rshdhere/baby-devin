#!/usr/bin/env bash
# Point execution host scheduler(s) at the staging orchestrator internal NLB.
#
# Prerequisites:
#   - kubectl configured for the EKS cluster
#   - devin-staging/devin-orchestrator-lb Service synced (GitOps)
#   - AWS CLI with ssm:PutParameter + ssm:SendCommand on execution hosts
#
# Usage:
#   ./infra/scripts/sync-staging-orchestrator-url.sh
#   AWS_REGION=ap-south-1 SSM_PREFIX=/devin-production/platform ./infra/scripts/sync-staging-orchestrator-url.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-ap-south-1}"
SSM_PREFIX="${SSM_PREFIX:-/devin-production/platform}"
STAGING_NAMESPACE="${STAGING_NAMESPACE:-devin-staging}"
LB_SERVICE="${LB_SERVICE:-devin-orchestrator-lb}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-9090}"
WAIT_SECONDS="${WAIT_SECONDS:-120}"

log() { printf '%s\n' "$*"; }

wait_for_nlb_hostname() {
  local hostname=""
  local elapsed=0
  while (( elapsed < WAIT_SECONDS )); do
    hostname="$(kubectl -n "$STAGING_NAMESPACE" get svc "$LB_SERVICE" \
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
    if [[ -n "$hostname" ]]; then
      printf '%s' "$hostname"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  log "Timed out waiting for ${STAGING_NAMESPACE}/${LB_SERVICE} LoadBalancer hostname" >&2
  kubectl -n "$STAGING_NAMESPACE" get svc "$LB_SERVICE" -o wide >&2 || true
  return 1
}

verify_orchestrator_create() {
  local base_url="$1"
  local code
  code="$(kubectl run devin-orch-verify --rm -i --restart=Never \
    -n "$STAGING_NAMESPACE" --image=curlimages/curl:latest --command -- sh -c \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '${base_url}/internal/v1/sandboxes' \
      -H 'Content-Type: application/json' \
      --data-raw '{\"name\":\"ssm-sync-verify-$(date +%s)\",\"spec\":{\"taskId\":\"ssm-verify\",\"runtime\":\"nextjs\",\"cpu\":2,\"memory\":\"4Gi\"}}'" \
    2>/dev/null | tail -1)"
  if [[ "$code" != "202" && "$code" != "409" ]]; then
    log "Warning: POST ${base_url}/internal/v1/sandboxes returned HTTP ${code} (expected 202)" >&2
    return 1
  fi
  log "Verified sandbox create via staging NLB (HTTP ${code})"
}

main() {
  log "Waiting for ${STAGING_NAMESPACE}/${LB_SERVICE} internal NLB..."
  local hostname
  hostname="$(wait_for_nlb_hostname)"
  local orchestrator_url="http://${hostname}:${ORCHESTRATOR_PORT}"
  log "Staging orchestrator URL: ${orchestrator_url}"

  verify_orchestrator_create "$orchestrator_url" || true

  local param_name="${SSM_PREFIX}/orchestrator_url"
  log "Writing SSM parameter ${param_name}"
  aws ssm put-parameter \
    --region "$AWS_REGION" \
    --name "$param_name" \
    --type String \
    --value "$orchestrator_url" \
    --overwrite

  if [[ -x "${ROOT}/scripts/sync-execution-host-config.sh" ]] \
    && terraform -chdir="$ROOT" output -json execution_hosts >/dev/null 2>&1; then
    local instance_id
    instance_id="$(terraform -chdir="$ROOT" output -json execution_hosts | jq -r '.["fc-01"].instance_id')"
    if [[ -n "$instance_id" && "$instance_id" != "null" ]]; then
      log "Syncing execution host ${instance_id} via SSM..."
      "${ROOT}/scripts/sync-execution-host-config.sh" "$instance_id" "$AWS_REGION" "$SSM_PREFIX"
    fi
  fi

  log "Done. Retry a task on https://staging.devin.baby"
  log "Confirm on host: docker inspect scheduler --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ORCHESTRATOR_URL"
}

main "$@"
