'use client';

import { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, App, Badge, Avatar, Drawer, Descriptions, Switch,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, KeyOutlined,
  HistoryOutlined, UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminsApi } from '@/services/api';
import { useSession } from 'next-auth/react';
import dayjs from '@/lib/dayjs';
import type { AdminUser } from '@/types';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  super_admin:      'red',
  ops:              'blue',
  content_reviewer: 'green',
};

// ── Create / Edit Admin Drawer ────────────────────────────────────────────────

function AdminFormDrawer({
  admin,
  open,
  onClose,
  onSave,
}: {
  admin: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSave: (vals: Record<string, unknown>) => void;
}) {
  const [form] = Form.useForm();
  const isEdit = !!admin;

  return (
    <Drawer
      title={isEdit ? `Edit — ${admin.username}` : 'Create Admin'}
      placement="right"
      width={440}
      open={open}
      onClose={onClose}
      afterOpenChange={(v) => {
        if (v && admin) form.setFieldsValue(admin);
        else if (!v) form.resetFields();
      }}
      extra={
        <Button
          type="primary"
          onClick={() => form.validateFields().then(onSave)}
        >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        {!isEdit && (
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
        )}
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: !isEdit, type: 'email' }]}
        >
          <Input type="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
          rules={isEdit ? [] : [{ required: true, min: 8 }]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: !isEdit }]}
        >
          <Select
            options={[
              { label: 'Super Admin',       value: 'super_admin' },
              { label: 'Ops',               value: 'ops' },
              { label: 'Content Reviewer',  value: 'content_reviewer' },
            ]}
          />
        </Form.Item>
        {isEdit && (
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}

// ── Audit Log Drawer ──────────────────────────────────────────────────────────

function LogDrawer({ adminId, open, onClose }: {
  adminId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-logs', adminId],
    queryFn:  () => adminsApi.logs(adminId!, { page: 1, limit: 50 }),
    enabled:  !!adminId,
  });

  return (
    <Drawer
      title="Audit Log"
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      loading={isLoading}
    >
      <Table
        dataSource={data?.data ?? []}
        rowKey="id"
        pagination={false}
        size="small"
        columns={[
          { title: 'Action',  dataIndex: 'action',     ellipsis: true },
          { title: 'Target',  dataIndex: 'targetType', width: 100, render: (v: string | null) => v ?? '—' },
          { title: 'Date',    dataIndex: 'createdAt',  width: 120, render: (v: string) => dayjs(v).format('MMM D HH:mm') },
        ]}
      />
    </Drawer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { message }   = App.useApp();
  const queryClient   = useQueryClient();
  const { data: session } = useSession();

  const [editing,    setEditing]    = useState<AdminUser | null>(null);
  const [creating,   setCreating]   = useState(false);
  const [logsFor,    setLogsFor]    = useState<string | null>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn:  adminsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (vals: Record<string, unknown>) =>
      adminsApi.create({
        username:    vals.username as string,
        email:       vals.email    as string,
        password:    vals.password as string,
        role:        vals.role     as string,
        permissions: (vals.permissions as Record<string, boolean>) ?? {},
      }),
    onSuccess: () => {
      message.success('Admin created');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => message.error('Failed to create admin'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...vals }: Record<string, unknown> & { id: string }) =>
      adminsApi.update(id, vals as Parameters<typeof adminsApi.update>[1]),
    onSuccess: () => {
      message.success('Admin updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => message.error('Failed to update admin'),
  });

  const deactivateMutation = useMutation({
    mutationFn: adminsApi.deactivate,
    onSuccess: () => {
      message.success('Admin deactivated');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => message.error('Failed to deactivate'),
  });

  const columns = [
    {
      title: 'Admin',
      key:   'admin',
      render: (_: unknown, a: AdminUser) => (
        <Space>
          <Avatar style={{ background: '#FF6B35' }}>
            {a.username[0]?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{a.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{a.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title:     'Role',
      dataIndex: 'role',
      width:     160,
      render:    (v: string) => (
        <Tag color={ROLE_COLORS[v] ?? 'default'}>
          {v.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title:  'Status',
      key:    'status',
      width:  90,
      render: (_: unknown, a: AdminUser) => (
        <Badge
          status={a.isActive ? 'success' : 'default'}
          text={a.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      title:     'Last Login',
      dataIndex: 'lastLoginAt',
      width:     130,
      render:    (v: string | null) => (v ? dayjs(v).fromNow() : '—'),
    },
    {
      title:     'Created',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  130,
      render: (_: unknown, a: AdminUser) => {
        const isSelf = a.id === session?.admin?.id;
        return (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(a)}
            />
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => setLogsFor(a.id)}
              title="Audit Logs"
            />
            {!isSelf && a.isActive && (
              <Popconfirm
                title="Deactivate this admin?"
                onConfirm={() => deactivateMutation.mutate(a.id)}
                okText="Deactivate"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  title="Deactivate"
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Admin Accounts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          New Admin
        </Button>
      </div>

      <Table<AdminUser>
        dataSource={admins ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      {/* Create drawer */}
      <AdminFormDrawer
        admin={null}
        open={creating}
        onClose={() => setCreating(false)}
        onSave={(vals) => createMutation.mutate(vals)}
      />

      {/* Edit drawer */}
      <AdminFormDrawer
        admin={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={(vals) =>
          editing && updateMutation.mutate({ id: editing.id, ...vals })
        }
      />

      {/* Audit log drawer */}
      <LogDrawer
        adminId={logsFor}
        open={!!logsFor}
        onClose={() => setLogsFor(null)}
      />
    </Space>
  );
}
