"use client";

import PortalErrorView from "@/app/components/PortalErrorView";

export default function PortalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalErrorView {...props} />;
}
