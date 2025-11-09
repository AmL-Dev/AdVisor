# AdVisor Frontend 🎨

**Next.js Frontend for AI-Powered Ad Generation & Analysis**

Modern, responsive web interface for generating video advertisements with Google Veo 3 and analyzing them through multi-agent AI workflows with real-time visualization.

---

## 🎯 Overview

The AdVisor frontend is a Next.js 16 application featuring:

- **Modern UI/UX** with TailwindCSS 4
- **Real-time workflow visualization** using ReactFlow
- **Server-side rendering** with Next.js App Router
- **Type-safe** development with TypeScript
- **Interactive API routes** for backend orchestration
- **Responsive design** for all screen sizes

---

## 🏗️ Architecture

### Application Structure

```
Frontend (Next.js 16)
├── App Router (React 19)
│   ├── Server Components (RSC)
│   └── Client Components
├── API Routes (Backend Proxy)
│   ├── Video Generation
│   └── Workflow Orchestration
└── Static Assets
```

### Technology Stack

- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library with Server Components
- **TypeScript 5** - Type safety
- **TailwindCSS 4** - Utility-first styling
- **ReactFlow 11.11.4** - Workflow visualization
- **Mastra 0.18.0** - Workflow orchestration
- **Zod 3.25.76** - Runtime validation
- **@google/genai 1.29.0** - Google AI SDK

### Directory Structure

```
advisor/
├── app/
│   ├── analyze/
│   │   └── page.tsx                # Ad analysis page
│   │
│   ├── api/
│   │   ├── generate_add/
│   │   │   ├── route.ts            # Video generation endpoint
│   │   │   ├── confirm/
│   │   │   │   └── route.ts        # Confirm generation
│   │   │   └── utils.ts            # Generation utilities
│   │   │
│   │   └── workflows/
│   │       └── brand-alignment/
│   │           └── route.ts        # Workflow orchestration
│   │
│   ├── components/
│   │   ├── AdGenerator.tsx         # Video generation UI
│   │   ├── BrandWorkflowRunner.tsx # Workflow runner UI
│   │   └── WorkflowGraph.tsx       # ReactFlow graph
│   │
│   ├── favicon.ico                 # Site icon
│   ├── globals.css                 # Global styles
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Home page (generation)
│
├── public/                         # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .env.local                      # Environment variables (not in git)
├── .env.example                    # Environment template
├── eslint.config.mjs               # ESLint configuration
├── next-env.d.ts                   # Next.js types
├── next.config.ts                  # Next.js config
├── package.json                    # Dependencies
├── postcss.config.mjs              # PostCSS config
├── tsconfig.json                   # TypeScript config
└── README.md                       # This file
```

---

## 📋 Prerequisites

- **Node.js 18+** (20+ recommended)
- **npm** or **yarn** or **pnpm**
- **Backend API** running on port 8000

---

## 🚀 Setup

### 1. Install Dependencies

```bash
# Navigate to advisor directory
cd advisor

# Install with npm
npm install

# Or with yarn
yarn install

# Or with pnpm
pnpm install
```

**Installed packages:**

**Production:**
- `next@16.0.1` - React framework
- `react@19.2.0` - UI library
- `react-dom@19.2.0` - DOM bindings
- `@google/genai@1.29.0` - Google AI SDK
- `mastra@0.18.0` - Workflow engine
- `reactflow@11.11.4` - Graph visualization
- `zod@3.25.76` - Schema validation

**Development:**
- `typescript@5` - Type checking
- `tailwindcss@4` - CSS framework
- `eslint@9` - Linting
- `postcss@9` - CSS processing
- `@types/node`, `@types/react` - Type definitions

### 2. Configure Environment

Create `.env.local` file:

```bash
# Create file
touch .env.local  # Linux/Mac
type nul > .env.local  # Windows
```

**Add configuration:**

