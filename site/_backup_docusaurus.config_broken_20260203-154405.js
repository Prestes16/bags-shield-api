// @ts-check
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Bags Shield',
  tagline: 'Solana Intelligence Layer',
  url: 'https://bagsshield.org',
  baseUrl: '/',
  // Luna Fix: Configuração correta para links quebrados
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'warn', 
  
  favicon: 'img/favicon.ico',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  customFields: {
    appUrl: 'https://app.bagsshield.org',
    apiHealthUrl: 'https://bags-shield-api.vercel.app/api/health',
  },

  presets: [
    [
      'classic',
      ({
        docs: { sidebarPath: require.resolve('./sidebars.js') },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      }),
    ],
  ],

  themeConfig:
    ({
      colorMode: { defaultMode: 'dark', disableSwitch: true, respectPrefersColorScheme: false },
      navbar: {
        title: 'Bags Shield',
        logo: { alt: 'Bags Shield Logo', src: 'img/logo.svg' },
        items: [
          { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
          { to: 'https://app.bagsshield.org', label: 'Launch App', position: 'right', className: 'navbar-cta' },
          { href: 'https://github.com/Prestes16/bags-shield-site', label: 'GitHub', position: 'right' },
        ],
      },
      footer: {
        style: 'dark',
        copyright: ©  Bags Shield. Built for Solana.,
      },
      prism: { theme: lightCodeTheme, darkTheme: darkCodeTheme },
    }),
};

module.exports = config;
