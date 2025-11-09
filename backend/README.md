# AdVisor Backend 🔧

**FastAPI Backend for Multi-Agent Brand Alignment Critique**

High-performance Python backend that orchestrates 8+ specialized AI agents for comprehensive video advertisement analysis using Google Gemini 2.0, OpenCV, CLIP, and scikit-learn.

---

## 🎯 Overview

The AdVisor backend is a FastAPI-based service that provides:

- **RESTful API** endpoints for all AI agents
- **Multi-modal AI analysis** via Google Gemini 2.0
- **Computer vision processing** with OpenCV
- **Logo detection** using CLIP and template matching
- **Color analysis** with K-means clustering
- **Type-safe data validation** using Pydantic
- **Async request handling** for optimal performance

---

## 🏗️ Architecture

### Agent System

```
┌─────────────────────────────────────────────────────┐
│              FastAPI Application Layer               │
│  (API Routes, Request Validation, Error Handling)   │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────┐
│              Agent Orchestration Layer               │
│    (Workflow Management, Data Flow Coordination)    │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────────┐
│  Computer   │ │  Gemini  │ │  External    │
│  Vision     │ │  Agents  │ │  Services    │
│  Agents     │ │          │ │              │
├─────────────┤ ├──────────┤ ├──────────────┤
│ • Frame     │ │ • Overall│ │ • Gemini API │
│   Extractor │ │   Critic │ │ • Vertex AI  │
│ • Logo      │ │ • Visual │ │ • CLIP Model │
│   Detector  │ │   Style  │ └──────────────┘
│ • Color     │ │ • Audio  │
│   Harmony   │ │ • Safety │
└─────────────┘ │ • Message│
                │ • Advisor│
                └──────────┘
```

### Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # Configuration management
│   │
│   ├── agents/                    # AI agent implementations
│   │   ├── __init__.py
│   │   ├── advisor_agent.py       # Final aggregation & validation prompts
│   │   ├── audio_analysis.py      # Multi-modal audio analysis (Gemini)
│   │   ├── color_harmony.py       # K-means color clustering & HEX extraction
│   │   ├── frame_extractor.py     # OpenCV video frame extraction
│   │   ├── logo_detector.py       # CLIP + OpenCV logo detection
│   │   ├── message_clarity.py     # Message effectiveness evaluation
│   │   ├── overall_critic.py      # High-level brand critique
│   │   ├── safety_ethics.py       # Safety & ethical compliance
│   │   ├── synthesizer.py         # Brand alignment aggregation
│   │   ├── video_generator.py     # Veo 3 video generation
│   │   ├── video_prompt.py        # Prompt engineering
│   │   └── visual_style.py        # Visual style analysis
│   │
│   ├── api/                       # API route handlers
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── agents.py          # Agent endpoint definitions
│   │
│   ├── schemas/                   # Pydantic data models
│   │   ├── __init__.py
│   │   ├── critique.py            # All critique-related schemas
│   │   └── video.py               # Video-related schemas
│   │
│   └── services/                  # External service clients
│       ├── __init__.py
│       └── gemini.py              # Gemini API client wrapper
│
└── README.md                      # This file
```

---

## 📋 Prerequisites

- **Python 3.10+** (3.11 recommended)
- **pip** or **uv** for package management
- **Google API Key** for Gemini access
- **System dependencies** for OpenCV:
  - Linux: `libgl1-mesa-glx`, `libglib2.0-0`
  - Mac: Usually works out of the box
  - Windows: Usually works out of the box

---

## 🚀 Setup

### 1. Create Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Or using uv (faster)
uv venv
```

### 2. Activate Virtual Environment

**Windows PowerShell:**
```powershell
.venv\Scripts\Activate.ps1
```

**Windows CMD:**
```cmd
.venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
# Using pip
pip install -r ../../requirements.txt

# Or using uv (much faster)
uv pip install -r ../../requirements.txt
```

**Installed packages:**
- `fastapi` - Web framework
- `google-genai` - Google Gemini AI SDK
- `numpy` - Numerical computing
- `opencv-python` - Computer vision
- `python-dotenv` - Environment variables
- `pydantic-settings` - Settings management
- `scikit-learn` - Machine learning (K-means)
- `uvicorn[standard]` - ASGI server

### 4. Configure Environment

Create `.env` file in `backend/` directory:

