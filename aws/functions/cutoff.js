// Cut-off switch: run by a usage alarm or the cost budget (via SNS). Stops the pack function (reserved concurrency 0)
// and disables the CloudFront distribution. GitHub Pages is unaffected. Undo with aws/reenable.sh.
const { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } = require('@aws-sdk/client-cloudfront');
const { LambdaClient, PutFunctionConcurrencyCommand } = require('@aws-sdk/client-lambda');
const E = process.env;
const d = { cf: new CloudFrontClient({}), lambda: new LambdaClient({}) };
exports.d = d;

exports.handler = async (ev) => {
  const why = (ev.Records || []).map((r) => r.Sns && (r.Sns.Subject || '').slice(0, 120)).join('; ');
  console.log('cut-off triggered:', why);
  await d.lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: E.PACK_FN, ReservedConcurrentExecutions: 0 }));
  const cur = await d.cf.send(new GetDistributionConfigCommand({ Id: E.DIST_ID }));
  if (cur.DistributionConfig.Enabled) {
    cur.DistributionConfig.Enabled = false;
    await d.cf.send(new UpdateDistributionCommand({ Id: E.DIST_ID, IfMatch: cur.ETag, DistributionConfig: cur.DistributionConfig }));
  }
  return { stopped: true, why };
};
