type IconProps = { className?: string };

const base = { fill: "none", "aria-hidden": true, xmlns: "http://www.w3.org/2000/svg" } as const;

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 16 16">
      <path
        d="M3.33337 8.00016H12.6667M12.6667 8.00016L8.00004 3.3335M12.6667 8.00016L8.00004 12.6668"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLargeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 24 24">
      <path
        d="M5 12H19M19 12L12 5M19 12L12 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 12 12">
      <path
        d="M2 6L10 6M2 9H10M2 3L10 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 24 24">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 16 16">
      <path
        d="M12.0002 2L10.0002 2C9.63197 2 9.3335 2.29848 9.3335 2.66667V13.3333C9.3335 13.7015 9.63197 14 10.0002 14H12.0002C12.3684 14 12.6668 13.7015 12.6668 13.3333L12.6668 2.66667C12.6668 2.29848 12.3684 2 12.0002 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.00016 2L4.00016 2C3.63197 2 3.3335 2.29848 3.3335 2.66667L3.3335 13.3333C3.3335 13.7015 3.63197 14 4.00016 14H6.00016C6.36835 14 6.66683 13.7015 6.66683 13.3333L6.66683 2.66667C6.66683 2.29848 6.36835 2 6.00016 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 16 16">
      <path
        d="M3.3335 3.33373C3.33343 3.09912 3.39526 2.86865 3.51275 2.66559C3.63024 2.46252 3.79924 2.29406 4.00266 2.17719C4.20609 2.06033 4.43675 1.99921 4.67136 2.00001C4.90596 2.0008 5.1362 2.06349 5.33883 2.18173L13.3368 6.84706C13.5387 6.96418 13.7062 7.13222 13.8228 7.3344C13.9393 7.53657 14.0008 7.76579 14.001 7.99915C14.0012 8.23251 13.9401 8.46184 13.8239 8.66422C13.7077 8.86659 13.5405 9.03492 13.3388 9.15239L5.33883 13.8191C5.1362 13.9373 4.90596 14 4.67136 14.0008C4.43675 14.0016 4.20609 13.9405 4.00266 13.8236C3.79924 13.7067 3.63024 13.5383 3.51275 13.3352C3.39526 13.1321 3.33343 12.9017 3.3335 12.6671L3.3335 3.33373Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 17 16">
      <path
        d="M15.1668 4.66667L9.17283 8.48467C8.96943 8.60281 8.73839 8.66504 8.50316 8.66504C8.26794 8.66504 8.0369 8.60281 7.8335 8.48467L1.8335 4.66667M3.16683 2.66667H13.8335C14.5699 2.66667 15.1668 3.26362 15.1668 4V12C15.1668 12.7364 14.5699 13.3333 13.8335 13.3333H3.16683C2.43045 13.3333 1.8335 12.7364 1.8335 12V4C1.8335 3.26362 2.43045 2.66667 3.16683 2.66667Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} viewBox="0 0 17 16">
      <path
        d="M8.5 0.5C12.6421 0.5 16 3.85786 16 8C16 12.1421 12.6421 15.5 8.5 15.5C4.35786 15.5 1 12.1421 1 8C1 3.85786 4.35786 0.5 8.5 0.5Z"
        stroke="currentColor"
      />
      <path
        d="M12.5 5L7 10.5L4.5 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
