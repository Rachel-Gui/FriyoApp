'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession }             from 'next-auth/react';
import { Layout, Menu, Typography, Avatar, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined, UserOutlined, ExperimentOutlined,
  BookOutlined, TeamOutlined, BarChartOutlined,
  PictureOutlined, BellOutlined, FileTextOutlined,
  SafetyOutlined, LogoutOutlined, SettingOutlined,
} from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import type { AdminRole } from '@/types';

const { Sider }  = Layout;
const { Text }   = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const ALL_MENU_ITEMS: (MenuItem & { roles?: AdminRole[] })[] = [
  {
    key:   '/dashboard',
    icon:  <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key:   '/users',
    icon:  <UserOutlined />,
    label: 'Users',
    roles: ['super_admin', 'ops'],
  },
  {
    key:   '/ingredients',
    icon:  <ExperimentOutlined />,
    label: 'Ingredients',
    roles: ['super_admin'],
  },
  {
    key:   '/recipes',
    icon:  <BookOutlined />,
    label: 'Recipes',
    roles: ['super_admin', 'content_reviewer'],
  },
  {
    key:   '/community',
    icon:  <TeamOutlined />,
    label: 'Community',
    roles: ['super_admin', 'content_reviewer'],
  },
  {
    key:   '/analytics',
    icon:  <BarChartOutlined />,
    label: 'Analytics',
    roles: ['super_admin', 'ops'],
  },
  {
    type:  'divider' as const,
    key:   'divider-ops',
  },
  {
    key:   'ops',
    icon:  <SettingOutlined />,
    label: 'Operations',
    roles: ['super_admin', 'ops'],
    children: [
      {
        key:   '/ops/banners',
        icon:  <PictureOutlined />,
        label: 'Banners',
      },
      {
        key:   '/ops/notifications',
        icon:  <BellOutlined />,
        label: 'Notifications',
      },
      {
        key:   '/ops/agreements',
        icon:  <FileTextOutlined />,
        label: 'Agreements',
      },
    ],
  },
  {
    key:   '/admins',
    icon:  <SafetyOutlined />,
    label: 'Admin Accounts',
    roles: ['super_admin'],
  },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  const role = session?.admin?.role as AdminRole | undefined;

  const visibleItems = useMemo(() => {
    const filter = (items: typeof ALL_MENU_ITEMS): MenuItem[] =>
      items
        .filter((item) => {
          if ('roles' in item && item.roles && role) {
            return item.roles.includes(role);
          }
          return true;
        })
        .map((item) => {
          if ('children' in item && item.children) {
            return {
              ...item,
              children: filter(item.children as typeof ALL_MENU_ITEMS),
            };
          }
          return item;
        });
    return filter(ALL_MENU_ITEMS);
  }, [role]);

  const selectedKeys = useMemo(() => {
    // Match the deepest path
    const candidates = [pathname];
    if (pathname.startsWith('/ops/')) candidates.push('/ops');
    return candidates;
  }, [pathname]);

  const openKeys = useMemo(() => {
    if (pathname.startsWith('/ops/')) return ['ops'];
    return [];
  }, [pathname]);

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      signOut({ callbackUrl: '/login' });
    } else {
      router.push(key);
    }
  };

  return (
    <Sider
      collapsed={collapsed}
      width={220}
      collapsedWidth={64}
      style={{
        overflow:   'auto',
        height:     '100vh',
        position:   'fixed',
        left:       0,
        top:        0,
        bottom:     0,
        background: '#0f172a',
        display:    'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <div
        style={{
          height:         64,
          display:        'flex',
          alignItems:     'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding:        collapsed ? '0' : '0 20px',
          gap:            10,
          borderBottom:   '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            width:          32,
            height:         32,
            minWidth:       32,
            borderRadius:   8,
            background:     '#FF6B35',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontWeight:     700,
            color:          '#fff',
            fontSize:       15,
          }}
        >
          F
        </div>
        {!collapsed && (
          <Text style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Friyo Admin
          </Text>
        )}
      </div>

      {/* Navigation menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        defaultOpenKeys={openKeys}
        items={visibleItems}
        onClick={handleClick}
        style={{ flex: 1, background: '#0f172a', borderRight: 'none', marginTop: 8 }}
      />

      {/* User info + logout at bottom */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding:   collapsed ? '12px 0' : '12px 16px',
        }}
      >
        {!collapsed && session?.admin && (
          <Space style={{ marginBottom: 8, width: '100%' }}>
            <Avatar
              size={32}
              style={{ background: '#FF6B35', flexShrink: 0 }}
            >
              {session.admin.username[0]?.toUpperCase()}
            </Avatar>
            <div style={{ overflow: 'hidden' }}>
              <Text
                style={{ color: '#fff', fontSize: 13, display: 'block' }}
                ellipsis
              >
                {session.admin.username}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                {session.admin.role.replace(/_/g, ' ')}
              </Text>
            </div>
          </Space>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectable={false}
          items={[
            {
              key:   'logout',
              icon:  <LogoutOutlined />,
              label: 'Sign Out',
              style: { color: '#ff4d4f' },
            },
          ]}
          onClick={handleClick}
          style={{ background: '#0f172a', borderRight: 'none' }}
        />
      </div>
    </Sider>
  );
}
