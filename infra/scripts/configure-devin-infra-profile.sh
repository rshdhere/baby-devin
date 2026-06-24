#!/usr/bin/env bash
# Configure the devin-infra AWS CLI profile (run once after creating the IAM user).
set -euo pipefail

PROFILE="devin-infra"
REGION="${AWS_REGION:-ap-south-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="${SCRIPT_DIR}/../devin-infra.credentials"

if aws configure list-profiles 2>/dev/null | grep -qx "${PROFILE}"; then
  echo "Profile [${PROFILE}] is already configured."
  AWS_PROFILE="${PROFILE}" aws sts get-caller-identity
  exit 0
fi

ACCESS_KEY_ID="${DEVIN_INFRA_AWS_ACCESS_KEY_ID:-}"
SECRET_ACCESS_KEY="${DEVIN_INFRA_AWS_SECRET_ACCESS_KEY:-}"

if [[ -f "${CREDS_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CREDS_FILE}"
  ACCESS_KEY_ID="${DEVIN_INFRA_AWS_ACCESS_KEY_ID:-${ACCESS_KEY_ID}}"
  SECRET_ACCESS_KEY="${DEVIN_INFRA_AWS_SECRET_ACCESS_KEY:-${SECRET_ACCESS_KEY}}"
fi

if [[ -z "${ACCESS_KEY_ID}" || -z "${SECRET_ACCESS_KEY}" ]]; then
  cat >&2 <<EOF
Profile [${PROFILE}] is not configured.

Option A — interactive (recommended):
  aws configure --profile ${PROFILE}
  # Access key + secret from: aws iam create-access-key --user-name devin-infra
  # Region: ${REGION}

Option B — env vars, then re-run this script:
  export DEVIN_INFRA_AWS_ACCESS_KEY_ID=AKIA...
  export DEVIN_INFRA_AWS_SECRET_ACCESS_KEY=...

Option C — copy devin-infra.credentials.example to devin-infra.credentials, fill in, re-run.

Option D — use default credentials for now:
  unset AWS_PROFILE
  terraform apply
EOF
  exit 1
fi

aws configure set aws_access_key_id "${ACCESS_KEY_ID}" --profile "${PROFILE}"
aws configure set aws_secret_access_key "${SECRET_ACCESS_KEY}" --profile "${PROFILE}"
aws configure set region "${REGION}" --profile "${PROFILE}"
aws configure set output json --profile "${PROFILE}"

echo "Configured AWS profile [${PROFILE}]."
AWS_PROFILE="${PROFILE}" aws sts get-caller-identity
