'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App } from 'antd';
import type { ReactNode } from 'react';

const THEME = {
  token: {
    colorPrimary:      '#FF6B35',   // Friyo orange
    colorBgContainer:  '#ffffff',
    borderRadius:      8,
    fontFamily:        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      siderBg:     '#0f172a',
      triggerBg:   '#1e293b',
    },
    Menu: {
      darkItemBg:         '#0f172a',
      darkSubMenuItemBg:  '#1e293b',
      darkItemSelectedBg: '#FF6B35',
    },
  },
};

export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={THEME}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
