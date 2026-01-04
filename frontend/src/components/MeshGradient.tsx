import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const MeshGradient: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create mesh gradient effect with grayscale
      const gradients = [
        {
          x: canvas.width * 0.2 + Math.sin(time * 0.001) * 100,
          y: canvas.height * 0.3 + Math.cos(time * 0.0015) * 100,
          radius: 400,
          opacity: 0.03,
        },
        {
          x: canvas.width * 0.8 + Math.cos(time * 0.0012) * 100,
          y: canvas.height * 0.6 + Math.sin(time * 0.001) * 100,
          radius: 500,
          opacity: 0.02,
        },
        {
          x: canvas.width * 0.5 + Math.sin(time * 0.0008) * 150,
          y: canvas.height * 0.5 + Math.cos(time * 0.001) * 150,
          radius: 600,
          opacity: 0.015,
        },
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
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      time++;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2 }}
    />
  );
};

export default MeshGradient;
