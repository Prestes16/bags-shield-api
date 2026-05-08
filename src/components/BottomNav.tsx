'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? '#4DD4FF' : 'rgba(240,240,255,.45)'}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={active ? 'rgba(77,212,255,.15)' : 'none'}
        />
      </svg>
    ),
  },
  {
    href: '/launchpad',
    label: 'Launch',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-5-5-11-5-11z"
          stroke={active ? '#9945FF' : 'rgba(240,240,255,.45)'}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={active ? 'rgba(153,69,255,.15)' : 'none'}
        />
        <circle cx="12" cy="13" r="2" fill={active ? '#9945FF' : 'rgba(240,240,255,.45)'} />
      </svg>
    ),
  },
  {
    href: '/swap',
    label: 'Swap',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 16V4M7 4L4 7M7 4L10 7"
          stroke={active ? '#4DD4FF' : 'rgba(240,240,255,.45)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 8V20M17 20L14 17M17 20L20 17"
          stroke={active ? '#4DD4FF' : 'rgba(240,240,255,.45)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke={active ? '#4DD4FF' : 'rgba(240,240,255,.45)'} strokeWidth="1.8" />
        <path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
          stroke={active ? '#4DD4FF' : 'rgba(240,240,255,.45)'}
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(8,8,17,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
      }}
    >
      {NAV.map(({ href, label, icon }) => {
        const active = path === href || (href !== '/' && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none',
              transition: 'transform .18s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon(active)}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.04em',
                color: active ? '#4DD4FF' : 'rgba(240,240,255,.45)',
                transition: 'color .18s',
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
