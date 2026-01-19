import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => {
    const baseManifest = {
      name: 'Auto Tab Groups',
      description: 'Automatically groups tabs by domain.',
      author: 'Nitzan Papini',
      permissions: ['tabs', 'storage', 'tabGroups'],
      icons: {
        16: 'icon/16.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    };

    if (browser === 'chrome') {
      return {
        ...baseManifest,
        side_panel: {
          default_path: 'sidebar.html',
        },
      };
    }

    if (browser === 'firefox') {
      return {
        ...baseManifest,
        browser_specific_settings: {
          gecko: {
            id: '{442789cf-4ff6-4a85-bf5b-53aa3282f1a2}',
            strict_min_version: '139.0',
          },
        },
        sidebar_action: {
          default_panel: 'sidebar.html',
          default_icon: {
            16: 'icon/16.png',
            48: 'icon/48.png',
            128: 'icon/128.png',
          },
          default_title: 'Auto Tab Groups',
        },
      };
    }

    return baseManifest;
  },
});
