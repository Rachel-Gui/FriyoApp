'use client';

import { useState, useCallback } from 'react';
import {
  Table, Input, Select, Space, Button, Tag, Avatar, Drawer,
  Tabs, Descriptions, Statistic, Row, Col, Modal, Form,
  App, Typography, Badge,
} from 'antd';
import {
  SearchOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined,
  UserOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { AppUser } from '@/types';

const { Title, Text } = Typography;

// ── Ban Modal ─────────────────────────────────────────────────────────────────

function BanModal({
  user,
  open,
  onClose,
  onBan,
}: {
  user: AppUser | null;
  open: boolean;
  onClose: () => void;
  onBan: (id: string, reason: string, days: number) => void;
}) {
  const [form] = Form.useForm();

  const submit = () => {
    form.validateFields().then((vals) => {
      if (user) onBan(user.id, vals.reason, vals.durationDays ?? 0);
      form.resetFields();
    });
  };

  return (
    <Modal
      title={`Ban User — ${user?.name}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Ban User"
      okButtonProps={{ danger: true }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="Reason"
          rules={[{ required: true, message: 'Please provide a ban reason' }]}
        >
          <Input.TextArea rows={3} placeholder="Why is this user being banned?" />
        </Form.Item>
        <Form.Item name="durationDays" label="Duration (days, 0 = permanent)">
          <Input type="number" min={0} defaultValue={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── User Detail Drawer ────────────────────────────────────────────────────────

function UserDetailDrawer({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn:  () => usersApi.detail(userId!),
    enabled:  !!userId,
  });

  return (
    <Drawer
      title="User Detail"
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      loading={isLoading}
    >
      {user && (
        <Tabs
          items={[
            {
              key:   'profile',
              label: 'Profile',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Space>
                    <Avatar size={64} src={user.avatarUrl} icon={<UserOutlined />} />
                    <div>
                      <Title level={5} style={{ margin: 0 }}>{user.name}</Title>
                      <Text type="secondary">{user.email ?? user.phone ?? 'No contact'}</Text>
                    </div>
                  </Space>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="User ID">
                      <Text code>{user.id}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Auth Provider">
                      <Tag>{user.authProvider}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Badge
                        status={user.isBanned ? 'error' : 'success'}
                        text={user.isBanned ? 'Banned' : 'Active'}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="Diet Type">
                      {user.profile?.dietType ?? '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Health Goals">
                      {user.profile?.healthGoals?.join(', ') || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Joined">
                      {dayjs(user.createdAt).format('MMM D, YYYY')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Active">
                      {user.lastActiveAt ? dayjs(user.lastActiveAt).fromNow() : 'Never'}
                    </Descriptions.Item>
                  </Descriptions>
                </Space>
              ),
            },
            {
              key:   'activity',
              label: 'Activity',
              children: user.stats ? (
                <Row gutter={[12, 12]}>
                  {[
                    { label: 'Meals Logged',   value: user.stats.mealCount,   color: '#FF6B35' },
                    { label: 'Posts Created',  value: user.stats.postCount,   color: '#52c41a' },
                    { label: 'Fridge Items',   value: user.stats.fridgeCount, color: '#1677ff' },
                    { label: 'AI Scans',       value: user.stats.scanCount,   color: '#722ed1' },
                  ].map(({ label, value, color }) => (
                    <Col span={12} key={label}>
                      <Statistic
                        title={label}
                        value={value}
                        valueStyle={{ color, fontWeight: 700 }}
                      />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Text type="secondary">No activity data</Text>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState<string>('');
  const [detail,  setDetail]  = useState<string | null>(null);
  const [banUser, setBanUser] = useState<AppUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, status],
    queryFn:  () => usersApi.list({ page, limit: 20, search, status }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason, days }: { id: string; reason: string; days: number }) =>
      usersApi.ban(id, { reason, durationDays: days }),
    onSuccess: () => {
      message.success('User banned');
      setBanUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => message.error('Failed to ban user'),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => usersApi.unban(id),
    onSuccess: () => {
      message.success('User unbanned');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => message.error('Failed to unban user'),
  });

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, u: AppUser) => (
        <Space>
          <Avatar src={u.avatarUrl} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{u.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {u.email ?? u.phone ?? 'No contact'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title:     'Joined',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
    {
      title:     'Last Active',
      dataIndex: 'lastActiveAt',
      width:     120,
      render:    (v: string | null) => (v ? dayjs(v).fromNow() : <Text type="secondary">—</Text>),
    },
    {
      title:  'Status',
      key:    'status',
      width:  100,
      render: (_: unknown, u: AppUser) =>
        u.isBanned ? (
          <Badge status="error"   text="Banned" />
        ) : (
          <Badge status="success" text="Active" />
        ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  140,
      render: (_: unknown, u: AppUser) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetail(u.id)}
          />
          {u.isBanned ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => unbanMutation.mutate(u.id)}
              title="Unban"
            />
          ) : (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => setBanUser(u)}
              title="Ban"
            />
          )}
        </Space>
      ),
    },
  ];

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Users</Title>

      {/* Filters */}
      <Space wrap>
        <Input.Search
          placeholder="Search name, email, phone…"
          onSearch={handleSearch}
          allowClear
          style={{ width: 280 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="Filter by status"
          style={{ width: 160 }}
          allowClear
          onChange={(v) => { setStatus(v ?? ''); setPage(1); }}
          options={[
            { label: 'Active',  value: 'active' },
            { label: 'Banned',  value: 'banned' },
          ]}
        />
      </Space>

      <Table<AppUser>
        dataSource={data?.data ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current:   page,
          pageSize:  20,
          total:     data?.total,
          onChange:  (p) => setPage(p),
          showTotal: (t) => `${t} users`,
        }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <UserDetailDrawer
        userId={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
      />

      <BanModal
        user={banUser}
        open={!!banUser}
        onClose={() => setBanUser(null)}
        onBan={(id, reason, days) =>
          banMutation.mutate({ id, reason, days })
        }
      />
    </Space>
  );
}
