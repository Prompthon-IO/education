import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Gift,
  MessageCircle,
  Pause,
  Play,
  Sparkles,
  Volume2
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import voiceFlappyImage from "./assets/demo-controls/voice-flappy-control.webp";
import wordSnakeImage from "./assets/demo-controls/word-snake-control.webp";
import faceSimonImage from "./assets/demo-controls/face-simon-control.webp";

const STICKER_SHEET_PATH = "/celebration-sticker-sheet.png";
const DISCORD_INVITE_URL = "https://discord.gg/vE3UR9VxDz";
const ROTATION_INTERVAL_MS = 6_000;

type CelebrationSlide = {
  label: string;
  title: string;
  description: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
};

const CELEBRATION_SLIDES: CelebrationSlide[] = [
  {
    label: "01 · AI Stickers",
    title: "Get your celebration AI sticker for free",
    description: "Turn one joyful group photo into a colorful, print-ready sticker sheet.",
    accent: "#ff5a00",
    icon: Sparkles
  },
  {
    label: "02 · Voice Flappy",
    title: "Play Flappy Bird with your voice",
    description: "Make a sound to lift your character and fly through the course together.",
    accent: "#0f8f72",
    icon: Volume2
  },
  {
    label: "03 · More Games",
    title: "Play, move, laugh, and compete",
    description: "Try gesture, voice, and expression-powered games made for the whole community.",
    accent: "#ffb000",
    icon: Gamepad2
  },
  {
    label: "04 · Join Discord",
    title: "Discord online events and free workshops",
    description: "Prompthon is coming back soon with more future events. Scan the code and join the community.",
    accent: "#5865f2",
    icon: MessageCircle
  }
];