```env
# ============================================
# REQUIRED: Google Gemini API Key
# ============================================
GOOGLE_API_KEY=your_google_gemini_api_key

# ============================================
# OPTIONAL: Server Configuration
# ============================================
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# ============================================
# OPTIONAL: Agent Dummy Modes
# Set to "true" to skip AI calls (testing)
# ============================================
USE_DUMMY_OVERALL_CRITIC=false
USE_DUMMY_VISUAL_STYLE=false
USE_DUMMY_AUDIO_ANALYSIS=false
USE_DUMMY_SYNTHESIZER=false
USE_DUMMY_SAFETY_ETHICS=false
USE_DUMMY_MESSAGE_CLARITY=false
USE_DUMMY_ADVISOR=false

# ============================================
# OPTIONAL: Google Cloud (for Veo 3)
# ============================================
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 5. Run the Server

```bash
# Development mode (auto-reload on file changes)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 6. Verify Installation

**Health Check:**
```bash
curl http://localhost:8000/healthz
# Expected: {"status":"ok"}
```

**API Documentation:**
Visit http://localhost:8000/docs

---

## 🔌 API Endpoints

### Health & Status

#### GET /healthz

Basic health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

### Agent Endpoints

All agent endpoints use POST requests with JSON payloads.

#### POST /agents/overall-critic

High-level brand alignment critique.

**Request:**
```json
{
  "videoBase64": "data:video/mp4;base64,...",
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone 16 Pro",
    "briefPrompt": "Focus on camera"
  }
}
```

**Response:**
```json
{
  "report": {
    "brandAlignment": 0.85,
    "strengths": ["Clear visibility"],
    "weaknesses": ["Logo duration short"],
    "recommendations": ["Extend logo visibility"]
  },
  "prompt": "System prompt used...",
  "model": "gemini-2.0-flash-exp",
  "warnings": []
}
```

#### POST /agents/frame-extraction

Extract frames from video using OpenCV.

**Request:**
```json
{
  "videoBase64": "data:video/mp4;base64,...",
  "numFrames": 8
}
```

**Response:**
```json
{
  "frames": [
    {
      "frameIndex": 0,
      "timestamp": 0.0,
      "imageBase64": "data:image/jpeg;base64,..."
    }
  ],
  "totalFrames": 8,
  "videoInfo": {
    "fps": 30.0,
    "duration": 8.0,
    "width": 1920,
    "height": 1080
  }
}
```

#### POST /agents/logo-detection

Detect brand logo using CLIP + OpenCV template matching.

**Request:**
```json
{
  "frames": [/* ExtractedFrame objects */],
  "brandLogoBase64": "data:image/png;base64,...",
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone"
  }
}
```

**Response:**
```json
{
  "detections": [
    {
      "frameIndex": 2,
      "confidence": 0.92,
      "boundingBox": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 80
      },
      "method": "clip_similarity",
      "croppedLogoBase64": "data:image/jpeg;base64,..."
    }
  ],
  "summary": {
    "totalDetections": 3,
    "averageConfidence": 0.89,
    "logoVisibilityDuration": 3.5
  }
}
```

#### POST /agents/color-harmony

Analyze color palette using K-means clustering.

**Request:**
```json
{
  "frames": [/* ExtractedFrame objects */],
  "brandLogoBase64": "data:image/png;base64,...",
  "detectedLogos": [/* DetectedLogo objects */],
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone"
  }
}
```

**Response:**
```json
{
  "report": {
    "videoPalette": {
      "colors": ["#1A2B3C", "#FF5733", "#FFFFFF"],
      "distribution": [0.35, 0.25, 0.20]
    },
    "logoPalette": {
      "colors": ["#FF5733", "#1A2B3C"],
      "distribution": [0.60, 0.40]
    },
    "colorHarmonyScore": 0.87,
    "matchedColors": ["#FF5733", "#1A2B3C"],
    "analysis": "Strong color alignment..."
  }
}
```

#### POST /agents/audio-analysis

Analyze audio using Gemini multi-modal input.

**Request:**
```json
{
  "videoBase64": "data:video/mp4;base64,...",
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone",
    "briefPrompt": "Premium tone"
  }
}
```

**Response:**
```json
{
  "report": {
    "audioQuality": 0.90,
    "brandVoiceAlignment": 0.85,
    "musicStyle": "Minimal electronic",
    "toneOfVoice": "Professional",
    "analysis": "Audio matches premium positioning..."
  }
}
```

#### POST /agents/safety-ethics

Evaluate safety and ethical compliance.

