export const Icon = ({ type }) => {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "2.2",
    viewBox: "0 0 24 24",
  };

  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7h14a3 3 0 0 1 3 3v8H5a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2h13" />
        <path d="M16 14h5" />
        <circle cx="17.5" cy="14" r="1" />
      </>
    ),
    swap: (
      <>
        <path d="M17 3l4 4-4 4" />
        <path d="M3 7h18" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M21 17H3" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 0 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.07a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 0 1-2.97-2.97l.05-.05A1.8 1.8 0 0 0 4 14.68a1.8 1.8 0 0 0-1.66-1.1H2.1a2.1 2.1 0 0 1 0-4.2h.07A1.8 1.8 0 0 0 3.83 8.3a1.8 1.8 0 0 0-.36-1.98l-.05-.05A2.1 2.1 0 1 1 6.39 3.3l.05.05a1.8 1.8 0 0 0 1.98.36h.01a1.8 1.8 0 0 0 1.1-1.66V1.8a2.1 2.1 0 0 1 4.2 0v.07a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05A1.8 1.8 0 0 0 19.4 8.1c.45.66 1.02 1.1 1.66 1.1h.14a2.1 2.1 0 0 1 0 4.2h-.07A1.8 1.8 0 0 0 19.4 15Z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.2-3.2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    qr: (
      <>
        <path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4z" />
        <path d="M15 15h2v2h-2zM19 15h1v1M15 20h1M20 19v1M18 18h2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 1-15.1 6.6" />
        <path d="M3 12A9 9 0 0 1 18.1 5.4" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    bag: (
      <>
        <path d="M6 7h12l-1 14H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
        <path d="M9 12h6" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    chevronLeft: (
      <>
        <path d="M15 18l-6-6 6-6" />
      </>
    ),
    trend: (
      <>
        <path d="M7 17V7" />
        <path d="M3 11l4-4 4 4" />
      </>
    ),
  };

  return <svg aria-hidden="true" {...common}>{paths[type]}</svg>;
};
