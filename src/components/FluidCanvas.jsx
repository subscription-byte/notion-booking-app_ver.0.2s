import React, { useEffect, useRef } from 'react';

const FluidCanvas = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const particlesRef = useRef([]);
  const splashesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Set canvas size
    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resizeCanvas();

    // Particle class for fluid simulation
    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.life = 1;
        this.decay = Math.random() * 0.01 + 0.005;
        this.color = {
          h: Math.random() * 60 + 320, // Pink to purple range
          s: 70 + Math.random() * 30,
          l: 70 + Math.random() * 20
        };
        this.trail = [];
        this.maxTrailLength = 20;
      }

      update() {
        // Add current position to trail
        this.trail.push({ x: this.x, y: this.y, life: 1 });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }

        // Update trail
        this.trail.forEach(point => {
          point.life *= 0.98;
        });

        // Mouse interaction
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          const force = (150 - distance) / 150;
          const angle = Math.atan2(dy, dx);
          this.vx -= Math.cos(angle) * force * 2;
          this.vy -= Math.sin(angle) * force * 2;

          // Add some randomness when repelled
          this.vx += (Math.random() - 0.5) * force;
          this.vy += (Math.random() - 0.5) * force;
        }

        // Add fluid dynamics
        this.vx += Math.sin(this.y * 0.01) * 0.1;
        this.vy += Math.cos(this.x * 0.01) * 0.1;

        // Apply velocity with damping
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Bounce off edges
        if (this.x < this.radius || this.x > width - this.radius) {
          this.vx *= -0.8;
          this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
        }
        if (this.y < this.radius || this.y > height - this.radius) {
          this.vy *= -0.8;
          this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));
        }

        // Life decay
        this.life -= this.decay;

        // Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 10) {
          this.vx = (this.vx / speed) * 10;
          this.vy = (this.vy / speed) * 10;
        }
      }

      draw(ctx) {
        // Draw trail
        this.trail.forEach((point, index) => {
          const alpha = point.life * this.life * (index / this.trail.length);
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.radius * (index / this.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${this.color.h}, ${this.color.s}%, ${this.color.l}%, ${alpha * 0.3})`;
          ctx.fill();
        });

        // Draw particle with glow effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3);
        gradient.addColorStop(0, `hsla(${this.color.h}, ${this.color.s}%, ${this.color.l}%, ${this.life})`);
        gradient.addColorStop(0.5, `hsla(${this.color.h}, ${this.color.s}%, ${this.color.l}%, ${this.life * 0.5})`);
        gradient.addColorStop(1, `hsla(${this.color.h}, ${this.color.s}%, ${this.color.l}%, 0)`);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // Splash effect class
    class Splash {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        const particleCount = 30 + Math.floor(Math.random() * 20);

        for (let i = 0; i < particleCount; i++) {
          const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
          const velocity = 5 + Math.random() * 10;
          this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            life: 1,
            decay: Math.random() * 0.02 + 0.01,
            radius: Math.random() * 3 + 1,
            color: {
              h: Math.random() * 60 + 320, // Pink range
              s: 80,
              l: 75 + Math.random() * 15
            }
          });
        }
      }

      update() {
        this.particles = this.particles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.vy += 0.2; // Gravity
          p.life -= p.decay;
          return p.life > 0;
        });

        return this.particles.length > 0;
      }

      draw(ctx) {
        this.particles.forEach(p => {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2);
          gradient.addColorStop(0, `hsla(${p.color.h}, ${p.color.s}%, ${p.color.l}%, ${p.life})`);
          gradient.addColorStop(1, `hsla(${p.color.h}, ${p.color.s}%, ${p.color.l}%, 0)`);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        });
      }
    }

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 100; i++) {
        particlesRef.current.push(new Particle(
          Math.random() * width,
          Math.random() * height
        ));
      }
    };
    initParticles();

    // Animation loop
    const animate = () => {
      // Create trail effect with lighter background
      ctx.fillStyle = 'rgba(255, 250, 255, 0.08)';
      ctx.fillRect(0, 0, width, height);

      // Update mouse velocity
      mouseRef.current.vx = mouseRef.current.x - (mouseRef.current.prevX || mouseRef.current.x);
      mouseRef.current.vy = mouseRef.current.y - (mouseRef.current.prevY || mouseRef.current.y);
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;

      // Add particles based on mouse movement
      if (Math.abs(mouseRef.current.vx) > 2 || Math.abs(mouseRef.current.vy) > 2) {
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push(new Particle(
            mouseRef.current.x + (Math.random() - 0.5) * 20,
            mouseRef.current.y + (Math.random() - 0.5) * 20
          ));
        }
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update();
        particle.draw(ctx);
        return particle.life > 0;
      });

      // Maintain minimum particles
      while (particlesRef.current.length < 50) {
        particlesRef.current.push(new Particle(
          Math.random() * width,
          Math.random() * height
        ));
      }

      // Update and draw splashes
      splashesRef.current = splashesRef.current.filter(splash => {
        const alive = splash.update();
        splash.draw(ctx);
        return alive;
      });

      // Draw connections between nearby particles
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            const alpha = (1 - distance / 100) * Math.min(p1.life, p2.life) * 0.2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${(p1.color.h + p2.color.h) / 2}, 100%, 60%, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      // Add glow effect at mouse position
      if (mouseRef.current.isDown) {
        const glowGradient = ctx.createRadialGradient(
          mouseRef.current.x, mouseRef.current.y, 0,
          mouseRef.current.x, mouseRef.current.y, 100
        );
        glowGradient.addColorStop(0, 'rgba(255, 182, 193, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(255, 192, 203, 0.2)');
        glowGradient.addColorStop(1, 'rgba(255, 182, 193, 0)');

        ctx.fillStyle = glowGradient;
        ctx.fillRect(mouseRef.current.x - 100, mouseRef.current.y - 100, 200, 200);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // Event handlers
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseDown = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      console.log('Mouse clicked at:', x, y); // Debug log

      mouseRef.current.isDown = true;

      // Create splash effect
      splashesRef.current.push(new Splash(x, y));

      // Create burst of particles
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const velocity = 5 + Math.random() * 5;
        const particle = new Particle(x, y);
        particle.vx = Math.cos(angle) * velocity;
        particle.vy = Math.sin(angle) * velocity;
        particlesRef.current.push(particle);
      }
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseRef.current.x = touch.clientX - rect.left;
      mouseRef.current.y = touch.clientY - rect.top;
    };

    const handleTouchStart = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      console.log('Touch started at:', x, y); // Debug log

      mouseRef.current.isDown = true;
      mouseRef.current.x = x;
      mouseRef.current.y = y;

      // Create splash effect
      splashesRef.current.push(new Splash(x, y));

      // Create burst of particles
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const velocity = 5 + Math.random() * 5;
        const particle = new Particle(x, y);
        particle.vx = Math.cos(angle) * velocity;
        particle.vy = Math.sin(angle) * velocity;
        particlesRef.current.push(particle);
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.isDown = false;
    };

    // Add event listeners
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.removeEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.removeEventListener('touchend', handleTouchEnd, { passive: false });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #ffc0cb 0%, #ffb6c1 20%, #ffc0e0 40%, #ffddff 60%, #ffe0f0 80%, #ffc0cb 100%)',
        backgroundSize: '400% 400%',
        animation: 'gradient 15s ease infinite',
        zIndex: 1,
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    />
  );
};

export default FluidCanvas;