// ⚠️  dotenv MUST be the very first import + call, before ANY local module imports.
// In CommonJS, imported modules are evaluated immediately (synchronously) at require()
// time — meaning api.ts, supabaseAdmin.ts, etc. all run their top-level code BEFORE
// execution returns here. If dotenv.config() is called after those imports, env vars
// are undefined when those modules initialize their Supabase clients.
import dotenv from 'dotenv';
dotenv.config();

// ── Third-party ───────────────────────────────────────────────────────────────
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ── Local modules (env vars are populated by this point) ──────────────────────
import { setupApiRoutes } from './routes/api';
import { agentRoutes } from './routes/agents';
import { setupSocketHandlers } from './sockets/cognitiveStream';
import { setupGoogleAuthRoutes } from './integrations/google';

// 🛑 Strict Fail-Fast Environment Check for AI API
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ FATAL ERROR: GEMINI_API_KEY is missing from the environment variables.');
  process.exit(1); // Crash the Node process immediately
}

const app = express();
const server = http.createServer(app);

// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// ROUTING & WEBSOCKETS
// ============================================================================

// Mount REST API, Agents, and Google Auth Integrations
app.use('/api', apiLimiter, setupApiRoutes());
app.use('/api/agents', agentRoutes);
app.use('/auth', setupGoogleAuthRoutes());

// Initialize Socket.io with matching CORS policy
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

setupSocketHandlers(io);

// ============================================================================
// BOOTSTRAP
// ============================================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`[NeuroAdaptive OS] Backend securely running on port ${PORT}`);
  console.log(`[NeuroAdaptive OS] Accepting WebSocket connections from ${CLIENT_URL}`);
});