import React, { useState, useEffect, useRef } from 'react';

/**
 * useAnimatedNumber:
 * High-performance hook that smoothly interpolates numerical values using requestAnimationFrame
 * and an ease-out cubic curve to prevent abrupt jumping when MQTT telemetry updates arrive.
 */
export function useAnimatedNumber(targetValue, { duration = 450, decimals = 2 } = {}) {
  const [currentVal, setCurrentVal] = useState(() => (typeof targetValue === 'number' && !isNaN(targetValue) ? targetValue : 0));
  const animRef = useRef(null);
  const startValRef = useRef(currentVal);
  const startTimeRef = useRef(0);
  const targetValRef = useRef(targetValue);
  const currentValRef = useRef(currentVal);

  useEffect(() => {
    if (typeof targetValue !== 'number' || isNaN(targetValue)) {
      return;
    }

    const startVal = currentValRef.current;
    const endVal = targetValue;

    // Skip if difference is negligible
    if (Math.abs(endVal - startVal) < 0.0001) {
      currentValRef.current = endVal;
      setCurrentVal(endVal);
      return;
    }

    startValRef.current = startVal;
    targetValRef.current = endVal;
    startTimeRef.current = performance.now();

    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }

    // Smooth cubic bezier ease-out (1 - (1 - t)^3)
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const next = startValRef.current + (targetValRef.current - startValRef.current) * eased;

      currentValRef.current = next;
      setCurrentVal(next);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        currentValRef.current = endVal;
        setCurrentVal(endVal);
      }
    };

    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [targetValue, duration]);

  return typeof currentVal === 'number' && !isNaN(currentVal)
    ? currentVal.toFixed(decimals)
    : (0).toFixed(decimals);
}

/**
 * AnimatedNumber Component:
 * Renders smooth floating-point or integer transitions with optional micro-glow pulse on value change.
 */
function AnimatedNumberComponent({
  value,
  decimals = 2,
  duration = 450,
  fallback = '0.00',
  className = '',
  enablePulse = true,
  prefix = '',
  suffix = ''
}) {
  const isNumber = typeof value === 'number' && !isNaN(value);
  const animatedStr = useAnimatedNumber(isNumber ? value : 0, { duration, decimals });
  const [pulsing, setPulsing] = useState(false);
  const prevValRef = useRef(value);

  useEffect(() => {
    if (!enablePulse || !isNumber) return;
    if (prevValRef.current !== undefined && Math.abs(value - prevValRef.current) > 0.005) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), 400);
      prevValRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValRef.current = value;
  }, [value, enablePulse, isNumber]);

  if (!isNumber) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <span className={`${className} ${pulsing ? 'telemetry-pulse' : ''}`.trim()}>
      {prefix}{animatedStr}{suffix}
    </span>
  );
}

export const AnimatedNumber = React.memo(AnimatedNumberComponent);
export default AnimatedNumber;
