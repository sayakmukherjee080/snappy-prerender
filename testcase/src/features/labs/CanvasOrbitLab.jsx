import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { usePageVisibility, usePrefersReducedMotion } from '../../hooks/useDom.js';
import { LabShell } from './LabShell.jsx';

/**
 * Draws a simple animated constellation into a canvas.
 */
export default function CanvasOrbitLab() {
  const canvasRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [frames, setFrames] = useState(0);
  const visible = usePageVisibility();
  const reducedMotion = usePrefersReducedMotion();

  const draw = useEffectEvent((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;

    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101417';
    context.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;

    context.strokeStyle = '#2c343a';
    context.lineWidth = 1;
    for (let plane = 0; plane < 6; plane += 1) {
      context.beginPath();
      context.ellipse(cx, cy, radius, radius * 0.42, (plane * Math.PI) / 6, 0, Math.PI * 2);
      context.stroke();
    }

    context.fillStyle = '#ee5a24';
    for (let node = 0; node < 24; node += 1) {
      const plane = node % 6;
      const angle = (node / 4) * Math.PI * 0.5 + time * 0.00015 * speed;
      const x = radius * Math.cos(angle);
      const y = radius * 0.42 * Math.sin(angle);
      const rotation = (plane * Math.PI) / 6;
      const px = cx + x * Math.cos(rotation) - y * Math.sin(rotation);
      const py = cy + x * Math.sin(rotation) + y * Math.cos(rotation);
      context.beginPath();
      context.arc(px, py, 3.2, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = '#e9e7e0';
    context.font = '11px IBM Plex Mono, monospace';
    context.fillText('550 KM SSO · 24 NODES', 18, 26);
    context.fillStyle = '#98a1a7';
    context.fillText(`FRAME ${frames.toString().padStart(4, '0')}`, 18, 44);
  });

  useLayoutEffect(() => {
    draw(performance.now());
  }, [draw]);

  useEffect(() => {
    if (!visible || reducedMotion) {
      draw(performance.now());
      return undefined;
    }

    let frameId;
    let frameCount = 0;
    const loop = (time) => {
      frameCount += 1;
      if (frameCount % 30 === 0) setFrames(frameCount);
      draw(time);
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [draw, reducedMotion, visible]);

  return (
    <LabShell
      title="Canvas orbit"
      summary="A requestAnimationFrame constellation that pauses in hidden tabs and respects reduced motion."
      tags={['Canvas', 'requestAnimationFrame', 'useEffectEvent', 'Page Visibility']}
      notes={[
        'useEffectEvent keeps the draw loop reading the latest speed without re-subscribing every frame.',
        'The loop stops when document.visibilityState is hidden.',
        'Reduced motion renders a single static frame.',
      ]}
    >
      <div className="lab-demo">
        <canvas ref={canvasRef} className="orbit-canvas" aria-label="Animated constellation" />
        <label className="lab-range">
          <span>Speed · {speed.toFixed(1)}×</span>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
        <p className="lab-facts__line">
          {visible ? 'Visible' : 'Background tab'} · {reducedMotion ? 'Reduced motion' : 'Animated'}{' '}
          · frame {frames}
        </p>
      </div>
    </LabShell>
  );
}