```env
# Backend API URL
# Point to where your FastAPI backend is running
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Alternative variable name (both work)
BACKEND_BASE_URL=http://localhost:8000

# Optional: Google Cloud for Veo 3 (if using generation)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 3. Start Development Server

```bash
npm run dev

# Or
yarn dev

# Or
pnpm dev
```

**Expected output:**

```
  ▲ Next.js 16.0.1
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Starting...
 ✓ Ready in 2.5s
```

### 4. Verify Installation

**Home Page:**
- Visit: http://localhost:3000
- Should show: Ad Generator interface

**Analysis Page:**
- Visit: http://localhost:3000/analyze
- Should show: Ad Analysis interface

**Backend Connection:**
- Check browser console for errors
- Should successfully connect to backend at port 8000

---

## 🎮 Pages & Features

### Home Page (`/`)

**Purpose:** Generate new video advertisements

**Features:**
- Brand information input (company, product, brief)
- Video generation prompt editor
- Veo 3 video generation
- Real-time generation status
- Video preview and download

**Usage:**
1. Fill in brand context
2. Enter video prompt
3. Click "Generate Ad"
4. Wait for generation (2-5 minutes)
5. View and download result

**Component:** `app/components/AdGenerator.tsx`

### Analysis Page (`/analyze`)

**Purpose:** Analyze existing video advertisements

**Features:**
- Video file upload with drag & drop
- Brand context input
- Logo and product image upload
- Real-time workflow visualization
- Comprehensive analysis reports
- Validation prompt generation

**Usage:**
1. Upload video file
2. Provide brand context
3. Upload brand logo
4. (Optional) Upload product image
5. Run analysis workflow
6. Review results and metrics

**Component:** `app/components/BrandWorkflowRunner.tsx`

### Workflow Visualization

**Features:**
- Interactive node graph with ReactFlow
- Real-time agent execution status
- Color-coded states:
  - **Gray**: Pending
  - **Yellow**: In progress
  - **Green**: Completed
  - **Red**: Failed
- Click nodes to view details
- Pan and zoom controls

**Component:** `app/components/WorkflowGraph.tsx`

---

## 🔌 API Routes

### Video Generation

#### POST /api/generate_add

Initiates video generation with Veo 3.

**Request Body:**
```typescript
{
  prompt: string;
  companyName?: string;
  productName?: string;
  briefPrompt?: string;
}
```

**Response:**
```typescript
{
  operationId: string;
  status: "processing";
  message: string;
}
```

#### POST /api/generate_add/confirm

Confirms video generation completion.

**Request Body:**
```typescript
{
  operationId: string;
}
```

**Response:**
```typescript
{
  status: "completed" | "processing" | "failed";
  videoBase64?: string;
  message?: string;
}
```

### Workflow Orchestration

#### POST /api/workflows/brand-alignment

Executes complete brand alignment analysis.

**Request Body:**
```typescript
{
  videoBase64: string;
  brandLogoBase64: string;
  productImageBase64?: string;
  brandContext: {
    companyName: string;
    productName: string;
    briefPrompt?: string;
  };
  originalPrompt?: string;
}
```

**Response:**
```typescript
{
  status: "completed" | "failed";
  executionTime: number;
  results: {
    advisor: {
      brandAlignment: number;
      visualQuality: number;
      toneAccuracy: number;
      validationPrompt: string;
      comprehensiveReport: string;
    };
    agentOutputs: {
      overallCritic: any;
      visualStyle: any;
      frameExtraction: any;
      logoDetection: any;
      colorHarmony: any;
      audioAnalysis: any;
      safetyEthics: any;
      messageClarity: any;
      synthesizer: any;
    };
  };
}
```

---

## 🎨 Styling

### TailwindCSS Configuration

**File:** `tailwind.config.ts` (generated from TailwindCSS 4)

**Custom Configuration:**
```typescript
// Example custom colors
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#FF5733',
        secondary: '#1A2B3C',
      }
    }
  }
}
```

### Global Styles

**File:** `app/globals.css`

```css
@import 'tailwindcss';
@import 'reactflow/dist/style.css';

