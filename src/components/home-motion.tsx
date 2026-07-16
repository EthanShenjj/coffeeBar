"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type MotionConditions = {
  isDesktop: boolean;
  reduceMotion: boolean;
};

export function HomeMotion({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add(
        {
          isDesktop: "(min-width: 768px) and (pointer: fine)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (matchContext) => {
          const { isDesktop, reduceMotion } = matchContext.conditions as MotionConditions;
          if (reduceMotion) return;

          const cleanup: Array<() => void> = [];
          const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
          intro
            .from("[data-hero-eyebrow]", { y: 14, autoAlpha: 0, duration: 0.55 })
            .from("[data-hero-line]", { yPercent: 115, rotation: 2, duration: 0.85, stagger: 0.1 }, "-=0.3")
            .from("[data-hero-copy]", { y: 24, autoAlpha: 0, duration: 0.7 }, "-=0.45")
            .from("[data-hero-action]", { y: 18, autoAlpha: 0, duration: 0.55, stagger: 0.08 }, "-=0.42")
            .from("[data-hero-visual]", { xPercent: 4, autoAlpha: 0, duration: 0.85 }, 0.1)
            .from("[data-hero-visual-copy]", { y: 18, autoAlpha: 0, duration: 0.6 }, 0.45)
            .from("[data-hero-art-shell]", { scale: 0.82, rotation: -5, autoAlpha: 0, duration: 1, ease: "back.out(1.35)" }, 0.35);

          gsap.utils.toArray<HTMLElement>("[data-reveal]", scope.current).forEach((element) => {
            gsap.from(element, {
              y: 48,
              autoAlpha: 0,
              duration: 0.9,
              ease: "power3.out",
              clearProps: "transform,opacity,visibility",
              scrollTrigger: { trigger: element, start: "top 88%", once: true },
            });
          });

          gsap.utils.toArray<HTMLElement>("[data-reveal-group]", scope.current).forEach((group) => {
            const items = group.querySelectorAll<HTMLElement>("[data-reveal-item]");
            gsap.from(items, {
              y: 42,
              autoAlpha: 0,
              duration: 0.8,
              stagger: 0.1,
              ease: "power3.out",
              clearProps: "transform,opacity,visibility",
              scrollTrigger: { trigger: group, start: "top 86%", once: true },
            });
          });

          gsap.to("[data-hero-art-shell]", {
            yPercent: -9,
            rotation: 2,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-hero]",
              start: "top top+=64",
              end: "bottom top",
              scrub: 1,
            },
          });

          gsap.to("[data-orbit='one']", {
            xPercent: 18,
            yPercent: -12,
            duration: 7,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          gsap.to("[data-orbit='two']", {
            xPercent: -14,
            yPercent: 16,
            duration: 9,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          if (isDesktop) {
            const visual = scope.current?.querySelector<HTMLElement>("[data-hero-visual]");
            const artwork = visual?.querySelector<HTMLElement>("[data-artwork]");
            if (visual && artwork) {
              gsap.set(artwork, { transformPerspective: 900, transformOrigin: "center" });
              const rotateX = gsap.quickTo(artwork, "rotationX", { duration: 0.55, ease: "power3.out" });
              const rotateY = gsap.quickTo(artwork, "rotationY", { duration: 0.55, ease: "power3.out" });
              const moveX = gsap.quickTo(artwork, "x", { duration: 0.55, ease: "power3.out" });
              const moveY = gsap.quickTo(artwork, "y", { duration: 0.55, ease: "power3.out" });
              const onMove = (event: PointerEvent) => {
                const bounds = visual.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                const y = (event.clientY - bounds.top) / bounds.height - 0.5;
                rotateX(y * -7);
                rotateY(x * 7);
                moveX(x * 10);
                moveY(y * 10);
              };
              const onLeave = () => {
                rotateX(0);
                rotateY(0);
                moveX(0);
                moveY(0);
              };
              visual.addEventListener("pointermove", onMove);
              visual.addEventListener("pointerleave", onLeave);
              cleanup.push(() => {
                visual.removeEventListener("pointermove", onMove);
                visual.removeEventListener("pointerleave", onLeave);
              });
            }

            scope.current?.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((button) => {
              const moveX = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" });
              const moveY = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" });
              const onMove = (event: PointerEvent) => {
                const bounds = button.getBoundingClientRect();
                moveX((event.clientX - bounds.left - bounds.width / 2) * 0.16);
                moveY((event.clientY - bounds.top - bounds.height / 2) * 0.16);
              };
              const onLeave = () => {
                moveX(0);
                moveY(0);
              };
              button.addEventListener("pointermove", onMove);
              button.addEventListener("pointerleave", onLeave);
              cleanup.push(() => {
                button.removeEventListener("pointermove", onMove);
                button.removeEventListener("pointerleave", onLeave);
              });
            });

            const grid = scope.current?.querySelector<HTMLElement>("[data-card-grid]");
            const glow = grid?.querySelector<HTMLElement>("[data-card-glow]");
            if (grid && glow) {
              const cards = grid.querySelectorAll<HTMLElement>("[data-card]");
              cards.forEach((card) => {
                const onEnter = () => {
                  const gridBounds = grid.getBoundingClientRect();
                  const cardBounds = card.getBoundingClientRect();
                  gsap.set(glow, { width: card.offsetWidth, height: card.offsetHeight });
                  gsap.to(glow, {
                    x: cardBounds.left - gridBounds.left,
                    y: cardBounds.top - gridBounds.top,
                    scale: 1.035,
                    autoAlpha: 1,
                    duration: 0.5,
                    ease: "power3.out",
                    overwrite: "auto",
                  });
                };
                card.addEventListener("pointerenter", onEnter);
                cleanup.push(() => card.removeEventListener("pointerenter", onEnter));
              });
              const onGridLeave = () => gsap.to(glow, { autoAlpha: 0, scale: 0.96, duration: 0.35, ease: "power2.out" });
              grid.addEventListener("pointerleave", onGridLeave);
              cleanup.push(() => grid.removeEventListener("pointerleave", onGridLeave));
            }
          }

          ScrollTrigger.refresh();
          return () => cleanup.forEach((remove) => remove());
        },
      );
    }, scope);

    return () => {
      media.revert();
      context.revert();
    };
  }, []);

  return <div ref={scope}>{children}</div>;
}
