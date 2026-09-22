import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.honmamisuzu.kejian',
  appName: '课间',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#e7e8e4',
    webContentsDebuggingEnabled: false,
  },
}

export default config
