# Render frontend deployment

This Git checkout has `package.json` at its root. Create a Render Static Site
connected to the frontend source with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `npm ci --include=dev && npm run build` |
| Publish Directory | `dist` |
| Rewrite | `/*` to `/index.html` |

Set `VITE_API_URL=https://YOUR-BACKEND.onrender.com/api/v1` before building.
Use the actual backend URL. Set the backend's `FRONTEND_URL` to this static
site's HTTPS origin. Rebuild the frontend whenever `VITE_API_URL` changes.

Do not use `cd backend` or `cd frontend`: those folders are not part of this
Git checkout. The frontend and backend are deployed as separate services.

`render.yaml` provides these settings for a new Blueprint. For an existing
manually configured site, update the dashboard settings directly.

Both local app checkouts currently reference the same GitHub repository and
`rohan` branch despite having different committed contents. Verify the connected
remote branch contains the frontend files before deploying. Use distinct source
branches or repositories for the two apps, or deliberately combine the apps into
subfolders and configure the corresponding Render Root Directories.
