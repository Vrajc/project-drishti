import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const MeshGradient: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number | undefined;
    let time = 0;

    /* The backing buffer is deliberately much smaller than the viewport and
       stretched to fill it by CSS. Each frame paints three full-surface
       radial gradients, so cost scales with buffer area — and because the
       gradients are soft and drawn at ~3% opacity, the upscale is invisible.
       Full resolution here made low-end phones drop frames while scrolling. */
    const RENDER_SCALE = 0.4;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cssWidth = 0;
    let cssHeight = 0;

    const resizeCanvas = () => {
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(cssWidth * RENDER_SCALE));
      canvas.height = Math.max(1, Math.floor(cssHeight * RENDER_SCALE));
    };
    resizeCanvas();

    // Mobile URL-bar show/hide fires resize constantly during scroll
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 150);
    };
    window.addEventListener('resize', onResize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Radii are expressed in viewport terms then scaled, so the blobs keep
      // their proportions on a phone instead of covering the whole screen.
      const unit = Math.min(w, h);

      const gradients = [
        {
          x: w * 0.2 + Math.sin(time * 0.001) * unit * 0.12,
          y: h * 0.3 + Math.cos(time * 0.0015) * unit * 0.12,
          radius: unit * 0.75,
          opacity: 0.03
        },
        {
          x: w * 0.8 + Math.cos(time * 0.0012) * unit * 0.12,
          y: h * 0.6 + Math.sin(time * 0.001) * unit * 0.12,
          radius: unit * 0.95,
          opacity: 0.02
        },
        {
          x: w * 0.5 + Math.sin(time * 0.0008) * unit * 0.18,
          y: h * 0.5 + Math.cos(time * 0.001) * unit * 0.18,
          radius: unit * 1.15,
          opacity: 0.015
        }
      ];

      gradients.forEach((grad) => {
        const gradient = ctx.createRadialGradient(
          grad.x,
          grad.y,
          0,
          grad.x,
          grad.y,
          grad.radius
        );

        gradient.addColorStop(0, `rgba(255, 255, 255, ${grad.opacity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${grad.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      });
    };

    // Static single frame when the user has asked for reduced motion
    if (reducedMotion) {
      render();
      return () => {
        window.clearTimeout(resizeTimer);
        window.removeEventListener('resize', onResize);
      };
    }

    // ~30fps is plenty for a drifting background and halves the GPU work
    const FRAME_INTERVAL = 1000 / 30;
    let lastFrame = 0;

    const loop = (now: number) => {
      animationFrameId = requestAnimationFrame(loop);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;
      time += 2; // keep drift speed unchanged at half the frame rate
      render();
    };

    const start = () => {
      if (animationFrameId === undefined) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }
    };

    const onVisibilityChange = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibilityChange);

    start();

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2 }}
    />
  );
};

export default MeshGradient;
