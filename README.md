# FrameProof QC Studio

FrameProof is a visual quality-control workspace for reviewing character and product imagery. Upload an image, run a structured vision review, and export or revisit the resulting report.

The interface uses the G5 AI Studio design system (the same colour tokens, Inter/Geist type and amber accent as aistudio.galleri5.com), with light mode by default and a dark mode toggle in the header. The theme is the last layer in `src/index.css`.

For a non-technical flowsheet and backend overview, see [docs/architecture-overview.md](docs/architecture-overview.md).
For the step-by-step process, technology purposes, and source-code percentage breakdown, see [docs/process-and-technology-guide.md](docs/process-and-technology-guide.md).
For a free online deployment walkthrough, see [docs/free-hosting-guide.md](docs/free-hosting-guide.md). The repository's [`render.yaml`](render.yaml) configures the Render web service and prompts for the Gemini key as a secret during setup.

## Run locally

1. Create `.env.local` with `GEMINI_API_KEY=your_key`.
2. Run `npm install` and `npm run dev` for the Vite development server.
3. For the production server, run `npm run build` and then `npm start`. Set `GEMINI_API_KEY` in the server environment.

The app uses Gemini 3.5 Flash-Lite for free-tier image analysis. The Gemini credential is added by the server proxy and is not stored in browser storage or bundled into the frontend. `.env.local` is ignored by Git.
