/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: 'category',
      label: 'API',
      items: ['api/overview', 'api/swap', 'api/quote', 'api/authentication'],
    },
    {
      type: 'category',
      label: 'Security',
      items: ['security/overview', 'security/audits', 'security/best-practices'],
    },
    {
      type: 'category',
      label: 'Fees & Rewards',
      items: ['fees-and-rewards/overview', 'fees-and-rewards/partner-fees', 'fees-and-rewards/cashback'],
    },
    {
      type: 'category',
      label: 'Legal',
      items: ['legal/terms', 'legal/privacy'],
    },
  ],
};

module.exports = sidebars;
