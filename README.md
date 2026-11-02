# BrandGuard QC Studio

BrandGuard is a visual quality-control workspace for reviewing character and product imagery. Upload an image, run a structured vision review, and export or revisit the resulting report.

## Run locally

1. Create `.env.local` with `OPENCODE_API_KEY=your_key`.
2. Run `npm install` and `npm run dev` for the Vite development server.
3. For the production server, run `npm run build` and then `npm start`. Set `OPENCODE_API_KEY` in the server environment.

The OpenCode credential is added by the server proxy and is not stored in browser storage or bundled into the frontend. `.env.local` is ignored by Git.
