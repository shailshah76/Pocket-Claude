import type { ReactNode } from 'react';

const I = (children: ReactNode, fill = false) =>
  function Icon(props: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill={fill ? 'currentColor' : 'none'}
        stroke={fill ? 'none' : 'currentColor'}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={props.className}
      >
        {children}
      </svg>
    );
  };

export const IconBack = I(<path d="m15 18-6-6 6-6" />);
export const IconChevron = I(<path d="m9 18 6-6-6-6" />);
export const IconDown = I(<><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>);
export const IconSend = I(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>);
export const IconStop = I(<rect x="6.5" y="6.5" width="11" height="11" rx="2" />, true);
export const IconPlus = I(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconGear = I(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>);
export const IconSearch = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconFolder = I(<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />);
export const IconFile = I(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>);
export const IconTerminal = I(<><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></>);
export const IconPencil = I(<><path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></>);
export const IconFilePlus = I(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 12v6" /><path d="M9 15h6" /></>);
export const IconEye = I(<><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>);
export const IconGlobe = I(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></>);
export const IconBot = I(<><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></>);
export const IconList = I(<><path d="M13 5h8" /><path d="M13 12h8" /><path d="M13 19h8" /><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /></>);
export const IconTool = I(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />);
export const IconCheck = I(<path d="M20 6 9 17l-5-5" />);
export const IconX = I(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconShield = I(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></>);
export const IconQuestion = I(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>);
export const IconMap = I(<><path d="M14.1 4.6 9.9 2.5a2 2 0 0 0-1.8 0L3.6 4.8A1 1 0 0 0 3 5.7v14.6a.7.7 0 0 0 1 .6l4.1-2a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.3a1 1 0 0 0 .6-.9V3.7a.7.7 0 0 0-1-.6l-4.1 2a2 2 0 0 1-1.8 0Z" /><path d="M15 5.8v15" /><path d="M9 2.8v15" /></>);
export const IconMore = I(<><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /><circle cx="5" cy="12" r="1.2" /></>);
export const IconBell = I(<><path d="M10.27 21a2 2 0 0 0 3.46 0" /><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" /></>);
export const IconLogout = I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);
export const IconPower = I(<><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></>);
export const IconBranch = I(<><path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>);
export const IconFork = I(<><circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><path d="M12 12v3" /></>);
export const IconPlay = I(<path d="M6 4v16l14-8z" />);
export const IconLaptop = I(<><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" /></>);
export const IconWrap = I(<><path d="M3 6h18" /><path d="M3 12h15a3 3 0 1 1 0 6h-4" /><path d="m16 16-2 2 2 2" /><path d="M3 18h7" /></>);
export const IconUp = I(<path d="m18 15-6-6-6 6" />);
export const IconBackspace = I(<><path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" /><path d="m12 9 6 6" /><path d="m18 9-6 6" /></>);
export const IconWarn = I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
export const IconChat = I(<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />);
