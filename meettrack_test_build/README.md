<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c36b28e0-e4cb-4c0a-a94f-06530f4ce262

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Student Batch + No-Show Calling Automation

This build adds an Admin **Students** tab for permanent batch/student contact data and wires the existing Google Meet extension's **Student Not Joined** action into a no-show calling workflow. Daily slot bookings remain separate and are not uploaded with batch files.

See `NO_SHOW_CALLING_SETUP.md` before enabling the calling trigger. The new Students & Batches feature is intentionally local-only in this test build; it does not use Supabase.