**Request:**
```json
{
  "videoBase64": "data:video/mp4;base64,...",
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone"
  }
}
```

**Response:**
```json
{
  "report": {
    "safetyScore": 1.0,
    "violations": [],
    "concerns": [],
    "categories": {
      "harmfulContent": "pass",
      "stereotypes": "pass",
      "misleadingClaims": "pass"
    }
  }
}
```

#### POST /agents/message-clarity

Evaluate message effectiveness.

**Request:**
```json
{
  "videoBase64": "data:video/mp4;base64,...",
  "brandContext": {
    "companyName": "Apple",
    "productName": "iPhone",
    "briefPrompt": "Highlight camera"
  }
}
```

**Response:**
```json
{
  "report": {
    "clarityScore": 0.88,
    "productVisibility": 0.92,
    "messageEffectiveness": 0.85,
    "keyMessagesDelivered": ["Camera quality"],
    "improvements": ["Add explicit CTA"]
  }
}
```

#### POST /agents/synthesizer

Aggregate brand alignment results.

**Request:**
```json
{
  "brandContext": {/* ... */},
  "overallCriticReport": {/* ... */},
  "visualStyleReport": {/* ... */},
  "audioAnalysisReport": {/* ... */},
  "logoDetectionReport": {/* ... */},
  "colorHarmonyReport": {/* ... */}
}
```

**Response:**
```json
{
  "report": {
    "aggregatedBrandAlignment": 0.86,
    "keyFindings": ["Strong visual alignment"],
    "priorityIssues": ["Audio could be more premium"],
    "overallRecommendation": "Ready with minor tweaks"
  }
}
```

#### POST /agents/advisor

Generate comprehensive final report with validation prompt.

**Request:**
```json
{
  "brandContext": {/* ... */},
  "synthesizerReport": {/* ... */},
  "safetyEthicsReport": {/* ... */},
  "messageClarityReport": {/* ... */},
  "brandAlignmentReport": {/* ... */},
  "originalPrompt": "Original prompt..."
}
```

**Response:**
```json
{
  "report": {
    "brandAlignment": 0.86,
    "visualQuality": 0.90,
    "toneAccuracy": 0.82,
    "violations": [],
    "offBrandElements": ["Audio tone slightly casual"],
    "comprehensiveReport": "Full analysis...",
    "justifications": {
      "brandAlignment": "Logo visible 3.5s...",
      "visualQuality": "Professional composition...",
      "toneAccuracy": "Mostly aligned..."
    },
    "validationPrompt": "Ensure premium audio tone..."
  },
  "validationPrompt": "Ensure premium audio tone...",
  "warnings": []
}
```

---

## 🧠 Agent Deep Dive

### Logo Detector Agent

**File:** `app/agents/logo_detector.py`

**Technologies:**
- OpenCV for template matching
- CLIP (optional) for semantic similarity
- NumPy for numerical operations

**Algorithm:**

1. **Multi-Scale Template Matching**
   ```python
   # Test multiple scales (20% to 200%)
   for scale in [0.2, 0.5, 1.0, 1.5, 2.0]:
       resized_logo = cv2.resize(brand_logo, scale)
       result = cv2.matchTemplate(
           frame, 
           resized_logo, 
           cv2.TM_CCOEFF_NORMED
       )
       confidence = result.max()
   ```

2. **CLIP Similarity (Fallback)**
   ```python
   # If transformers available
   clip_score = compute_clip_similarity(
       frame_embedding, 
       logo_embedding
   )
   ```

3. **Bounding Box Extraction**
   - Locates logo position in frame
   - Extracts cropped logo image
   - Computes confidence score

**Performance:**
- ~1-2 seconds per frame
- Confidence threshold: 0.6
- Returns top detections per frame

### Color Harmony Agent

**File:** `app/agents/color_harmony.py`

**Technologies:**
- scikit-learn K-means clustering
- OpenCV color conversion
- NumPy for color distance calculations

**Algorithm:**

1. **Color Extraction**
   ```python
   # Sample pixels from image
   pixels = image.reshape(-1, 3)[:10000]
   
   # K-means clustering (5 clusters)
   kmeans = KMeans(n_clusters=5, random_state=42)
   kmeans.fit(pixels)
   
   # Get dominant colors
   dominant_colors = kmeans.cluster_centers_
   ```

2. **HEX Conversion**
   ```python
   def rgb_to_hex(r, g, b):
       return f"#{r:02x}{g:02x}{b:02x}".upper()
   ```

