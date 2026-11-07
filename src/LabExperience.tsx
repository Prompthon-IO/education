import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, Maximize2, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import "./science-lab.css";

export function useLabPlayback(resetKey: string, duration = 16) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const progressRef = useRef(0);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { setProgress(0); progressRef.current = 0; setPlaying(false); }, [resetKey]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, previous = 0;
    const animate = (now: number) => {
      if (!previous) previous = now;
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const next = Math.min(1, progressRef.current + delta * rate / duration);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) setPlaying(false);
      else raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, duration]);
  const seek = (value: number) => { const next = Math.min(1, Math.max(0, value)); progressRef.current = next; setProgress(next); setPlaying(false); };
  return {
    progress, playing, rate, setRate, seek,
    toggle: () => { if (progressRef.current >= 1) { progressRef.current = 0; setProgress(0); } setPlaying((v) => !v); },
    reset: () => seek(0),
    step: (direction: number) => seek(progressRef.current + direction / 120),
  };
}
export type LabPlayback = ReturnType<typeof useLabPlayback>;

export function LabExperience({ title, subtitle, icon, modes, playback, timeLabel, endLabel, scene, settings, readouts, insight, notes, toolbar }: {
  title: string; subtitle: string; icon: ReactNode; modes?: ReactNode; playback: LabPlayback;
  timeLabel: string; endLabel: string; scene: ReactNode; settings: ReactNode;
  readouts: ReactNode; insight: ReactNode; notes: ReactNode; toolbar?: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const [panel, setPanel] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  return <main className={`science-app ${full ? "science-full" : ""}`}>
    <header className="science-header">
      <div className="science-heading"><SidebarTrigger aria-label="Toggle application navigation" /><span className="science-icon">{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></div>
      <div className="science-modes">{modes}</div>
    </header>
    <div className="science-workspace">
      <div className={`science-grid ${panel ? "" : "science-panel-hidden"}`}>
        <section className="science-stage" aria-label={`${title} simulation`}>
          <div className="science-transport">
            <div className="science-status"><i className={playback.playing ? "running" : ""} />{playback.playing ? "Running" : playback.progress === 1 ? "Complete" : playback.progress === 0 ? "Ready" : "Paused"}</div>
            <div className="science-play-buttons" role="group" aria-label="Simulation playback">
              <Button variant={playback.playing ? "outline" : "default"} size="icon" aria-label={playback.playing ? "Pause" : playback.progress === 1 ? "Replay" : "Play"} title={playback.playing ? "Pause" : "Play"} onClick={playback.toggle}>{playback.playing ? <Pause /> : <Play />}</Button>
              <Button variant="outline" size="icon" aria-label="Step back" title="Step back" disabled={playback.playing || playback.progress <= 0} onClick={() => playback.step(-1)}><SkipBack /></Button>
              <Button variant="outline" size="icon" aria-label="Step forward" title="Step forward" disabled={playback.playing || playback.progress >= 1} onClick={() => playback.step(1)}><SkipForward /></Button>
              <Button variant="outline" size="icon" aria-label="Reset playback" title="Reset playback" onClick={playback.reset}><RotateCcw /></Button>
            </div>
            <label className="science-speed">Playback speed <select aria-label="Playback speed" value={playback.rate} onChange={(e) => playback.setRate(Number(e.target.value))}>{[0.25, 0.5, 1, 1.5, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
          </div>
          <div className="science-scene-toolbar"><span>{toolbar}</span><div><Button variant="ghost" size="sm" aria-label={panel ? "Hide parameters" : "Show parameters"} onClick={() => setPanel(!panel)}>{panel ? "Hide" : "Show"} parameters</Button><Button variant="outline" size="icon-sm" aria-label={full ? "Return to normal view" : "Show canvas full display"} title={full ? "Exit full display (Esc)" : "Full display"} onClick={() => setFull(!full)}>{full ? <Minimize2 /> : <Maximize2 />}</Button></div></div>
          <div className="science-viewport">{scene}</div>
          <div className="science-timeline"><div><span>{timeLabel}</span><span>{endLabel}</span></div><input type="range" aria-label="Playback timeline" min={0} max={1000} step={1} value={Math.round(playback.progress * 1000)} onChange={(e) => playback.seek(Number(e.target.value) / 1000)} /><div className="science-timeline-caption"><span>Start</span><span>Drag to rewind or inspect any moment</span><span>End</span></div></div>
        </section>
        {panel && <aside className="science-settings" aria-label={`${title} parameters`}><div className="science-panel-title"><span>PARAMETERS</span><span className="science-live-pill">Live preview</span></div><div className="science-settings-scroll">{settings}</div></aside>}
      </div>
      <section className="science-readouts" aria-label="Simulation readouts">{readouts}</section>
      <div className="science-insight"><Info size={16} /><div>{insight}</div><button aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}>Model & references <ChevronDown size={13} style={{ transform: notesOpen ? "rotate(180deg)" : undefined }} /></button></div>
      {notesOpen && <section className="science-notes">{notes}</section>}
    </div>
  </main>;
}

export function LabPanel({ title, number, children, open = true }: { title: string; number: string; children: ReactNode; open?: boolean }) {
  return <details className="science-control-group" open={open}><summary><span><b>{number}</b>{title}</span><ChevronDown size={14} /></summary><div className="science-control-content">{children}</div></details>;
}

export function LabRange({ label, value, min, max, step = 1, unit = "", onChange, hint, disabled = false }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (value: number) => void; hint?: string; disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  const commit = () => {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number)) {
      const next = Math.max(min, Math.min(max, Math.round(number / step) * step));
      onChange(Number(next.toFixed(5))); setDraft(String(Number(next.toFixed(3))));
    } else setDraft(String(value));
  };
  return <div className={`science-range ${disabled ? "is-disabled" : ""}`}><div><label htmlFor={id}>{label}</label><span className="science-number"><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /><span>{unit}</span></span></div><input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} style={{ "--range-percent": `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} />{hint && <p>{hint}</p>}</div>;
}

export function LabSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return <div className="science-select"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></div>;
}
export function LabCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="science-check"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
export function LabReadout({ label, value, detail, accent }: { label: string; value: ReactNode; detail: string; accent?: boolean }) {
  return <article className={`science-readout ${accent ? "accent" : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
