# VoiceAutoAi Project Documentation

---

## 1. Project Overview

**VoiceAutoAi** is a small web application built with **React**, **TypeScript**, and **Vite**. It provides a voice‑activated AI assistant that can listen to spoken commands, send them to an AI backend, and display the response. The UI is composed of a few reusable React components and a simple HTML entry point.

**Tech Stack**
- **React 18** with **TypeScript**
- **Vite** as the development server and bundler
- **Tailwind‑like styling** is done via plain CSS in `index.html` and component‑scoped styles.
- **Web Speech API** for voice capture (handled in the components).

---

## 2. File‑by‑File Walkthrough

### Root Files
| File | Role | Typical Customizations |
|------|------|------------------------|
| `index.html` | Entry HTML page. Loads the bundled JavaScript and provides the root `<div id="root"></div>`. Also contains global CSS (fonts, colors, layout). | Change page title, meta tags, global CSS variables, add external scripts or fonts. |
| `App.tsx` | Top‑level React component. Sets up routing (if any) and renders the main UI (e.g., `<Dashboard />`). | Modify overall layout, add new top‑level components, change theme colors. |
| `index.tsx` | Boots the React app by rendering `<App />` into `#root`. | Usually left untouched; you might wrap the app with providers (e.g., ThemeProvider). |
| `constants.ts` | Stores static configuration such as API endpoints, default prompts, and UI strings. | Update API URLs, change default language, adjust timeout values. |
| `types.ts` | TypeScript type definitions used across the project (e.g., `Message`, `AIResponse`). | Add new fields to types when extending functionality. |
| `metadata.json` | Simple metadata about the project (author, version). | Update version number or author info. |
| `vite.config.ts` | Vite configuration (plugins, alias, server options). | Change dev server port, add plugins, adjust build options. |
| `package.json` / `package-lock.json` | Project dependencies and scripts (`npm install`, `npm run dev`). | Add new npm packages, modify scripts (e.g., add `build`). |
| `.gitignore` | Files/folders ignored by Git. | Usually unchanged. |

### Component Directory (`components/`)
| Component | File | Purpose | Customization Points |
|----------|------|---------|----------------------|
| **CallModal** | `CallModal.tsx` | Modal dialog that starts/stops voice capture, shows transcription, and displays AI response. Handles UI state for listening, loading, and error handling. | Change modal text, adjust styling, replace icons, modify how the transcript is displayed, hook into a different speech‑to‑text service. |
| **Dashboard** | `Dashboard.tsx` | Main screen that shows the call button, recent interactions, and status badges. Coordinates with `CallModal`. | Rearrange layout, add new widgets (e.g., recent history list), change colors or fonts. |
| **StatusBadge** | `StatusBadge.tsx` | Small component that displays a colored badge indicating the current AI status (e.g., "Listening", "Processing", "Error"). | Add new status types, modify badge colors, change tooltip text. |

---

## 3. Customization Guide

### 3.1 Changing UI Text (Localization)
1. Open `constants.ts`.
2. Locate string constants such as `WELCOME_MESSAGE`, `LISTEN_BUTTON_LABEL`.
3. Replace the English text with your desired language (e.g., Turkish). Save.
4. If the text appears directly in JSX (e.g., `<h1>Hello</h1>`), edit the corresponding component file (`Dashboard.tsx`, `CallModal.tsx`).

### 3.2 Adjusting Colors & Styling
- Global CSS variables are defined in `<style>` block of `index.html`. Look for `:root { --primary-color: #...; }`.
- To change component‑specific styles, edit the `<style>` sections inside the `.tsx` files or add a separate CSS file and import it.

### 3.3 Modifying the AI Backend Endpoint
1. Open `constants.ts`.
2. Find `API_URL` (or similar).
3. Replace the URL with your own backend endpoint.
4. Ensure the backend follows the same request/response contract (JSON with `prompt` and `response`).

### 3.4 Adding a New Feature (e.g., History Log)
1. Create a new component file, e.g., `components/HistoryLog.tsx`.
2. Define the UI and state handling for the log.
3. Import and render `<HistoryLog />` inside `Dashboard.tsx`.
4. Update TypeScript types in `types.ts` if new data structures are needed.

---

## 4. Interaction Flow (Data & Event Flow)
1. **User clicks** the "Call" button on `Dashboard`.
2. `Dashboard` sets a state flag that opens `CallModal`.
3. `CallModal` starts the **Web Speech API** (`SpeechRecognition`).
4. As speech is captured, the transcript is displayed live.
5. When the user stops speaking, `CallModal` sends the transcript to the AI backend via `fetch` using the URL from `constants.ts`.
6. The backend returns a response JSON; `CallModal` updates its state to show the AI answer.
7. `StatusBadge` updates its color based on the current state (`listening`, `loading`, `error`).
8. The modal can be closed, returning control to `Dashboard`.

---

## 5. Verification Checklist
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `npm install` (if not already done). | Dependencies installed without errors. |
| 2 | Start dev server: `npm run dev`. | Vite prints a local URL (e.g., `http://localhost:5173`). |
| 3 | Open the URL in a browser. | The app loads, showing the dashboard with a call button. |
| 4 | Click the call button, speak a short phrase. | Modal appears, transcript updates in real‑time. |
| 5 | Stop speaking; wait for AI response. | AI answer appears in the modal; status badge turns green. |
| 6 | Verify any custom changes (e.g., new text, colors). | UI reflects the modifications you made. |
| 7 | Close the modal and refresh the page. | Application works after a full reload. |

---

## 6. Frequently Asked Questions
- **Where is the voice capture logic?**
  - Inside `CallModal.tsx`, using `window.SpeechRecognition`.
- **How do I add more languages?**
  - Update UI strings in `constants.ts` and adjust any hard‑coded English text in components.
- **Can I replace Vite with another bundler?**
  - Yes, but you would need to rewrite the build scripts in `package.json` and adjust the config files accordingly.

---

*Prepared for presentation to your instructor. Feel free to expand each section with screenshots or live demos as needed.*
