'use client';

import { useState }  from 'react';
import { Layout, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Sidebar } from '@/components/layout/Sidebar';

const { Header, Content } = Layout;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const siderWidth = collapsed ? 64 : 220;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />

      {/* Main area shifts right by sider width */}
      <Layout style={{ marginLeft: siderWidth, transition: 'margin 0.2s' }}>
        <Header
          style={{
            position:       'sticky',
            top:            0,
            zIndex:         10,
            padding:        '0 24px',
            background:     '#fff',
            display:        'flex',
            alignItems:     'center',
            height:         64,
            boxShadow:      '0 1px 4px rgba(0,0,0,0.08)',
            gap:            16,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
            style={{ fontSize: 18 }}
          />
        </Header>

        <Content
          style={{
            padding:    24,
            minHeight:  'calc(100vh - 64px)',
            background: '#f5f7fa',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
