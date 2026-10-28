# Automated Proposal Generator

Generates professional Google Docs proposals from meeting transcripts using OpenRouter AI.

## Setup

### 1. Install dependencies

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 2. OpenRouter setup

Get an API key at https://openrouter.ai/keys

### 3. Google OAuth2 setup

The backend uses **your personal Google account** to create Google Docs.

1. Go to https://console.cloud.google.com/apis/credentials
2. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Desktop app**
4. Name: `Proposal Generator` → **Create**
5. Click **Download JSON** → save as `client_secret.json` in the project root
6. Enable the APIs:
   - https://console.cloud.google.com/apis/library/drive.googleapis.com
   - https://console.cloud.google.com/apis/library/docs.googleapis.com

### 4. Run the OAuth setup

```bash
source venv/bin/activate
python -m backend.auth_setup
```

This opens a browser — log in with your Google account and grant permissions. The refresh token is saved to `.env`.

### 5. Create the Google Doc template

```bash
python -m backend.create_template
```

Follow the instructions: create a new Google Doc, paste the template content, share with nothing (it uses your own Drive now), and set `GOOGLE_DOCS_TEMPLATE_ID` in `.env`.

### 6. Configure environment

Edit `.env` with your remaining values:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `OPENROUTER_MODEL` | Model (default: `openai/gpt-4.1-mini`) |
| `GOOGLE_CLIENT_ID` | Set by auth_setup |
| `GOOGLE_CLIENT_SECRET` | Set by auth_setup |
| `GOOGLE_REFRESH_TOKEN` | Set by auth_setup |
| `GOOGLE_DRIVE_FOLDER_ID` | Folder for generated proposals (`root` for top-level) |
| `CONSULTANT_NAME` | Your name |
| `CONSULTANT_EMAIL` | Your email |
| `PROPOSAL_API_TOKEN` | Build-time bearer token used by `frontend/build.py` (never commit it) |

### 7. Start the server

```bash
source venv/bin/activate
uvicorn backend.main:app --reload
```

### 8. Build and open the frontend

The frontend is a single self-contained HTML file. Build it with the Modal bearer token (do not commit the token):

```bash
PROPOSAL_API_TOKEN="your-api-auth-token" python frontend/build.py
open frontend/index.html  # macOS; double-click it on other systems
```

The UI supports paste or `.txt` upload, calls the Modal generator, offers three visual style previews, provides a full editable review step, renders an animated proposal deck, and can download HTML or print to PDF. If the API call fails, it shows a clearly labelled sample fallback so demos can continue.

Run the pure helper tests with:

```bash
npm test
python -m unittest discover -s tests -p '*test.py'
```

## Usage

1. Upload a `.txt` meeting transcript
2. Enter company name, your name, and price
3. Click **Generate Proposal**
4. The AI analyzes the transcript and fills a Google Doc proposal
5. Click the link to view/edit the document

## Placeholders used in the template

| Placeholder | Source |
|---|---|
| `{{proposalTitle}}` | AI-generated |
| `{{companyName}}` | User input |
| `{{consultantName}}` | User input / config |
| `{{consultantEmail}}` | Config |
| `{{date}}` | Auto-generated |
| `{{problemSection}}` | AI-generated from transcript |
| `{{solutionSection}}` | AI-generated from transcript |
| `{{scopeSection}}` | AI-generated from transcript |
| `{{timelineSection}}` | AI-generated from transcript |
| `{{price}}` | User input |
| `{{depositAmount}}` | Calculated (50% of price) |
