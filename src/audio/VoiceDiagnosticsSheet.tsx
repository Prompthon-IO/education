import {
  Activity,
  AudioLines,
  CircleStop,
  RefreshCw,
  TestTube2,
  TriangleAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import type {
  AudioFoundationSnapshot,
  AudioInputDevice,
  VoicePipelineMode
} from "./types";

const DEFAULT_DEVICE_VALUE = "__default-microphone__";

export function VoiceDiagnosticsSheet({
  open,
  onOpenChange,
  pipelineMode,
  playerId,
  playerName,
  modelBaseUrl,
  snapshot,
  devices,
  selectedDeviceId,
  captureControlsDisabled,
  onSelectedDeviceChange,
  onStart,
  onStop,
  onCalibrate,
  onSynthetic
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineMode: VoicePipelineMode;
  playerId: string;
  playerName: string;
  modelBaseUrl: string;
  snapshot: AudioFoundationSnapshot;
  devices: AudioInputDevice[];
  selectedDeviceId: string;
  captureControlsDisabled: boolean;
  onSelectedDeviceChange: (deviceId: string) => void;
  onStart: () => void;
  onStop: () => void;
  onCalibrate: () => void;
  onSynthetic: () => void;
}) {
  const diagnostics = snapshot.diagnostics;
  const settings = snapshot.settings;
  const profile = snapshot.noiseProfile;
  const busy = snapshot.status === "requesting-permission"
    || snapshot.status === "starting"
    || snapshot.status === "calibrating";
  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);
  const selectedValue = selectedDeviceId || DEFAULT_DEVICE_VALUE;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        style={{ width: "100%" }}
        data-testid="voice-diagnostics-sheet"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="flex items-center gap-2 font-black">
            <Activity className="size-4" />
            Voice diagnostics
          </SheetTitle>
          <SheetDescription>Development audio telemetry</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-6">
          <section className="grid gap-2 border-b pb-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Pipeline</span>
              <Badge variant="outline" className="font-mono uppercase">{pipelineMode}</Badge>
            </div>
            <DiagnosticRow label="Status" value={formatStatus(snapshot.status)} />
            <DiagnosticRow label="Player" value={`${playerName} (${playerId})`} />
            <DiagnosticRow label="Model source" value={modelBaseUrl || "Not configured"} />
          </section>

          <section className="grid gap-3 border-b pb-4">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="voice-input-device">
              Input device
            </label>
            <Select
              value={selectedValue}
              onValueChange={(value) => onSelectedDeviceChange(value === DEFAULT_DEVICE_VALUE || !value ? "" : value)}
              disabled={busy || captureControlsDisabled}
            >
              <SelectTrigger id="voice-input-device" className="w-full">
                <SelectValue>{selectedDevice?.label || settings?.label || "System default"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={DEFAULT_DEVICE_VALUE}>System default</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={onStart} disabled={busy || captureControlsDisabled}>
                {snapshot.status === "ready" ? <RefreshCw data-icon="inline-start" /> : <AudioLines data-icon="inline-start" />}
                {snapshot.status === "ready" ? "Restart" : "Start mic"}
              </Button>
              <Button type="button" variant="outline" onClick={onStop} disabled={snapshot.status === "idle"}>
                <CircleStop data-icon="inline-start" />
                Stop
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onCalibrate} disabled={snapshot.status !== "ready" || captureControlsDisabled}>
                <Activity data-icon="inline-start" />
                Calibrate 3s
              </Button>
              <Button type="button" variant="outline" onClick={onSynthetic} disabled={busy || captureControlsDisabled}>
                <TestTube2 data-icon="inline-start" />
                Synthetic
              </Button>
            </div>
          </section>

          <section className="grid gap-2 border-b pb-4">
            <h3 className="text-xs font-semibold text-muted-foreground">Capture settings</h3>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs">
              <span />
              <span className="font-semibold text-muted-foreground">Requested</span>
              <span className="font-semibold text-muted-foreground">Actual</span>
              <span>Channels</span><span className="text-right font-mono">1</span><span className="text-right font-mono">{formatNumber(settings?.channelCount)}</span>
              <span>Echo cancellation</span><span className="text-right font-mono">On</span><span className="text-right font-mono">{formatBoolean(settings?.echoCancellation)}</span>
              <span>Noise suppression</span><span className="text-right font-mono">On</span><span className="text-right font-mono">{formatBoolean(settings?.noiseSuppression)}</span>
              <span>Auto gain</span><span className="text-right font-mono">Off</span><span className="text-right font-mono">{formatBoolean(settings?.autoGainControl)}</span>
            </div>
          </section>

          <section className="grid gap-2 border-b pb-4" aria-live="polite">
            <h3 className="text-xs font-semibold text-muted-foreground">Worker telemetry</h3>
            <DiagnosticRow label="Native sample rate" value={formatHertz(diagnostics?.nativeSampleRate ?? settings?.sampleRate)} />
            <DiagnosticRow label="Model sample rate" value={formatHertz(diagnostics?.modelSampleRate)} />
            <DiagnosticRow label="Live level" value={formatDb(diagnostics?.dbfs)} />
            <DiagnosticRow label="Peak" value={diagnostics ? diagnostics.peak.toFixed(3) : "--"} />
            <DiagnosticRow label="Clipping" value={diagnostics ? `${(diagnostics.clippingRatio * 100).toFixed(2)}%` : "--"} />
            <DiagnosticRow label="Processing" value={formatMilliseconds(diagnostics?.processingMs)} />
            <DiagnosticRow label="Worker latency" value={formatMilliseconds(diagnostics?.workerLatencyMs)} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Noise profile</h3>
            <DiagnosticRow label="90th-percentile floor" value={formatDb(profile?.overallDb)} />
            <DiagnosticRow label="Transient rate" value={profile ? `${(profile.transientRate * 100).toFixed(1)}%` : "--"} />
            <DiagnosticRow label="Spectral bands" value={profile ? profile.bandPower.map((value) => value.toFixed(1)).join(" / ") : "--"} />
          </section>

          {snapshot.error ? (
            <div className="flex gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{snapshot.error}</span>
            </div>
          ) : null}
          {snapshot.warnings.length > 0 ? (
            <div className="grid gap-2 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
              {snapshot.warnings.map((warning) => (
                <div key={warning} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-start gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-mono font-semibold">{value}</span>
    </div>
  );
}

function formatStatus(status: AudioFoundationSnapshot["status"]) {
  return status.replace(/-/g, " ");
}

function formatBoolean(value: boolean | undefined) {
  return value === undefined ? "--" : value ? "On" : "Off";
}

function formatNumber(value: number | undefined) {
  return value === undefined ? "--" : value.toString();
}

function formatHertz(value: number | undefined) {
  return value === undefined ? "--" : `${Math.round(value).toLocaleString()} Hz`;
}

function formatDb(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? "--" : `${value.toFixed(1)} dBFS`;
}

function formatMilliseconds(value: number | undefined) {
  return value === undefined ? "--" : `${value.toFixed(2)} ms`;
}