/* Custom global styles */
:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}
```

### Component Styling

Components use utility classes:

```tsx
<div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
  <main className="container mx-auto px-4 py-8">
    <h1 className="text-4xl font-bold text-zinc-900">
      AdVisor
    </h1>
  </main>
</div>
```

---

## 🔧 Components

### AdGenerator Component

**File:** `app/components/AdGenerator.tsx`

**Purpose:** Video generation interface

**Key Features:**
- Form validation
- Video generation API calls
- Loading states
- Error handling
- Video preview

**Usage:**
```tsx
import AdGenerator from './components/AdGenerator';

export default function HomePage() {
  return <AdGenerator />;
}
```

### BrandWorkflowRunner Component

**File:** `app/components/BrandWorkflowRunner.tsx`

**Purpose:** Ad analysis interface

**Key Features:**
- File upload with validation
- Form input handling
- Workflow execution
- Results display
- Error handling

**Props:**
```typescript
interface BrandWorkflowRunnerProps {
  // No props - fully self-contained
}
```

### WorkflowGraph Component

**File:** `app/components/WorkflowGraph.tsx`

**Purpose:** Real-time workflow visualization

**Key Features:**
- ReactFlow integration
- Custom node styling
- Edge connections
- Interactive controls
- Status updates

**Props:**
```typescript
interface WorkflowGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
}
```

**Node Types:**
```typescript
type NodeStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

interface AgentNode {
  id: string;
  type: 'agent';
  data: {
    label: string;
    status: NodeStatus;
    output?: any;
    error?: string;
  };
  position: { x: number; y: number };
}
```

---

## 🧪 Testing

### Development Testing

1. **Start Backend:**
   ```bash
   cd ../backend
   source .venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   ```

3. **Test Features:**
   - Video upload/preview
   - Form validation
   - API calls
   - Workflow visualization
   - Error states

### Browser Testing

**Recommended browsers:**
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

**Responsive testing:**
- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x667

### Console Debugging

Open browser DevTools (F12) and check:

```javascript
// Check backend connection
console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);

// Test API call
fetch('http://localhost:8000/healthz')
  .then(r => r.json())
  .then(console.log);
```

---

## 🐛 Troubleshooting

### Build Errors

**Problem:** Build fails with TypeScript errors

**Solution:**
```bash
# Clear .next cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript config
npx tsc --noEmit
```

### Cannot Connect to Backend

**Problem:** API calls failing with CORS errors

**Solution:**

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/healthz
   ```

2. **Verify CORS settings in backend `.env`:**
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

3. **Check frontend `.env.local`:**
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

4. **Restart both services**

### ReactFlow Not Rendering

**Problem:** Workflow graph doesn't display

**Solution:**

1. **Check CSS import in `globals.css`:**
   ```css
   @import 'reactflow/dist/style.css';
   ```

2. **Clear browser cache** (Ctrl+Shift+R)

3. **Check browser console** for errors

4. **Verify ReactFlow version:**
   ```bash
   npm list reactflow
   # Should be 11.11.4
   ```

### File Upload Issues

**Problem:** Video upload fails or hangs

**Solutions:**

1. **Check file size:**
   ```javascript
   // Maximum ~50MB recommended
   if (file.size > 50 * 1024 * 1024) {
     alert('File too large');
   }
   ```

2. **Check file format:**
   ```javascript
   // Accept only MP4
   const acceptedFormats = ['video/mp4'];
   if (!acceptedFormats.includes(file.type)) {
     alert('Use MP4 format');
   }
   ```

3. **Convert if needed:**
   ```bash
   # Use ffmpeg to convert
   ffmpeg -i input.mov -c:v libx264 output.mp4
   ```

### Hydration Errors

**Problem:** React hydration mismatch warnings

