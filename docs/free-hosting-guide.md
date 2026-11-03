# Free online hosting guide

This guide deploys FrameProof QC Studio as one Render web service. The service builds the React app, serves the built files, and proxies Gemini requests so the API key stays on the server. The repository includes a Render Blueprint at [`render.yaml`](../render.yaml) with these settings.

## What you need

- A GitHub account with access to the FrameProof repository.
- A Render account.
- A Gemini API key configured for the Gemini API. Keep it private; do not paste it into source files or the browser.

## Deploy it

1. Push the latest app code, including `render.yaml`, to the GitHub branch you want Render to deploy.
2. In Render, choose **New → Blueprint** and connect the GitHub repository. If asked, grant Render access to that repository.
3. Render reads `render.yaml` and shows the `frameproof-qc-studio` web service. Review the proposed service and start the Blueprint sync.
4. When prompted for `GEMINI_API_KEY`, enter the key in Render's secret field. The Blueprint uses `sync: false`, so the key is not stored in this repository. Do not add it to `VITE_*` variables or commit it to Git.
5. Wait for the initial deployment to finish. Render runs `npm ci && npm run build`, then starts the app with `npm start`. The health check requests `/`.
6. Open the `onrender.com` URL shown on the service page.

Render's Blueprint flow and `sync: false` behavior are described in its [Blueprint specification](https://render.com/docs/blueprint-spec). Render also documents [environment variables and secrets](https://render.com/docs/configure-environment-variables).

## Check the live app

1. Open the site and confirm the FrameProof interface loads.
2. Upload a suitable test image and run an analysis.
3. Confirm that the report appears. If the page loads but analysis fails, open the Render service's **Environment** page and check that `GEMINI_API_KEY` is configured without revealing its value. Then inspect the service logs for a missing-key response or an upstream Gemini error.
4. If you change the API key, update it in the Render service's Environment page and save the change so Render redeploys with the new value.

The app keeps review history and settings in that browser's local storage. It does not use the Render filesystem to preserve user reports. The uploaded image is sent to Gemini for analysis, so only upload images you are allowed to share with that provider. Google's [API key guidance](https://ai.google.dev/gemini-api/docs/api-key) explains why keys must be protected.

## Updates after launch

Render can deploy new commits from the connected branch automatically. Push changes to GitHub, then watch the Render **Events** and **Logs** pages until the deployment completes. For a failed deploy, confirm that the build succeeds locally with the repository's Node-compatible npm environment, review the Render build log, and check that the start command is `npm start`.

## Free-tier behavior and limits

- Render's free web services spin down after 15 minutes without inbound traffic. The first visit after that can take around a minute while the service starts again.
- The free service has an ephemeral filesystem. Files saved on the server can disappear after a restart or deployment, so this setup is for serving the app and proxying requests, not durable report or upload storage.
- Free instance hours, bandwidth, and build resources are limited and subject to Render's current plan rules. Render describes free instances as suitable for hobby projects and evaluation rather than production workloads. See [Render's current free instance limits](https://render.com/docs/free).
- Free hosting does not guarantee free or unlimited Gemini analysis. Provider access, quotas, and any charges depend on the Gemini account and current terms. Monitor provider usage separately.
- Browser-local reports are tied to the browser and device. Clearing browser data or switching devices removes access to that local history.

## Why this host setup

This project needs a server-side proxy because the browser must not receive the Gemini secret. A static-only host would need an additional protected serverless function or backend. Render's single Node web service runs the existing `server.cjs` and serves the Vite build from the same origin.
