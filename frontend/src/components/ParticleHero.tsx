import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

const ParticleHero: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Honour the OS "reduce motion" setting — leave the canvas blank rather
    // than running a perpetual animation.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    /* Particle count scales with viewport area, and the neighbour search is
       O(n^2) per frame, so a phone would otherwise pay a desktop-sized cost
       on a fraction of the GPU. ~55 on a laptop, ~22 on a phone. */
    const particleCountFor = (w: number, h: number) => {
      const area = w * h;
      return Math.round(Math.min(55, Math.max(18, area / 18000)));
    };

    // Shorter link radius on small screens keeps the mesh visually similar
    const linkDistanceFor = (w: number) => (w < 640 ? 90 : 150);

    const spawn = (count: number): Particle[] =>
      Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.2
      }));

    const resizeCanvas = () => {
      const previousWidth = width;
      const previousHeight = height;

      width = window.innerWidth;
      height = window.innerHeight;

      // Match the device pixel ratio so particles aren't blurry on retina /
      // high-DPI phone screens, but cap it — a 3x buffer on a large screen is
      // a lot of pixels to clear every frame for a decorative background.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = particleCountFor(width, height);
      const current = particlesRef.current;

      if (current.length === 0) {
        particlesRef.current = spawn(target);
        return;
      }

      // Rescale existing particles into the new box instead of teleporting
      // them, so an orientation change doesn't clump everything in a corner.
      if (previousWidth > 0 && previousHeight > 0) {
        const scaleX = width / previousWidth;
        const scaleY = height / previousHeight;
        current.forEach((particle) => {
          particle.x *= scaleX;
          particle.y *= scaleY;
        });
      }

      if (target > current.length) {
        particlesRef.current = current.concat(spawn(target - current.length));
      } else if (target < current.length) {
        particlesRef.current = current.slice(0, target);
      }
    };

    resizeCanvas();

    // Mobile browsers fire resize on every URL-bar collapse; debounce so a
    // scroll doesn't trigger a burst of canvas reallocations.
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 150);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      const linkDistance = linkDistanceFor(width);
      const linkDistanceSq = linkDistance * linkDistance;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.fill();

        // Compare squared distances to skip a sqrt for every rejected pair
        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < linkDistanceSq) {
            const distance = Math.sqrt(distanceSq);
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - distance / linkDistance)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Pause entirely when the tab is backgrounded
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      } else if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    animate();

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.4 }}
    />
  );
};

export default ParticleHero;