**Solution:**

1. **Use client components** for interactive features:
   ```tsx
   'use client';
   
   export default function InteractiveComponent() {
     // ...
   }
   ```

2. **Avoid conditional rendering** based on client-side state in SSR

3. **Use `useEffect`** for client-only code:
   ```tsx
   useEffect(() => {
     // Client-only code
   }, []);
   ```

---

## ⚡ Performance Optimization

### Best Practices

1. **Use Server Components** (default in App Router)
2. **Lazy load heavy components:**
   ```tsx
   const WorkflowGraph = dynamic(
     () => import('./components/WorkflowGraph'),
     { ssr: false }
   );
   ```

3. **Optimize images:**
   ```tsx
   import Image from 'next/image';
   
   <Image
     src="/logo.png"
     width={200}
     height={100}
     alt="Logo"
   />
   ```

4. **Use React.memo** for expensive components:
   ```tsx
   const ExpensiveComponent = React.memo(({ data }) => {
     // ...
   });
   ```

### Build Optimization

```bash
# Production build with optimizations
npm run build

# Analyze bundle size
npm run build -- --profile
```

### Caching Strategy

```typescript
// In API routes
export const runtime = 'edge'; // Use Edge Runtime
export const revalidate = 60; // Revalidate every 60s
```

---

## 🚢 Production Deployment

### Build for Production

```bash
# Create optimized production build
npm run build

# Test production build locally
npm start
```

### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables on Vercel:**
1. Go to Project Settings
2. Add `NEXT_PUBLIC_BACKEND_URL`
3. Set to your production backend URL
4. Redeploy

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
```

**Build and run:**
```bash
docker build -t advisor-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_BACKEND_URL=http://backend:8000 \
  advisor-frontend
```

### Environment Variables in Production

```env
# Production backend URL
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## 🎨 Customization

### Branding

Update colors in `app/globals.css`:

```css
:root {
  --brand-primary: #FF5733;
  --brand-secondary: #1A2B3C;
}
```

### Layout

Modify `app/layout.tsx`:

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav>{/* Custom navigation */}</nav>
        {children}
        <footer>{/* Custom footer */}</footer>
      </body>
    </html>
  );
}
```

### Metadata

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: 'Your Brand - AdVisor',
  description: 'AI-powered ad analysis',
  icons: {
    icon: '/favicon.ico',
  },
};
```

---

## 🤝 Contributing

### Development Workflow

1. **Fork repository**
2. **Create feature branch:**
   ```bash
   git checkout -b feature/new-component
   ```
3. **Make changes**
4. **Test thoroughly:**
   ```bash
   npm run build  # Ensure builds
   npm run lint   # Check linting
   ```
5. **Commit:**
   ```bash
   git commit -m "Add new component"
   ```
6. **Push and create PR**

### Code Style

- Use **TypeScript** for all components
- Follow **React best practices**
- Use **functional components** with hooks
- Add **prop types** for all components
- Use **TailwindCSS** for styling (no CSS modules)

### Adding New Pages

1. **Create page file:**
   ```bash
   mkdir -p app/newpage
   touch app/newpage/page.tsx
   ```

2. **Define page component:**
   ```tsx
   export default function NewPage() {
     return (
       <div>
         <h1>New Page</h1>
       </div>
     );
   }
   ```

3. **Add metadata:**
   ```tsx
   export const metadata = {
     title: 'New Page - AdVisor',
   };
   ```

4. **Link from navigation:**
   ```tsx
   import Link from 'next/link';
   
   <Link href="/newpage">New Page</Link>
   ```

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [ReactFlow Documentation](https://reactflow.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 📝 License

MIT License - see [LICENSE](../LICENSE) file

---

## 📞 Support

- **Main README:** See [../README.md](../README.md)
- **Backend Docs:** See [../backend/README.md](../backend/README.md)
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

**Built with Next.js 16, React 19, and ❤️**
