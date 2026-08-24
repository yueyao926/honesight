import { useCallback, useEffect, useRef } from "react";
import type { PostCardSlide } from "./PostCardMedia";

const TARGET_SPEED = 45;
const ACCEL_LERP = 0.08;
const DECEL_LERP = 0.12;
const MIN_SPEED = 0.4;

type WorkPreviewFilmstripProps = {
  slides: PostCardSlide[];
  alt: string;
};

function measureOriginalTrackWidth(track: HTMLDivElement) {
  const slideEls = track.querySelectorAll<HTMLElement>(".work-preview-slide");
  const half = slideEls.length / 2;
  if (!half) return 0;

  let width = 0;
  for (let i = 0; i < half; i += 1) {
    width += slideEls[i]?.offsetWidth ?? 0;
  }
  return width;
}

export default function WorkPreviewFilmstrip({ slides, alt }: WorkPreviewFilmstripProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(false);
  const positionRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const targetSpeedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const originalTrackWidthRef = useRef(0);
  const preloadedRef = useRef(false);
  const staticLayerRef = useRef<HTMLImageElement>(null);
  const hasPlayedRef = useRef(false);

  const remeasureTrack = useCallback(() => {
    if (!trackRef.current) return;
    const width = measureOriginalTrackWidth(trackRef.current);
    if (width > 0) {
      originalTrackWidthRef.current = width;
      if (originalTrackWidthRef.current > 0) {
        positionRef.current %= originalTrackWidthRef.current;
      }
    }
  }, []);

  useEffect(() => {
    const root = previewRef.current;
    if (!root || slides.length <= 1) return;

    const preload = () => {
      if (preloadedRef.current) return;
      preloadedRef.current = true;
      slides.forEach((slide) => {
        const img = new Image();
        img.src = slide.url;
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          preload();
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1 || !trackRef.current) return;

    const track = trackRef.current;
    const imgs = track.querySelectorAll("img");

    function handleLoad() {
      remeasureTrack();
    }

    imgs.forEach((img) => {
      if (img.complete) handleLoad();
      else img.addEventListener("load", handleLoad);
    });

    return () => {
      imgs.forEach((img) => img.removeEventListener("load", handleLoad));
    };
  }, [slides, remeasureTrack]);

  const animate = useCallback(
    (time: number) => {
      const playing = playingRef.current;
      const hasMomentum = currentSpeedRef.current > MIN_SPEED;

      if (!playing && !hasMomentum) {
        currentSpeedRef.current = 0;
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      targetSpeedRef.current = playing ? TARGET_SPEED : 0;
      const lerp = playing ? ACCEL_LERP : DECEL_LERP;
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * lerp;

      if (!playing && currentSpeedRef.current < MIN_SPEED) {
        currentSpeedRef.current = 0;
      }

      positionRef.current += currentSpeedRef.current * (delta / 1000);

      const loopWidth = originalTrackWidthRef.current;
      if (loopWidth > 0 && positionRef.current >= loopWidth) {
        positionRef.current -= loopWidth;
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-positionRef.current}px, 0, 0)`;
      }

      if (playing || currentSpeedRef.current > MIN_SPEED) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [],
  );

  const startAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const handleMouseEnter = () => {
    if (slides.length <= 1) return;
    remeasureTrack();
    hasPlayedRef.current = true;
    if (staticLayerRef.current) {
      staticLayerRef.current.style.opacity = "0";
    }
    playingRef.current = true;
    startAnimation();
  };

  const handleMouseLeave = () => {
    playingRef.current = false;
    lastTimeRef.current = 0;
    startAnimation();
  };

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (!slides.length) {
    return <div className="community-card-image community-card-image-empty" aria-hidden="true" />;
  }

  if (slides.length === 1) {
    return (
      <div className="community-card-image">
        <img src={slides[0].url} alt={alt} loading="lazy" decoding="async" draggable={false} />
      </div>
    );
  }

  const loopSlides = [...slides, ...slides];

  return (
    <div
      ref={previewRef}
      className="work-preview community-card-image"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={slides[0].url}
        alt=""
        aria-hidden="true"
        className="work-preview-sizer"
        draggable={false}
        loading="lazy"
      />
      <img
        ref={staticLayerRef}
        src={slides[0].url}
        alt={alt}
        className="work-preview-static"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      <div className="work-preview-viewport">
        <div ref={trackRef} className="work-preview-track">
          {loopSlides.map((slide, index) => (
            <div className="work-preview-slide" key={`${slide.id ?? slide.url}-${index}`}>
              <img
                src={slide.url}
                alt={index === 0 ? alt : ""}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
