"""
Proposal Generator — Modal serverless function for n8n workflows.
Creates Google Docs proposals from meeting transcripts using OpenRouter AI.
"""

import modal
from fastapi import Header, HTTPException

app = modal.App("proposal-generator")

# The browser UI is intentionally a static file opened from file://.  Modal's
# FastAPI adapter handles the endpoint, while this app documents the CORS
# policy expected by deployments that expose the ASGI app directly.
# Keep the allow-list narrow: file:// sends the literal Origin `null`.

image = modal.Image.debian_slim().pip_install(
    "fastapi[standard]",
    "httpx",
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

TEMPLATE_DOC_ID = "1dt5L_r76flXKWHKwZEPLDnXWEu5Db6CYT73mz9b4CWg"

ANALYSIS_PROMPT = """You are a proposal writing assistant. Given a meeting transcript, company name, and price, generate a professional proposal as a fixed slide deck.

CRITICAL: Identify the EXACT service or project discussed in the transcript. Do NOT default to "automation", "strategic consulting", "consulting", or any generic category — use whatever the client actually asked for (e.g. lead generation, marketing, web development, website design, content creation, sales training, etc.). The proposal title must be specific to what was discussed.

Return ONLY valid JSON with this structure:
{
  "proposalTitle": "Title like 'Lead generation for [Company]' matching what was discussed",
  "slides": [
    { "type": "cover", "title": "...", "serviceType": "...", "subtitle": "..." },
    ...more slides...
    { "type": "terms", "heading": "Terms & signature", "termsText": "..." }
  ]
}

The deck is a FIXED 8-slide template. Include every EXACTLY once, in this order:
1. cover — REQUIRED, must be first. Fields: title, serviceType, subtitle, company, consultant, date
2. signal — The current pain/state. Fields: eyebrow, heading, intro, roles: [string], rolesNote, nodes: [{tag, title, desc}]
3. architecture — How it works (step-by-step pipeline, up to 6 nodes). Fields: eyebrow, heading, intro, nodes: [{step, title, desc, hot: bool}], note
4. volume — Scale/cadence metrics. Fields: eyebrow, heading, intro, cards: [{day, icon, title, desc}], metrics: [string]
5. tools — Tools & cost breakdown. Fields: eyebrow, heading, tools: [{role, name, desc, price}], note
6. investment — Pricing. Fields: eyebrow, heading, panels: [{tag, amount, note, items: [string], hot: bool, promo: string}]
   - For single-price: one panel with tag="Total project fee"
   - For setup+retainer: two panels (one-time setup + ongoing retainer), set hot=true on the retainer panel
   - Use promo: "First month free" or similar if applicable
7. close — CTA. Fields: pill, heading, intro, steps: [{num, title, desc}], cta
8. terms — REQUIRED, must be last. Fields: heading, termsText, company, consultant, email, date

RULES:
- Every proposal MUST include exactly the 8 slides above, in the order given.
- Signal and architecture nodes should have 2-4 items each (not 5).
- Each node/tool/card/step should have a short title (2-5 words) and a 1-2 sentence description.
- roles: the people who currently own the problem (e.g. founder, sales rep, marketing lead).
- For investment, extract the price from the input. If the transcript implies setup + retainer, use two panels. If it implies a single fee, use one panel.
- Write the termsText as: "[Consultant] will build the system for [Company] according to the description laid out in this proposal. Additional features beyond the listed requirements may affect the timeline and costs outlined above.\\n\\nBy signing below, both parties indicate their acceptance of this proposal and constitute approval to begin work upon [Company]'s payment of the deposit."
- Use professional but conversational tone. Write directly as if speaking to the client.
- Never mention "WorkflowLoop" or any agency name — the proposal comes from the consultant who is reading it."""


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("api-auth-token"),
        modal.Secret.from_name("openrouter-api-key"),
        modal.Secret.from_name("google-oauth"),
    ],
    timeout=300,
)
@modal.fastapi_endpoint(method="POST")
def generate_proposal(
    data: dict, authorization: str = Header(None)
) -> dict:
    import os
    import json
    from datetime import datetime

    # Bearer token authentication
    expected_token = os.environ.get("API_AUTH_TOKEN")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization header",
        )
    token = authorization.replace("Bearer ", "")
    if token != expected_token:
        raise HTTPException(
            status_code=403, detail="Invalid authentication token"
        )

    # Validate input
    transcript = data.get("transcript", "")
    company_name = data.get("company_name", "")
    consultant_name = data.get(
        "consultant_name", os.environ.get("CONSULTANT_NAME", "Consultant")
    )
    price = data.get("price", "")
    consultant_email = data.get(
        "consultant_email", os.environ.get("CONSULTANT_EMAIL", "")
    )

    if not transcript or not company_name:
        raise HTTPException(
            status_code=400,
            detail="transcript and company_name are required",
        )

    # The AI proposal is the product of this endpoint; the Google Doc copy is a
    # best-effort side effect. A Google failure (e.g. stale refresh token) must
    # not sink the response — the UI only needs `proposal`.
    try:
        ai_data = _analyze_transcript(transcript, company_name, price)
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

    document_url = ""
    document_error = ""
    try:
        document_url = _create_proposal_document(
            ai_data, company_name, consultant_name, price
        )
    except Exception as e:
        import traceback
        document_error = str(e)

    return {
        "success": True,
        "documentUrl": document_url,
        "documentError": document_error or None,
        "proposal": ai_data,
        "consultantEmail": consultant_email,
    }


