import { Server, Socket } from 'socket.io';

interface CognitivePayload {
  userId: string;
  score: number;
  classification: string;
  context_switches: number;
  timestamp: string;
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join specific rooms based on roles (e.g., 'manager_dashboard' vs 'user_session')
    socket.on('join_room', (room: string) => {
      socket.join(room);
      console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
    });

    // Ingest the 5-second interval telemetry from the useCognitiveMonitor hook
    socket.on('ingest_cognitive_state', (payload: CognitivePayload) => {
      // In a production environment, you might buffer this in Redis before batch-inserting 
      // to Postgres to save database I/O. For the hackathon, we stream it directly to listeners.
      
      // Broadcast to the anonymized aggregation room (B2B Dashboard)
      // Note: We strip the userId here to maintain strict privacy at the socket distribution level
      io.to('manager_dashboard').emit('anonymized_telemetry_update', {
        score: payload.score,
        classification: payload.classification,
        timestamp: payload.timestamp
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};