"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackAnalytics, type AnalyticsProperties } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: string;
  eventProperties?: AnalyticsProperties;
};

export function TrackedLink({ eventName, eventProperties, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackAnalytics(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