3. **Palette Comparison**
   ```python
   # Calculate color distance
   def color_distance(color1, color2):
       return np.sqrt(np.sum((color1 - color2) ** 2))
   
   # Match brand colors to video colors
   for brand_color in brand_palette:
       distances = [
           color_distance(brand_color, video_color)
           for video_color in video_palette
       ]
       closest = min(distances)
   ```

**Performance:**
- ~3-5 seconds for full video
- Analyzes 5 dominant colors per frame
- Samples 10,000 pixels per frame for efficiency

### Audio Analysis Agent

**File:** `app/agents/audio_analysis.py`

**Technologies:**
- Google Gemini multi-modal API
- Native audio understanding (no extraction needed)

**Process:**

1. **Video Upload to Gemini**
   - Sends full video file (includes audio)
   - Gemini natively processes audio track

2. **Analysis Prompt**
   ```python
   prompt = f"""
   Analyze the audio in this advertisement video for {brand_name}.
   Evaluate:
   1. Tone of voice (if narration present)
   2. Music style and mood
   3. Sound effects appropriateness
   4. Brand voice alignment
   5. Audio quality
   """
   ```

3. **Structured Output**
   - Parses Gemini response to JSON
   - Extracts scores and analysis
   - Returns detailed audio report

**Performance:**
- ~5-15 seconds per video
- Depends on Gemini API latency
- Can enable dummy mode for testing

### Frame Extractor Agent

**File:** `app/agents/frame_extractor.py`

**Technologies:**
- OpenCV VideoCapture
- Base64 encoding/decoding

**Process:**

1. **Video Decoding**
   ```python
   # Decode base64 to bytes
   video_bytes = base64.b64decode(video_base64)
   
   # Write to temp file
   with tempfile.NamedTemporaryFile(suffix='.mp4') as f:
       f.write(video_bytes)
       
       # Open with OpenCV
       cap = cv2.VideoCapture(f.name)
   ```

2. **Frame Extraction**
   ```python
   total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
   fps = cap.get(cv2.CAP_PROP_FPS)
   
   # Extract N evenly-spaced frames
   frame_indices = np.linspace(0, total_frames-1, num_frames)
   
   for idx in frame_indices:
       cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
       ret, frame = cap.read()
       
       # Encode to JPEG base64
       _, buffer = cv2.imencode('.jpg', frame)
       frame_base64 = base64.b64encode(buffer).decode()
   ```

**Performance:**
- ~1-2 seconds per video
- Extracts 8 frames by default
- Returns metadata (FPS, duration, resolution)

---

## ⚙️ Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `GOOGLE_API_KEY` | string | **required** | Google Gemini API key |
| `LOG_LEVEL` | string | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `ALLOWED_ORIGINS` | string | `*` | CORS allowed origins (comma-separated) |
| `USE_DUMMY_*` | boolean | `false` | Enable dummy mode for specific agents |
| `GOOGLE_CLOUD_PROJECT_ID` | string | optional | GCP project ID for Veo 3 |
| `GOOGLE_CLOUD_LOCATION` | string | `us-central1` | GCP region for Veo 3 |

### Dummy Mode

Enable dummy mode to skip AI API calls during development:

```env
USE_DUMMY_OVERALL_CRITIC=true
USE_DUMMY_VISUAL_STYLE=true
USE_DUMMY_AUDIO_ANALYSIS=true
USE_DUMMY_SYNTHESIZER=true
USE_DUMMY_SAFETY_ETHICS=true
USE_DUMMY_MESSAGE_CLARITY=true
USE_DUMMY_ADVISOR=true
```

Agents will return mock data instead of making real API calls, saving credits.

### CORS Configuration

For production, specify allowed origins:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 🧪 Testing

### Manual Testing

1. **Start Server:**
   ```bash
   uvicorn app.main:app --reload
   ```

2. **Visit API Docs:**
   http://localhost:8000/docs

3. **Try Endpoints:**
   - Use interactive Swagger UI
   - Test with sample data

### cURL Examples

**Health Check:**
```bash
curl http://localhost:8000/healthz
```

**Overall Critic:**
```bash
curl -X POST http://localhost:8000/agents/overall-critic \
  -H "Content-Type: application/json" \
  -d '{
    "videoBase64": "data:video/mp4;base64,AAAA...",
    "brandContext": {
      "companyName": "Test",
      "productName": "Product"
    }
  }'
```

### Python Testing

