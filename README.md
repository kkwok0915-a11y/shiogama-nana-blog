# 塩釜菜那 部落格 中文翻譯

Static archive of Traditional Chinese translations of 塩釜菜那's Bokuao blog.

Production URL: https://shiogama-nana-blog.vercel.app
Vercel project: `shiogama-nana-blog` (`prj_QdKqzkmsYJOO8JpIl8Ci45DrvnCN`) on team `team_MpzOmojkBvxnWwiQW63WOOQH`.
Use the `*.vercel.app` project domain above; the `*-kkwok0915-a11ys-projects.vercel.app` alias is SSO-protected.

Subtitled videos for all Bokuao members are on a separate site: https://bokuao-videos.vercel.app

## Rebuild and deploy

```bash
/workspace/blog-site/deploy.sh
```

`deploy.sh` always regenerates `public/` from:

- Translations: `/workspace/blog-watch/translations/<id>.md`
- Photos: `/workspace/blog-watch/photos/<id>/N.jpg` (also accepts `shiogama-nana-<id>-N.jpg` in `/workspace/blog-watch/`)

If the Vercel CLI is installed and authenticated (`VERCEL_TOKEN` or `vercel whoami`), it deploys `public/` to production on the **shiogama-nana-blog** project (`--scope team_MpzOmojkBvxnWwiQW63WOOQH`).

If the CLI is not available, the script still builds the site and writes `deploy-manifest.json`. Redeploy with the connected `user-Vercel` MCP tools:

1. `python3 /workspace/blog-site/build.py`
2. For each file in `deploy-manifest.json`, call `upload_file` with `contentLength` (bytes), `xVercelDigest` (SHA1), `teamId=team_MpzOmojkBvxnWwiQW63WOOQH`, and `requestBody` as the file's base64 (`$file:` of a base64 text file).
3. Call `create_deployment` with `skipAutoDetectionConfirmation=1`, the same `teamId`, `requestBody.name=shiogama-nana-blog`, `requestBody.target=production`, `requestBody.projectSettings.framework=null`, and `requestBody.files` as `{file, sha, size}` entries from the manifest.
4. If the production URL is gated, call `update_project` on this project only with `requestBody.ssoProtection=null`.

Team access: the Hobby account's team is `kkwok0915-a11ys-projects` (`team_MpzOmojkBvxnWwiQW63WOOQH`). If MCP returns 403 for that scope, call `authorize_team_access` with that `teamId` and have the user open the consent link. Do not scrape credentials.