def _analyze_transcript(transcript: str, company_name: str, price: str) -> dict:
    import os
    import json
    import httpx

    api_key = os.environ["OPENROUTER_API_KEY"]
    model = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-v4-pro")

    resp = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": ANALYSIS_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Company Name: {company_name}\n"
                        f"Price: {price}\n\n"
                        f"Meeting Transcript:\n{transcript}"
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=120,
    )
    resp.raise_for_status()
    return json.loads(resp.json()["choices"][0]["message"]["content"])


def _create_proposal_document(
    ai_data: dict, company_name: str, consultant_name: str, price: str
) -> str:
    import os

    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.environ["GOOGLE_REFRESH_TOKEN"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        scopes=SCOPES,
    )
    creds.refresh(Request())

    title = ai_data.get("proposalTitle", f"Proposal for {company_name}")
    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "root")
    drive = build("drive", "v3", credentials=creds)

    # Copy template doc
    copied = drive.files().copy(
        fileId=TEMPLATE_DOC_ID,
        body={"name": title},
    ).execute()
    doc_id = copied["id"]

    # Move to folder if specified
    if folder_id and folder_id != "root":
        drive.files().update(
            fileId=doc_id,
            addParents=folder_id,
            removeParents="root",
        ).execute()

    # Replace placeholders
    docs = build("docs", "v1", credentials=creds)
    replacements = _build_replacements(ai_data, company_name, consultant_name, price)
    requests = []
    for target, text in replacements.items():
        requests.append({
            "replaceAllText": {
                "containsText": {"text": target, "matchCase": False},
                "replaceText": text,
            }
        })
    docs.documents().batchUpdate(
        documentId=doc_id, body={"requests": requests}
    ).execute()

    return f"https://docs.google.com/document/d/{doc_id}/edit"


def _build_replacements(
    ai_data: dict, company_name: str, consultant_name: str, price: str
) -> dict[str, str]:
    import os
    from datetime import datetime

    # Support both new slides[] format and old flat fields
    slides = ai_data.get("slides", [])

    def _find_slide(slide_type):
        for s in slides:
            if s.get("type") == slide_type:
                return s
        return {}

    def _fmt_nodes(nodes, separator="\n\n"):
        parts = []
        for i, node in enumerate(nodes, 1):
            title = node.get("title", "")
            desc = node.get("desc", "")
            if title:
                parts.append(f"{i}. {title}\n{desc}")
        return separator.join(parts)

    def _fmt_items(items):
        return "\n".join(f"  \u2022 {item}" for item in items)

    # Extract from slides or fall back to old flat fields
    signal_slide = _find_slide("signal")
    signal_nodes = signal_slide.get("nodes", [])
    signal_intro = signal_slide.get("intro", "")
    if not signal_nodes:
        signal_intro = ai_data.get("problemIntro", "")
        signal_nodes = [
            {"title": ai_data.get(f"problemPoint{i}", ""), "desc": ai_data.get(f"problemDesc{i}", "")}
            for i in range(1, 6)
        ]

    architecture_slide = _find_slide("architecture")
    architecture_nodes = architecture_slide.get("nodes", [])
    architecture_intro = architecture_slide.get("intro", "")
    if not architecture_nodes:
        architecture_intro = ai_data.get("solutionIntro", "")
        architecture_nodes = [
            {"title": ai_data.get(f"solutionPoint{i}", ""), "desc": ai_data.get(f"solutionDesc{i}", "")}
            for i in range(1, 6)
        ]

    volume_slide = _find_slide("volume")
    scope_items = []
    for card in volume_slide.get("cards", []):
        if card.get("title"):
            scope_items.append(card["title"])

    timeline_slide = _find_slide("volume")
    timeline_items = timeline_slide.get("metrics", ai_data.get("timelineItems", []))
    if not timeline_items:
        timeline_items = _find_slide("tools").get("tools", [])
        timeline_items = [f"{t.get('role')}: {t.get('name')}" for t in timeline_items]

    try:
        clean = price.replace("$", "").replace(",", "").replace(" ", "")
        deposit_val = float(clean) / 2
        deposit = f"${deposit_val:,.2f}"
    except (ValueError, AttributeError):
        deposit = ""

    return {
        "{{companyName}}": company_name,
        "{{consultantName}}": consultant_name,
        "{{consultantEmail}}": os.environ.get("CONSULTANT_EMAIL", ""),
        "{{date}}": datetime.now().strftime("%B %d, %Y"),
        "{{proposalTitle}}": ai_data.get(
            "proposalTitle", f"Proposal for {company_name}"
        ),
        "{{problemSection}}": (
            f"{signal_intro}\n\n{_fmt_nodes(signal_nodes)}"
        ),
        "{{solutionSection}}": (
            f"{architecture_intro}\n\n{_fmt_nodes(architecture_nodes)}"
        ),
        "{{scopeSection}}": _fmt_items(scope_items),
        "{{timelineSection}}": _fmt_items(timeline_items),
        "{{price}}": price,
        "{{depositAmount}}": deposit,
    }
