// Tailwind utilities tied to left/right. In right-to-left languages they point the wrong way, so use the
// logical versions (ms/me/ps/pe/start/end, text-start/end) or put an rtl: variant on the same line.
export const PHYSICAL_UTILITY =
  /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)\b|border-[lr](?:-|\b)|rounded-(?:l|r|tl|tr|bl|br)(?:-|\b)|float-(?:left|right)\b|-?translate-x-|bg-gradient-to-(?:l|r|tl|tr|bl|br)\b|space-x-|divide-x)/;
