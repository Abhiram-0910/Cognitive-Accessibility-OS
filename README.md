🧠 NeuroAdaptive Intelligence Infrastructure

A Personal Cognitive Infrastructure for Neurodivergent Humans.
An agentic, privacy-first Cognitive Operating System designed to dynamically orchestrate the digital environment for professionals with ADHD, Autism, and Dyslexia.

🛑 The Problem Statement & The Reality Gap
There is a $1.2 Trillion neurodiversity productivity gap in the global economy. Modern enterprise tools and workplaces are fundamentally built for neurotypical cognition. They demand constant context-switching, rely on implicit subtext, and bombard users with visual noise. For neurodivergent professionals, this environment causes severe executive dysfunction, masking fatigue, and inevitable burnout.

The Cognitive Crash Scenario:
Imagine an Autistic or ADHD software engineer deep in a state of hyperfocus. Suddenly, a vague Slack message arrives: "Can we talk about the Jira ticket?" Instantly, Rejection Sensitive Dysphoria (RSD) spikes. They switch contexts to Jira, which is visually overwhelming and poorly structured. Working memory fails as they try to remember what was promised in last week's thread. The friction of decomposing the vague request into actionable steps is too high. Paralysis sets in. A highly capable mind crashes—not from a lack of skill, but from a hostile digital environment.

💡 Existing Solutions vs. Our Innovation

The Fragmented Status Quo:
Current "accessibility" tools are drastically insufficient.
- Standard OS features only offer superficial UI tweaks (font sizes, dark mode).
- Point solutions like Otter.ai or Goblin Tools are fragmented, requiring users to manually copy/paste text back and forth, breaking flow state.
- Corporate accommodations require medical disclosure, forcing employees to undergo stigmatizing HR processes just to function.

The NeuroAdaptive Innovation:
We do not treat neurodivergence as a deficit to be fixed; we treat it as a cognitive variation to be amplified.
Our OS provides real-time cross-app orchestration combined with zero-disclosure dignity. Users do not need a medical diagnosis. The OS uses local edge-ML to silently read biometric stress, deploying AI agents directly into Jira and Slack via a shadow DOM extension to sanitize the environment before the user becomes overwhelmed.

🎯 Value Proposition (What is the Use of Our Application?)
The NeuroAdaptive OS acts as a Real-Time Cognitive Co-Processor. It serves as an invisible buffer between the user and the corporate world. It proactively shields focus, translates passive-aggressive or vague communication into clear action items, offloads fragile working memory into a vector database, and predicts/prevents burnout automatically based on biometric telemetry.

✨ Exhaustive Feature List
🔒 Privacy-First Edge ML (Zero-Trust Telemetry)
- Keystroke Dynamics: Local DOM monitoring for error rates, typing velocity, and pause frequencies.
- MediaPipe FaceMesh: GPU-accelerated gaze tracking and facial tension analysis to detect masking and stress.
- Web Speech API: Pitch and speech-rate biomarker analysis via a secure Web Audio AudioContext singleton.

🤖 The 10 Gemini AI Agents (LangChain Orchestrated)
1. Communication Translator (Inbound): Decodes vague corporate jargon and passive-aggressiveness into clear intent.
2. Communication Translator (Outbound): Polishes blunt, direct neurodivergent thoughts into polite corporate phrasing.
3. Momentum Architect (Micro-Tasker): Deconstructs paralyzing epics into 5-minute dopamine-driven steps.
4. Prosthetic Memory Agent (RAG): Answers "What did I promise?" using pgvector.
5. Social Decoder: Identifies workplace subtext and unwriten rules.
6. Burnout Forecaster: 7-day predictive analytics engine.
7. Sensory Equalizer: Uses Gemini 1.5 Pro Vision to sanitize visually chaotic webpages.
8. Recruitment Ally: Reframes non-traditional career paths into high-value resume strength.
9. Regulation Companion: Passive distress monitor triggering interventions.
10. Community Agent: Federated learning logic to safely aggregate anonymous neuro-patterns.

