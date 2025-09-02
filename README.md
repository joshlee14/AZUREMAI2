# Project Icarus MVP

Project Icarus is a Chrome extension and backend service that helps Medicare Advantage agents compare real plans and deliver AI‑powered closing scripts. This repository contains a fully functioning MVP built with Node.js and a Manifest V3 Chrome extension.

## Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Google Chrome** (for loading the extension)
- **Socrata App Token** for accessing the CMS plan finder data (optional but recommended)
- **OpenAI API Key** for generating AI closing scripts

## Project Structure

```
project-icarus/
├── backend/                 # Express backend service
│   ├── .env.example         # Environment variable template
│   ├── app.js               # Main server file
│   ├── package.json         # Backend package definition
│   └── modules/             # Helper modules
│       ├── planFetcher.js   # Fetches and filters plans from CMS
│       └── aiAssistant.js   # Generates AI closing scripts using GPT-4
└── chrome-extension/        # Chrome extension source
    ├── manifest.json        # Manifest V3 definition
    ├── popup.html           # Popup UI markup
    ├── popup.js             # Popup logic
    ├── styles.css           # Popup styling
    └── icons/               # Extension icons
```

## Setup Instructions

1. **Clone the repository** and navigate to the backend directory:

   ```bash
   cd project-icarus/backend
   ```

2. **Install backend dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:

   - Copy `.env.example` to `.env` and fill in your credentials:

     ```bash
     cp .env.example .env
     ```

   - Open `.env` and replace `YOUR_CMS_APP_TOKEN` with your Socrata App Token (optional) and `YOUR_OPENAI_API_KEY` with your OpenAI API key.

4. **Run the backend server**:

   ```bash
   npm start
   ```

   The server will listen on port **3000** by default. Ensure your extension points to this port.

5. **Load the Chrome extension**:

   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `chrome-extension` directory from this project.
   - The “Project Icarus” icon should appear in your toolbar.

6. **Use the extension**:

   - Click the Icarus icon to open the popup.
   - Fill in the client details and click **Submit** to fetch available plans.
   - Select a plan and click **Recommend Plan** to generate a tailored pitch and rebuttals.

## API Details

### CMS MA Plan Finder API (data.cms.gov)

- **Endpoint**: `https://data.cms.gov/resource/ma-plan-finder.json`
- **Purpose**: Provides real Medicare Advantage plan data including premiums, benefit maxima, and service areas.
- **Authentication**: For higher rate limits, create a Socrata App Token:
  1. Visit the dataset page on [data.cms.gov](https://data.cms.gov/dataset/MA-Plan-Finder/ma-plan-finder).
  2. Click **API** and then **Request an API key**.
  3. Sign up or log in and create an app token.
  4. Add the token to your `.env` file as `CMS_APP_TOKEN`.

### OpenAI API

- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Purpose**: Generates the AI closing script and rebuttals via GPT‑4.
- **Authentication**: Requires an OpenAI API key.
  1. Create an account at [OpenAI](https://platform.openai.com/).
  2. Navigate to **API Keys** and generate a new secret key.
  3. Add this key to your `.env` file as `OPENAI_API_KEY`.

### NPI Registry (Optional)

- **Endpoint**: `https://npiregistry.cms.hhs.gov/api/`
- **Purpose**: Public registry for healthcare providers. Can be used to look up provider networks in a future enhancement.
- **Authentication**: No authentication required for basic lookup.

## Security & Privacy

This MVP does not store any personal data. Client information is processed only in memory and passed directly to the CMS API and OpenAI API. No personal health information is persisted.

## Future Work

- Integrate a more granular plan data API for better filtering.
- Add voice transcription via Whisper or other speech‑to‑text service.
- Implement provider network lookup using the NPI registry.
