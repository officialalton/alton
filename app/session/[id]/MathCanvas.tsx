"use client";

import { useEffect, useRef, useState } from "react";

export default function MathCanvas({
  onSubmit,
  submitting,
}: {
  onSubmit: (dataUrl: string) => void;
  submitting: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1A1A1A");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = 240 * ratio;
    const ctx = canvas.getContext("2d");
    ctx?.scale(ratio, ratio);
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSubmit(canvas.toDataURL());
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {["#1A1A1A", "#C8102E"].map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={
              "w-5 h-5 rounded-full border-2 " +
              (color === c ? "border-ink" : "border-transparent")
            }
            style={{ background: c }}
          />
        ))}
        <button
          onClick={clearCanvas}
          className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-grey-200"
        >
          지우기
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full border-[1.5px] border-grey-200 rounded-lg touch-none"
        style={{ height: 240 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="mt-3">
        <button
          disabled={submitting}
          onClick={handleSubmit}
          className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
        >
          제출하기
        </button>
      </div>
    </div>
  );
}