```python
import requests

# Test health check
response = requests.get("http://localhost:8000/healthz")
print(response.json())  # {"status": "ok"}

# Test overall critic
response = requests.post(
    "http://localhost:8000/agents/overall-critic",
    json={
        "videoBase64": "data:video/mp4;base64,...",
        "brandContext": {
            "companyName": "Apple",
            "productName": "iPhone"
        }
    }
)
print(response.json())
```

---

## 🐛 Troubleshooting

### Import Errors

**Problem:** `ModuleNotFoundError: No module named 'app'`

**Solution:**
```bash
# Ensure you're in backend/ directory
pwd  # Should show: .../backend

# Ensure venv is activated
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r ../../requirements.txt
```

### OpenCV Issues

**Problem:** `ImportError: libGL.so.1: cannot open shared object file`

**Solution (Linux):**
```bash
sudo apt-get update
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0
```

**Solution (Docker):**
```dockerfile
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0
```

### API Key Errors

**Problem:** `GOOGLE_API_KEY not found`

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Check .env contains key
cat .env | grep GOOGLE_API_KEY

# Add if missing
echo "GOOGLE_API_KEY=your_key" >> .env

# Restart server
```

### Port Already in Use

**Problem:** `[ERROR] [Errno 98] Address already in use`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000  # Linux/Mac
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows

# Or use different port
uvicorn app.main:app --port 8001
```

### Slow Agent Execution

**Problem:** Agents taking too long

**Solutions:**

1. **Enable Dummy Mode (Development):**
   ```env
   USE_DUMMY_AUDIO_ANALYSIS=true
   ```

2. **Reduce Frame Count:**
   ```python
   # In frame extraction request
   {"numFrames": 4}  # Instead of 8
   ```

3. **Check API Latency:**
   ```bash
   # Monitor Gemini API response times
   # Enable DEBUG logging
   LOG_LEVEL=DEBUG
   ```

---

## 📊 Performance Optimization

### Best Practices

1. **Use Async Endpoints** (already implemented)
2. **Enable Caching** for repeated analyses
3. **Reduce Frame Count** for faster processing
4. **Use Dummy Mode** during development
5. **Implement Rate Limiting** in production

### Monitoring

Add logging to track performance:

```python
import logging
import time

logger = logging.getLogger(__name__)

def run_agent(request):
    start = time.time()
    result = execute_analysis(request)
    duration = time.time() - start
    
    logger.info(f"Agent completed in {duration:.2f}s")
    return result
```

---

## 🚢 Production Deployment

### Using Gunicorn + Uvicorn Workers

```bash
# Install gunicorn
pip install gunicorn

# Run with multiple workers
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app ./app

# Run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build and Run:**
```bash
docker build -t advisor-backend .
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=xxx \
  advisor-backend
```

### Environment Variables in Production

```env
# Production settings
LOG_LEVEL=WARNING
ALLOWED_ORIGINS=https://yourdomain.com
USE_DUMMY_*=false
```

---

## 🤝 Contributing

### Development Setup

1. **Fork repository**
2. **Clone your fork**
3. **Create feature branch**
4. **Install dev dependencies**
5. **Make changes**
6. **Test thoroughly**
7. **Submit PR**

### Code Style

- Follow **PEP 8** style guide
- Use **type hints** for all functions
- Add **docstrings** to all modules/functions
- Keep functions focused and testable

### Adding New Agents

1. **Create agent file** in `app/agents/`
2. **Define request/response schemas** in `app/schemas/`
3. **Add endpoint** in `app/api/routes/agents.py`
4. **Add tests**
5. **Update documentation**

**Example Agent Template:**

```python
"""
New agent description.
"""
from app.schemas.critique import NewAgentRequest, NewAgentResult
from app.services.gemini import get_genai_client

def run_new_agent(request: NewAgentRequest) -> NewAgentResult:
    """Execute the new agent."""
    client = get_genai_client()
    
    # Build prompt
    prompt = build_prompt(request)
    
    # Call Gemini
    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[{"role": "user", "parts": [{"text": prompt}]}]
    )
    
    # Parse response
    result = parse_response(response)
    
    return NewAgentResult(
        report=result,
        prompt=prompt
    )
```

---

## 📝 License

MIT License - see [LICENSE](../LICENSE) file

---

## 📞 Support

- **Documentation:** See main [README](../README.md)
- **API Docs:** http://localhost:8000/docs
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

**Built with FastAPI, Google Gemini 2.0, OpenCV, and ❤️**
