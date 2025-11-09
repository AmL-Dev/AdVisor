# AdVisor Backend

FastAPI backend exposing AI agents for brand alignment critique workflows.

## Setup

1. **Activate virtual environment** (using uv):
   ```bash
   uv venv
   .venv\Scripts\activate  # Windows
   # or
   source .venv/bin/activate  # Linux/Mac
   ```

2. **Install dependencies**:
   ```bash
   uv pip install -r ../requirements.txt
   ```

3. **Set environment variables**:
   Create a `.env` file in the backend directory (or parent directory):
   ```
   GOOGLE_API_KEY=your_api_key_here
   LOG_LEVEL=INFO
   ALLOWED_ORIGINS=http://localhost:3000
   ```

4. **Run the server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Endpoints

- `GET /healthz` - Health check
- `POST /agents/overall-critic` - Execute overall critic agent

## Development

The backend uses:
- FastAPI for the web framework
- Google GenAI SDK for Gemini integration
- Pydantic for data validation
- Uvicorn as the ASGI server

