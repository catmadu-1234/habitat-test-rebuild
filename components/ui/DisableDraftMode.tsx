"use client";

import { useVisualEditingEnvironment } from "next-sanity/hooks";

// Lets an editor leave Draft Mode when viewing the site outside Presentation.
export default function DisableDraftMode() {
  const environment = useVisualEditingEnvironment();
  if (environment !== "standalone") return null;

  return (
    <a
      href="/api/draft-mode/disable"
      className="fixed bottom-4 right-4 z-[999] rounded-button bg-brand-purple px-3 py-2 text-button text-paper shadow-button"
    >
      Disable Draft Mode
    </a>
  );
}
