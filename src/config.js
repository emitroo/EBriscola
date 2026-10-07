/* Deployment settings. packApi: full URL of the AWS pack server (https://<distribution>.cloudfront.net/api/pack), so
 * copies of the app hosted elsewhere (GitHub Pages) can fetch a private photo pack with just its code. Empty = only
 * the same-origin /api/pack (when the app itself is served from AWS) or a pack file. */
window.EB_CONFIG = { packApi: '' };
