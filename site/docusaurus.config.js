// @ts-check
const prism = require('prism-react-renderer');
const lightCodeTheme = prism.themes.github;
const darkCodeTheme = prism.themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Bags Shield',
  tagline: 'Solana Intelligence Layer',
  // URL DE PRODUÇÃO CORRETA (Cloudflare Pages)
  url: 'https://bags-shield.pages.dev',
  baseUrl: '/',

  // Evita quebra de build por links mortos temporários
  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  favicon: 'img/favicon.ico',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  customFields: {
    appUrl: 'https://app.bagsshield.org',
    apiHealthUrl: 'https://bags-shield-api.vercel.app/api/health',
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // "Edit this page" aponta para o GitHub; edições lá + novo deploy atualizam o site
          editUrl: 'https://github.com/Prestes16/bags-shield-api/edit/main/site/',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      },
    ],
  ],

  themeConfig: {
    colorMode: { defaultMode: 'dark', disableSwitch: true, respectPrefersColorScheme: false },
    navbar: {
      title: 'Bags Shield',
      logo: { alt: 'Bags Shield Logo', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { to: 'https://app.bagsshield.org', label: 'Launch App', position: 'right', className: 'navbar-cta' },
        { href: 'https://github.com/Prestes16/bags-shield-site', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      // Sintaxe segura para evitar erro de encoding no Windows
      copyright: 'Copyright © ' + new Date().getFullYear() + ' Bags Shield. Built for Solana.',
    },
    prism: { theme: lightCodeTheme, darkTheme: darkCodeTheme },
  },
};

module.exports = config;
