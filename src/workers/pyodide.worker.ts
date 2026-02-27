/// <reference lib="webworker" />

// We import the standard Pyodide build map
importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js');

let pyodide: any = null;

self.onmessage = async (e) => {
  const { type, canvas } = e.data;
  
  if (type === 'INIT') {
    self.postMessage({ type: 'STATUS', status: 'Initializing Python Virtual Machine...' });
    
    try {
      pyodide = await (self as any).loadPyodide();
      
      self.postMessage({ type: 'STATUS', status: 'Installing Pygame-CE via micropip...' });
      
      await pyodide.loadPackage('micropip');
      const micropip = pyodide.pyimport('micropip');
      
      // Install Pygame Community Edition to run within WASM
      await micropip.install('pygame-ce');
      
      self.postMessage({ type: 'STATUS', status: 'Executing Game Loop...' });
      
      // Link Pyodide canvas to the OffscreenCanvas provided by React
      pyodide.canvas.setCanvas2D(canvas);
      
      const pythonCode = `
import pygame
import asyncio

pygame.init()
screen = pygame.display.set_mode((400, 300))
color = (0, 128, 255)

async def main():
    x = 0
    while True:
        # Pumping events allows Pygame to process its internal queue without fatal locks
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                break

        screen.fill((30, 30, 30))
        pygame.draw.rect(screen, color, pygame.Rect(x, 125, 50, 50))
        x = (x + 2) % 400
        
        pygame.display.flip()
        
        # Extremely important: yield execution back to JS Event Loop
        await asyncio.sleep(0.01)

asyncio.ensure_future(main())
`;
      
      await pyodide.runPythonAsync(pythonCode);
      self.postMessage({ type: 'STATUS', status: '' });
      self.postMessage({ type: 'READY' });
      
    } catch (err: any) {
      console.error('[Pyodide WebWorker Error]', err);
      self.postMessage({ type: 'STATUS', status: 'Python Runtime Failed.' });
    }
  }
};