export function CelebrationStickerPage({ onStart }: { onStart: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const slide = CELEBRATION_SLIDES[activeIndex];

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % CELEBRATION_SLIDES.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function selectSlide(index: number) {
    setActiveIndex((index + CELEBRATION_SLIDES.length) % CELEBRATION_SLIDES.length);
  }

  const SlideIcon = slide.icon;

  return (
    <div className="h-full overflow-y-auto bg-[#f4f1eb] text-[#07111f]">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b-2 border-[#07111f] bg-white px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="shrink-0" />
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#ffd66b] ring-2 ring-[#07111f]">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">Prompthon Community Events</p>
            <p className="hidden text-xs font-semibold text-muted-foreground sm:block">AI creativity, playful games, and free workshops.</p>
          </div>
        </div>
        <Button type="button" size="sm" className="shrink-0 gap-2" onClick={onStart}>
          Get AI sticker
          <ArrowRight className="size-4" />
        </Button>
      </header>

      <main className="mx-auto flex min-h-[calc(100%-3.5rem)] w-full max-w-[1580px] flex-col">
        <section className="relative isolate flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 overflow-hidden border-b-2 border-[#07111f] bg-white px-4 py-8 sm:min-h-[56vh] sm:px-8">
          <div className="absolute inset-x-0 top-0 h-2 transition-colors duration-500" style={{ backgroundColor: slide.accent }} />

          {activeIndex === 0 ? <StickerSlide /> : null}
          {activeIndex === 1 ? <VoiceFlappySlide /> : null}
          {activeIndex === 2 ? <GamesSlide /> : null}
          {activeIndex === 3 ? <DiscordSlide /> : null}

          <DiscordRibbon />
        </section>

        <section className="bg-white px-4 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto grid max-w-[1400px] gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase" style={{ color: slide.accent }}>
                <SlideIcon className="size-4" />
                {slide.label}
              </div>
              <h1 className="max-w-5xl text-3xl font-black leading-[1.05] sm:text-5xl">{slide.title}</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-[#44505f] sm:text-base">{slide.description}</p>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" aria-label="Previous slide" title="Previous slide" onClick={() => selectSlide(activeIndex - 1)}>
                  <ChevronLeft />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label={isPlaying ? "Pause carousel" : "Play carousel"} title={isPlaying ? "Pause carousel" : "Play carousel"} onClick={() => setIsPlaying((current) => !current)}>
                  {isPlaying ? <Pause /> : <Play />}
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="Next slide" title="Next slide" onClick={() => selectSlide(activeIndex + 1)}>
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-2" aria-label={`Slide ${activeIndex + 1} of ${CELEBRATION_SLIDES.length}`}>
                {CELEBRATION_SLIDES.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    className={cn("h-2.5 rounded-full border border-[#07111f] transition-[width,background-color]", index === activeIndex ? "w-8" : "w-2.5 bg-white")}
                    style={index === activeIndex ? { backgroundColor: slide.accent } : undefined}
                    aria-label={`Show slide ${index + 1}`}
                    aria-current={index === activeIndex ? "step" : undefined}
                    onClick={() => selectSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StickerSlide() {
  return (
    <div className="relative flex min-h-[480px] w-full max-w-[1400px] flex-col justify-between overflow-hidden rounded-md border-2 border-[#07111f] bg-[#ffd66b] shadow-[8px_8px_0_#07111f] sm:min-h-[650px]">
      <div className="relative z-10 px-5 pb-2 pt-8 text-center sm:px-10 sm:pt-10">
        <p className="mb-2 text-sm font-black uppercase sm:text-2xl">Get your</p>
        <p className="text-[2.75rem] font-black leading-[0.9] text-[#ff5a00] sm:text-8xl lg:text-[8.5rem]">CELEBRATION</p>
        <p className="mt-2 text-[3.4rem] font-black leading-[0.88] text-[#2563eb] sm:text-[7rem] lg:text-[10.5rem]">AI STICKER</p>
        <div className="mt-5 inline-flex items-center gap-3 rounded-md border-2 border-[#07111f] bg-[#0f8f72] px-4 py-2 text-2xl font-black text-white shadow-[4px_4px_0_#07111f] sm:px-8 sm:py-4 sm:text-6xl">
          <Sparkles className="size-6 sm:size-12" />
          FOR FREE
        </div>
      </div>
      <div className="relative h-40 overflow-hidden border-t-2 border-[#07111f] bg-white sm:h-52">
        <img src={STICKER_SHEET_PATH} alt="Friends transformed into a celebration sticker sheet" className="h-auto min-h-full w-full object-cover object-top" />
      </div>
    </div>
  );
}

function VoiceFlappySlide() {
  return (
    <div className="grid min-h-[480px] w-full max-w-[1400px] overflow-hidden rounded-md border-2 border-[#07111f] bg-[#aee7ff] shadow-[8px_8px_0_#07111f] md:grid-cols-[0.9fr_1.1fr] sm:min-h-[650px]">
      <div className="relative min-h-64 overflow-hidden border-b-2 border-[#07111f] md:min-h-0 md:border-b-0 md:border-r-2">
        <img src={voiceFlappyImage} alt="A player controlling a flying character with their voice" className="size-full object-cover" />
      </div>
      <div className="flex flex-col items-center justify-center bg-[#aee7ff] px-5 py-8 text-center sm:px-10">
        <Volume2 className="mb-4 size-12 text-[#ff5a00] sm:size-20" />
        <p className="text-5xl font-black leading-[0.9] text-[#07111f] sm:text-7xl lg:text-8xl">PLAY</p>
        <p className="text-5xl font-black leading-[0.9] text-[#0f8f72] sm:text-7xl lg:text-8xl">VOICE</p>
        <p className="text-5xl font-black leading-[0.9] text-[#ff5a00] sm:text-7xl lg:text-8xl">FLAPPY</p>
        <p className="mt-6 max-w-md text-lg font-black sm:text-2xl">Make a sound. Fly higher. Beat the score.</p>
      </div>
    </div>
  );
}

function GamesSlide() {
  const games = [
    { name: "Voice Flappy", image: voiceFlappyImage, color: "#aee7ff" },
    { name: "Word Snake", image: wordSnakeImage, color: "#fff3dd" },
    { name: "Face Simon", image: faceSimonImage, color: "#d9c5ff" }
  ];

  return (
    <div className="flex min-h-[480px] w-full max-w-[1400px] flex-col justify-center overflow-hidden rounded-md border-2 border-[#07111f] bg-[#fff3dd] px-4 py-7 shadow-[8px_8px_0_#07111f] sm:min-h-[650px] sm:px-8">
      <div className="mb-6 text-center sm:mb-8">
        <p className="text-4xl font-black leading-none text-[#07111f] sm:text-7xl">MORE GAMES.</p>
        <p className="mt-2 text-3xl font-black leading-none text-[#ff5a00] sm:text-6xl">MORE WAYS TO PLAY.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-5">
        {games.map((game) => (
          <figure key={game.name} className="overflow-hidden rounded-md border-2 border-[#07111f] shadow-[3px_3px_0_#07111f]" style={{ backgroundColor: game.color }}>
            <img src={game.image} alt="" className="aspect-square w-full object-cover" />
            <figcaption className="border-t-2 border-[#07111f] px-1 py-2 text-center text-xs font-black sm:px-3 sm:py-3 sm:text-xl">{game.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function DiscordSlide() {
  return (
    <div className="grid min-h-[480px] w-full max-w-[1400px] place-items-center overflow-hidden rounded-md border-2 border-[#07111f] bg-[#5865f2] px-5 py-8 text-center text-white shadow-[8px_8px_0_#07111f] sm:min-h-[650px] sm:px-10">
      <div>
        <MessageCircle className="mx-auto mb-4 size-12 sm:size-20" />
        <p className="text-4xl font-black leading-[0.9] sm:text-7xl lg:text-8xl">DISCORD ONLINE EVENTS</p>
        <p className="mt-3 text-3xl font-black leading-[0.95] text-[#ffd66b] sm:text-6xl">+ FREE WORKSHOPS</p>
        <div className="mx-auto mt-6 w-fit rounded-md border-2 border-[#07111f] bg-white p-3 shadow-[5px_5px_0_#07111f] sm:p-4">
          <QRCodeSVG value={DISCORD_INVITE_URL} size={220} level="M" bgColor="#ffffff" fgColor="#07111f" />
        </div>
        <p className="mt-5 text-xl font-black sm:text-3xl">Prompthon is coming back soon.</p>
      </div>
    </div>
  );
}

function DiscordRibbon() {
  return (
    <div className="grid w-full max-w-[1400px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border-2 border-[#07111f] bg-[#5865f2] p-3 text-white shadow-[5px_5px_0_#07111f] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5 sm:p-4">
      <div className="rounded-sm bg-white p-1.5">
        <QRCodeSVG value={DISCORD_INVITE_URL} size={92} level="M" bgColor="#ffffff" fgColor="#07111f" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black leading-tight sm:text-3xl">Prompthon is coming back soon</p>
        <p className="mt-1 text-xs font-bold text-white/85 sm:text-base">Join Discord for future online events and free workshops.</p>
      </div>
      <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="hidden rounded-md border-2 border-[#07111f] bg-[#ffd66b] px-5 py-3 text-sm font-black text-[#07111f] shadow-[3px_3px_0_#07111f] transition-transform hover:-translate-y-0.5 sm:block">
        Join Discord
      </a>
    </div>
  );
}
