# Azure Deployment Instructions (React + TypeScript, Vite)

This document describes two simple deployment options to host your Vite-based React TypeScript app on Azure:

- Recommended (CI): Azure Static Web Apps using GitHub Actions — automatic builds and HTTPS.
- Quick/manual (no CI): Azure Storage Static Website — upload `dist/` files and serve as static site.

Both approaches assume your app builds to the `dist/` folder (Vite default). If you changed the output folder, replace `dist` below.

---

Prerequisites
- Node.js and your app building locally: `npm install` then `npm run build`.
- Azure CLI installed and logged in: `az login`.
- (For Static Web Apps) a GitHub repository with your project (recommended).

Quick checklist before deployment
- Make sure client-side environment variables use the `VITE_` prefix (e.g. `VITE_API_BASE=http://...`) and are available at build-time.
- Ensure your backend (API) supports CORS and cookies if you use httpOnly session cookies (`credentials: 'include'`).

Option A — Recommended: Azure Static Web Apps (GitHub Actions)

Why use this:
- Automatic deploys when you push to GitHub.
- Built-in HTTPS, global CDN, and easy routing for SPAs.

Steps (high level):

1. Push your repository to GitHub.
2. In Azure Portal, create a *Static Web App* resource and connect your GitHub repo and branch.
   - App location: `/` (root) if your repository contains package.json at root.
   - Api location: leave blank if you don't use Azure Functions for API.
   - App artifact location: `dist`
3. Azure will add a GitHub Actions workflow to your repo under `.github/workflows/`.
   - The workflow runs `npm install` and `npm run build` and uploads `dist/` to Azure.

Example: minimal `.github/workflows/azure-static-web-apps.yml` (Azure creates this automatically):

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Upload artifact
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          #### The values below are usually created automatically by Azure when you set up the Static Web App resource:
          #### app_location: "/"
          #### api_location: ""
          #### output_location: "dist"
```

Notes:
- To provide environment variables to the build you can set repository secrets (like `VITE_API_BASE`) and reference them in the workflow before build (e.g., `env: VITE_API_BASE: ${{ secrets.VITE_API_BASE }}`) so the values are baked into the built files.
- For runtime secrets and cookies you should keep tokens on the backend; the frontend should use `GET /api/auth/me` (with `credentials: 'include'`) to verify session.

Option B — Quick/manual: Azure Storage Static Website (upload `dist/`)

Why use this:
- Simple and quick for development or quick demos.
- Not as feature-rich as Static Web Apps, but easy to set up from your machine.

Steps:

1. Build locally:

```cmd
npm install
npm run build
```

2. Create a resource group and storage account (example names — change them):

```cmd
az login
az group create --name myResourceGroup --location eastus
az storage account create --name myuniquestorageacct --resource-group myResourceGroup --location eastus --sku Standard_LRS --kind StorageV2
```

3. Enable static website hosting and set index/404 to `index.html`:

```cmd
az storage blob service-properties update --account-name myuniquestorageacct --static-website --index-document index.html --404-document index.html
```

4. Upload the `dist/` build to the special `$web` container:

```cmd
az storage blob upload-batch -s dist -d '$web' --account-name myuniquestorageacct
```

5. Find your site URL:

```cmd
az storage account show -n myuniquestorageacct -g myResourceGroup --query "primaryEndpoints.web"
```

You will get a URL like `https://<account>.z22.web.core.windows.net/` where your app is now hosted.

Notes and limitations:
- Environment variables: for static hosting, client-side env vars must be baked at build-time. Use a CI or local build with the correct `VITE_` variables.
- If you use httpOnly cookies for authentication (recommended), host your backend on a domain that matches cookie rules or use a proxy; otherwise consider token-based flows carefully.
- For SPA routing to work correctly, both Static Web Apps and Storage static website have SPA fallback to `index.html`. For App Service you may need a rewrite rule.

Additional tips
- Use HTTPS in production and set `Secure` on cookies.
- Use `VITE_` prefixed env vars for all frontend config values (Vite reads those at build-time).
- For server-side APIs, prefer storing refresh tokens in the backend and expose a `GET /api/auth/me` endpoint that the frontend can call with `credentials: 'include'`.
- If you want GitHub Actions but you don't want to use Azure's Static Web Apps action, you can write a workflow to build and `az storage blob upload-batch` to push `dist/` to a Storage static website.

Example: build + upload (GitHub Actions or local script)

```bash
# build
npm ci
npm run build

# upload using Azure CLI (requires az login or service principal)
az storage blob upload-batch -s dist -d '$web' --account-name myuniquestorageacct
```

Troubleshooting
- 404 on refresh: ensure SPA fallback is configured (index/404 -> index.html).
- CORS / cookie not sent: ensure backend response sets `Access-Control-Allow-Credentials: true` and frontend fetch uses `credentials: 'include'`.
- Missing env values: remember Vite injects env variables at build time. Use CI secrets or set `VITE_` env vars locally before `npm run build`.

If you want, I can:
- Generate a GitHub Actions workflow that sets Vite env vars from secrets and deploys to Azure Static Web Apps (complete example). Or,
- Create a small `azure-deploy.sh` script which builds and uploads `dist/` to an Azure Storage static website using the Azure CLI.

---

This should get you a minimal, working Azure deployment for your Vite React TypeScript app. If you tell me which option you'd like (Static Web Apps via GitHub Actions or Storage static website), I can scaffold the workflow/script for you and include the exact `az` commands adapted to your project names.
