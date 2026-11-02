# BrandGuard QC Studio

BrandGuard is a visual quality-control workspace for reviewing character and product imagery. Upload an image, run a structured vision review, and export or revisit the resulting report.

## Run locally

1. Create `.env.local` with `OPENROUTER_API_KEY=your_key`.
2. Run `npm install` and `npm run dev` for the Vite development server.
3. For the production server, run `npm run build` and then `npm start`. Set `OPENROUTER_API_KEY` in the server environment.

The app uses OpenRouter's free-model router, which selects a free model that supports image input. The OpenRouter credential is added by the server proxy and is not stored in browser storage or bundled into the frontend. `.env.local` is ignored by Git.
