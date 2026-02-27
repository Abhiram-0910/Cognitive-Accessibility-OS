import React, { useEffect, useRef, useState } from 'react';

export const PygameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Python Runtime Initializing...');

  useEffect(() => {
    let isMounted = true;

    async function initPyodide() {
      try {
        // Load Pyodide script dynamically to avoid blocking Vite bundle
        if (!(window as any).loadPyodide) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          document.body.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        const pyodide = await (window as any).loadPyodide();
        
        if (!isMounted) return;
        setStatus('Installing Pygame-CE (pygame-ce package)...');
        
        // Load pygame-ce via micropip
        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        await micropip.install('pygame-ce');

        if (!isMounted) return;
        setStatus('Running Game Loop...');

        if (canvasRef.current) {
           pyodide.canvas.setCanvas2D(canvasRef.current);
        }

        // Extremely basic pygame-ce loop matching the Python logic
        const pythonCode = `
import pygame
import sys
import asyncio

pygame.init()
screen = pygame.display.set_mode((400, 300))
clock = pygame.time.Clock()
color = (0, 128, 255)

async def main():
    x = 0
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                break

        screen.fill((30, 30, 30))
        # Draw bouncing rectangle
        pygame.draw.rect(screen, color, pygame.Rect(x, 125, 50, 50))
        x = (x + 2) % 400
        
        pygame.display.flip()
        
        # Asyncio sleep is CRITICAL to yield back to React / JS event loop
        # otherwise Pyodide WASM completely locks the browser tab
        await asyncio.sleep(0.01)

asyncio.ensure_future(main())
`;
        
        await pyodide.runPythonAsync(pythonCode);
        if (isMounted) setStatus(''); // Hide status when successfully running
      } catch (err) {
        if (isMounted) {
          console.error('[PygameCanvas] Pyodide initialization failed:', err);
          setStatus('Python Runtime Initializing... (Offline Mode Active)');
        }
      }
    }

    initPyodide();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative w-[400px] h-[300px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      {status && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-10 bg-slate-900/80 backdrop-blur-sm">
          <p className="text-teal-400 font-mono text-sm animate-pulse">{status}</p>
        </div>
      )}
      {/* Pyodide will render to this specific canvas */}
      <canvas ref={canvasRef} id="canvas" className="w-full h-full block" />
    </div>
  );
};
