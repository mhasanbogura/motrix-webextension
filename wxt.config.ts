import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const RELEASE_VERSION = '1.6.5';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}-mv3.zip',
  },
  manifest: {
    name: 'Motrix WebExtension',
    description: 'Motrix WebExtension with a full IDM-style picker and media/link capture',
    version: RELEASE_VERSION,
    version_name: RELEASE_VERSION,
    minimum_chrome_version: '116',
    default_locale: 'en_US',
    action: {
      default_title: 'Motrix',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    permissions: [
      'downloads',
      'windows',
      'storage',
      'contextMenus',
      'cookies',
      'webRequest',
    ],
    host_permissions: [
      'http://*/*',
      'https://*/*',
      'http://127.0.0.1:16800/*',
      'http://localhost:16800/*',
      'http://[::1]:16800/*',
    ],
  },
});
