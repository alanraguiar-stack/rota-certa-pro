import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Route {
  id: string;
  color: string;
  stops: number;
}

interface AbstractRouteVisualizationProps {
  routes?: Route[];
  className?: string;
  animated?: boolean;
}

export function AbstractRouteVisualization({ 
  routes = [],
  className,
  animated = true 
}: AbstractRouteVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default routes if none provided
  const displayRoutes = routes.length > 0 ? routes : [
    { id: '1', color: 'hsl(200, 80%, 45%)', stops: 8 },
    { id: '2', color: 'hsl(160, 84%, 45%)', stops: 6 },
    { id: '3', color: 'hsl(199, 89%, 55%)', stops: 5 },
    { id: '4', color: 'hsl(38, 92%, 55%)', stops: 7 },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw CD marker (center point)
    const cdX = width * 0.15;
    const cdY = height * 0.5;
    
    // CD glow
    const cdGradient = ctx.createRadialGradient(cdX, cdY, 0, cdX, cdY, 20);
    cdGradient.addColorStop(0, 'rgba(34, 197, 94, 0.5)');
    cdGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = cdGradient;
    ctx.beginPath();
    ctx.arc(cdX, cdY, 20, 0, Math.PI * 2);
    ctx.fill();

    // CD point
    ctx.fillStyle = 'hsl(152, 69%, 45%)';
    ctx.beginPath();
    ctx.arc(cdX, cdY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw abstract routes
    displayRoutes.forEach((route, index) => {
      const startY = cdY;
      const amplitude = 30 + (index * 15);
      const frequency = 0.02 + (index * 0.005);
      const offset = index * (Math.PI / 4);

      ctx.strokeStyle = route.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.setLineDash([8, 4]);

      ctx.beginPath();
      ctx.moveTo(cdX, cdY);

      // Draw curved path
      for (let x = cdX; x < width * 0.9; x += 2) {
        const progress = (x - cdX) / (width * 0.75);
        const y = startY + Math.sin(x * frequency + offset) * amplitude * progress;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw stops along the route
      const stopSpacing = (width * 0.75) / (route.stops + 1);
      for (let i = 1; i <= route.stops; i++) {
        const stopX = cdX + (stopSpacing * i);
        const progress = (stopX - cdX) / (width * 0.75);
        const stopY = startY + Math.sin(stopX * frequency + offset) * amplitude * progress;

        // Stop glow
        const stopGradient = ctx.createRadialGradient(stopX, stopY, 0, stopX, stopY, 8);
        stopGradient.addColorStop(0, route.color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
        stopGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = stopGradient;
        ctx.beginPath();
        ctx.arc(stopX, stopY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Stop point
        ctx.fillStyle = route.color;
        ctx.beginPath();
        ctx.arc(stopX, stopY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [displayRoutes]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800",
      className
    )}>
      {/* Animated overlay */}
      {animated && (
        <div className="absolute inset-0 animate-shimmer opacity-30" />
      )}
      
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-[10px] font-medium text-white/70">CD</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full bg-primary" />
          <span className="text-[10px] font-medium text-white/70">Rotas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-info" />
          <span className="text-[10px] font-medium text-white/70">Entregas</span>
        </div>
      </div>

      {/* Corner accent */}
      <div className="absolute right-0 top-0 h-16 w-16 bg-gradient-to-bl from-primary/20 to-transparent" />
    </div>
  );
}
