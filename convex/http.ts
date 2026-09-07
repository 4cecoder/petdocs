import { httpRouter } from "convex/server";

// Public HTTP surface (resend webhooks, share oEmbed later).
// Auth for /p/[token] stays in shareLinks.resolve — no HTTP routes needed
// for MVP beyond this placeholder.
const http = httpRouter();

export default http;
