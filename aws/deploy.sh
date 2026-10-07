#!/usr/bin/env bash
# One-time setup (and later updates) from AWS CloudShell in us-east-1:
#   git clone https://github.com/emitroo/EBriscola && cd EBriscola && bash aws/deploy.sh
# Upload settlers.ebdeck to CloudShell first (Actions -> Upload file) to publish the photo pack too.
set -euo pipefail
cd "$(dirname "$0")/.."
export AWS_DEFAULT_REGION=us-east-1
STACK="${STACK:-ebriscola}"
PACK_FILE="${PACK_FILE:-$HOME/settlers.ebdeck}"

read -rp 'Email for alarms and cut-off notices: ' EMAIL
read -rsp 'Photo pack code (not stored; only a hash of a derived token is): ' CODE; echo
HASH="$(node tools/pack-token.mjs "$CODE")"
unset CODE
OIDC=true
if aws iam list-open-id-connect-providers --output text | grep -q token.actions.githubusercontent.com; then OIDC=false; fi

aws cloudformation deploy --stack-name "$STACK" --template-file aws/template.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides AlertEmail="$EMAIL" PackTokenHash="$HASH" CreateGitHubOidcProvider="$OIDC" --no-fail-on-empty-changeset

out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
bash aws/upload-site.sh "$(out SiteBucketName)" "$(out DistributionId)"

if [ -f "$PACK_FILE" ]; then
  aws s3 cp "$PACK_FILE" "s3://$(out PackBucketName)/settlers.ebdeck"
  echo "Photo pack uploaded. Delete it from CloudShell:  rm '$PACK_FILE'"
else
  echo "No pack at $PACK_FILE: upload it later with  aws s3 cp settlers.ebdeck s3://$(out PackBucketName)/settlers.ebdeck"
fi

cat <<MSG

Done. Confirm the two "AWS Notification - Subscription Confirmation" emails sent to $EMAIL.

  App on AWS:        $(out SiteUrl)
  Pack server:       $(out PackApi)

For automatic deploys, add these as GitHub repository *variables* (Settings -> Secrets and variables -> Actions -> Variables):
  AWS_DEPLOY_ROLE_ARN   $(out DeployRoleArn)
  AWS_SITE_BUCKET       $(out SiteBucketName)
  AWS_DISTRIBUTION_ID   $(out DistributionId)
MSG