🌐 Environmental Orchestration (Chrome Manifest V3)
- Semantic DOM Walkers: Injects native React UI directly into enterprise tools without breaking their fragile class names.
- Jira Interceptor: "Decompose for NeuroAdapt" button injected into Jira tickets.
- Slack Restructurer: Instantly converts chaotic threads into structured visual mind maps.

🧠 Prosthetic Working Memory
- Context Continuity: Supabase pgvector indexing of transcripts and commitments.
- Semantic Search: Natural language querying to bypass ADHD object permanence / working memory deficits.

🎨 Advanced UI/UX Polish
- Cognitive State Orb: A 3D, physics-driven Framer Motion element that physically tilts towards the user's cursor.
- Hyperfocus Capsule: A visually isolated deep-work UI logging flow-state insights.
- Time Blindness Correction: Machine learning algorithm multiplying user time estimates by historical inaccuracy (e.g., 1.5x).

🏥 Health & Enterprise Community
- Body Doubling Marketplace: Deterministic WebRTC (Jitsi) presence lobby for instant virtual co-working.
- Clinical PDF Export: html2canvas + jsPDF reporting for therapists/ADHD coaches.
- Manager DEI Dashboard: B2B enterprise view proving ROI through reduced burnout and lower turnover.
- Global Crisis Mode: Full-screen emergency DOM override with 432Hz grounding audio when load score exceeds 90.

🏗️ Technical Architecture & Complete Tech Stack
This platform is a robust, fail-fast, distributed system separating LLM orchestration from edge-presentation.
- Frontend Framework: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion (Spring Physics), Zustand (Global State).
- Backend Infrastructure: Node.js, Express, rate-limiting, Helmet security.
- Real-Time Data: Socket.io (Biometric Telemetry Streaming), Server-Sent Events (SSE) for LangChain streaming.
- Database & Auth: Supabase Auth, PostgreSQL, pgvector (Embeddings), Supabase Realtime (WebSockets for Body Doubling).
- AI & Machine Learning: Google Gemini 1.5 Pro & Flash (LangChain @langchain/google-genai), TensorFlow.js (Edge-ML scoring algorithm), MediaPipe (Local facial biometrics)
- Browser Extension: Chrome Manifest V3, Service Workers, Content Scripts, Semantic MutationObservers, Isolated Shadow DOMs (content.css).

🚀 How to Use / Getting Started

1. Environment Setup
Clone the repository and set up your keys. You need two environment files:

/server/.env (Backend):
PORT=3000
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=your_google_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_string

/.env.local (Frontend):
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:3000/api

2. Booting the Infrastructure
Start the backend orchestration layer:
cd server
npm install
npm run build
npm start

Start the Vite React client:
# In the project root
npm install
npm run dev

3. The Chrome Extension:

1. Open Chrome and navigate to chrome://extensions/.
2. Toggle Developer mode on.
3. Click Load unpacked and select the /extension directory from the repository.

4. The User Journey:

1. Zero-Disclosure Onboarding: Create an account. No medical diagnosis required. Set your sensory preferences.
2. Permissions Gate: The OS will politely request camera/mic access for edge-ML calculation (all processed locally).
3. The Dashboard: View your live Cognitive State Orb.
4. Trigger an Agent: Paste an overwhelming block of text into the Communication Translator or use the Momentum Architect to break down a paralyzing task.
5. Cross-App Sync: Open a mocked Jira or Slack instance and watch the Manifest V3 extension inject the NeuroAdaptive UI natively into the page based on your secure Dashboard auth state.

🚨 Hacks & Demo Modes (Judges Only)
The Simulated Demo Trigger: Biometric data takes days to become predictive. During the live pitch, navigate to the Dashboard and press Ctrl + Shift + D.
This hidden hook instantly bypasses the ML lock, injects 7 days of realistic mathematical telemetry directly into Supabase, and forces the Recharts/UI to dynamically explode with data, bleeding the orb from Green (Optimal) to Red (Overload).