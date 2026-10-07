# EBriscola on AWS

A second home for the app, next to GitHub Pages (which keeps working unchanged). Everything is one CloudFormation
stack in `us-east-1`, sized to stay inside AWS's always-free allowances, with alarms that email you and a cut-off
switch that shuts the AWS copy down before it can cost money.

```
phone ──HTTPS──► CloudFront ──(origin access control)──► S3 bucket: the app (private)
                    │  security headers, HTTPS only
                    └─ /api/pack ──(signed by CloudFront)──► Lambda: checks code token + rate limit ──► S3: encrypted pack (private)
                                                                         └─ DynamoDB: attempt counters (auto-expire)
CloudWatch alarms + monthly budget ──► SNS ──► email
                                        └──► cut-off Lambda: pack function to 0, CloudFront distribution disabled
GitHub Actions ──(OIDC, short-lived role)──► S3 upload + CloudFront refresh
```

## What it adds over GitHub Pages

- **Unlock with just the code.** The phone derives a token from the code (PBKDF2, 250k rounds) and sends that; the
  server stores only a SHA-256 of the token and returns the encrypted pack on a match. Neither the code nor the
  decryption key ever reaches AWS, so even someone with full access to the AWS account sees only ciphertext.
  The GitHub Pages copy can use the same server (CORS is open to `https://emitroo.github.io` only).
- **No offline guessing.** Without the code nobody can download the encrypted pack at all. Guesses are limited to
  10 per IP per 10 minutes and 300 a day in total; when the counter table is unavailable it refuses (fails closed).
- **Locked-down hosting.** Both buckets are private (block public access, owner-enforced, encrypted, TLS-only); only
  this CloudFront distribution can read the app bucket, and only CloudFront can call the function (IAM-authenticated
  function URL). Responses carry HSTS, a strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer` and a Permissions-Policy allowing only the camera (for QR pairing).
- **No AWS keys in GitHub.** Deploys use GitHub's OIDC token to assume a role that can only upload to the app
  bucket and refresh CloudFront, and only from this repo's deploy branch.

## Free allowances, alarms and cut-offs

| Service | Always-free allowance | Warning email | Automatic cut-off |
| --- | --- | --- | --- |
| CloudFront requests | 10M / month | > 5,000 in an hour | > 20,000 in an hour, or > 300,000 in a day |
| CloudFront data out | 1 TB / month | > 500 MB in an hour | > 30 GB in a day |
| Lambda (pack endpoint) | 1M requests / month | 5+ errors in an hour | > 300 calls in an hour |
| Whole account cost (before credits) | n/a | > $0.50 actual, or forecast > $1 | > $1 actual this month |
| DynamoDB | 25 read / 25 write units | n/a | fixed at 1 read / 5 write units, so it can't grow |

A normal games night is a few hundred requests and a few MB. The cut-off disables the CloudFront distribution and
sets the pack function's concurrency to 0; GitHub Pages is unaffected, so the game stays playable there. You get an
email naming the alarm. To turn AWS back on: `bash aws/reenable.sh` in CloudShell.

Things that are not literally free, and why they stay at ~$0: S3 storage and requests (a few MB, and CloudFront
caches the app, so S3 sees a handful of requests a day: fractions of a cent), and CloudWatch Logs (14-day
retention, well inside the 5 GB free). The budget counts cost **before** credits (`IncludeCredit: false`), so it
works while sign-up credits would otherwise hide the bill. Budget figures update a few times a day, so the
CloudWatch alarms are the fast cut-off and the budget is the slow backstop. Seven alarms and one budget are
inside the free 10 alarms and 2 budgets.

## Deploy (about 20 minutes, once)

1. **Account.** Create an AWS account, then immediately turn on MFA for the root user (IAM -> Security
   credentials). Recommended: create an admin user in IAM Identity Center and use that instead of root.
   New accounts choose a *Free plan* (up to 6 months / $200 credits) or a *Paid plan*; both include the
   always-free allowances. To keep running after the Free plan period you must switch to Paid; the cut-offs
   above are what keep a Paid account at $0.
2. **Make the pack** with your new code (outside the repo): `node tools/make-pack.mjs <photo-folder> '<code>'`,
   or ask Claude to build it.
3. **CloudShell.** In the console, switch the region to **US East (N. Virginia)**, open CloudShell (the `>_` icon),
   upload `settlers.ebdeck` (Actions -> Upload file), then:
   ```
   git clone https://github.com/emitroo/EBriscola && cd EBriscola
   bash aws/deploy.sh
   ```
   It asks for your email and the pack code, creates the stack (~5 minutes, mostly CloudFront), uploads the app
   and the pack, and prints the app URL, the pack server URL and three values for GitHub.
4. **Confirm the two subscription emails** from AWS Notifications, or you won't hear about alarms.
5. **Automatic deploys (optional).** GitHub repo -> Settings -> Secrets and variables -> Actions -> *Variables*:
   add `AWS_DEPLOY_ROLE_ARN`, `AWS_SITE_BUCKET`, `AWS_DISTRIBUTION_ID` with the printed values. From then on every
   change pushed to the deploy branch is uploaded by `.github/workflows/aws-deploy.yml`.
6. **Code-only unlock on GitHub Pages too (optional).** Put the printed pack server URL in `src/config.js`
   (`packApi`), run `npm run build` and push (or ask Claude).

Re-running `bash aws/deploy.sh` later updates the stack in place (e.g. a new code: make a new pack, upload it,
re-run with the new code).

## Everyday operations

- **New code / new photos:** build a pack with the new code, `aws s3 cp settlers.ebdeck s3://<PackBucketName>/`,
  and if the code changed re-run `bash aws/deploy.sh` (it updates the stored token hash).
- **See what's happening:** CloudWatch -> Alarms (state of all seven), Lambda -> `ebriscola-pack` -> Monitor,
  Billing -> Budgets.
- **Test the cut-off (worth doing once):** in CloudShell,
  `aws cloudwatch set-alarm-state --alarm-name <a cut-off alarm's name> --state-value ALARM --state-reason test`;
  check the email arrives and the AWS site goes offline after a few minutes, then `bash aws/reenable.sh`.
- **Remove everything:** empty both buckets (`aws s3 rm s3://<bucket> --recursive`), then
  `aws cloudformation delete-stack --stack-name ebriscola`.

## Files

- `template.src.yaml`: the stack (edit this); `build.mjs` inlines the function code into `template.yaml`
  (checked by CI together with `cfn-lint`).
- `functions/pack.js`, `functions/cutoff.js`: the two Lambda functions (unit tests in `test/aws.test.js`).
- `deploy.sh`, `upload-site.sh`, `reenable.sh`: CloudShell / CI scripts.
- `../tools/pack-token.mjs`: prints the token hash for a code.
