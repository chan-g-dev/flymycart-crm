# Fly My Cart CRM frontend

React/Vite interface for the modules defined in [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Local development

1. Copy `.env.example` to `.env` and set `VITE_API_URL` to the FastAPI server URL.
2. Install dependencies with `npm install`.
3. Start the UI with `npm run dev`.

The API client appends `/api` to `VITE_API_URL`. Authentication uses the backend application session (HttpOnly cookie with bearer-token fallback). CRM data is loaded after login and refreshed only after explicit user actions; there is no periodic polling.

## Validation

- `npm run build`
- `npm run lint`

The application entry point is `src/main.jsx`; top-level state and module routing live in `src/App.jsx`.
