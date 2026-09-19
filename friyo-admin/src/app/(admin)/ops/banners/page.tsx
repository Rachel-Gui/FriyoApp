'use client';

import { useState } from 'react';
import {
  Table, Button, Space, Tag, Image, Drawer, Form, Input,
  Select, DatePicker, App, Typography, Switch, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bannersApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { Banner } from '@/types';

const { Title } = Typography;

// ── Banner Form Drawer ────────────────────────────────────────────────────────

function BannerDrawer({
  banner,
  open,
  onClose,
  onSave,
}: {
  banner: Banner | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: Partial<Banner>) => void;
}) {
  const [form] = Form.useForm();
  const [preview, setPreview] = useState<string>('');
  const isEdit = !!banner;

  return (
    <Drawer
      title={isEdit ? 'Edit Banner' : 'New Banner'}
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      afterOpenChange={(v) => {
        if (v && banner) {
          form.setFieldsValue({
            ...banner,
            startAt: banner.startAt ? dayjs(banner.startAt) : null,
            endAt:   banner.endAt   ? dayjs(banner.endAt)   : null,
          });
          setPreview(banner.imageUrl ?? '');
        } else if (!v) {
          form.resetFields();
          setPreview('');
        }
      }}
      extra={
        <Button
          type="primary"
          onClick={() =>
            form.validateFields().then((vals) =>
              onSave({
                ...vals,
                startAt: vals.startAt?.toISOString(),
                endAt:   vals.endAt?.toISOString(),
              }),
            )
          }
        >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="Banner title" />
        </Form.Item>

        <Form.Item name="imageUrl" label="Image URL" rules={[{ required: true, type: 'url' }]}>
          <Input
            placeholder="https://…"
            onChange={(e) => setPreview(e.target.value)}
          />
        </Form.Item>

        {/* Live preview */}
        {preview && (
          <div style={{ marginBottom: 16 }}>
            <Image
              src={preview}
              alt="Preview"
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
          </div>
        )}

        <Form.Item name="linkUrl" label="Link URL">
          <Input placeholder="https://… (optional)" />
        </Form.Item>

        <Form.Item name="status" label="Status" initialValue="active">
          <Select
            options={[
              { label: 'Active',   value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
        </Form.Item>

        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="startAt" label="Start Date" style={{ flex: 1 }}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endAt" label="End Date" style={{ flex: 1 }}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      </Form>
    </Drawer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BannersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [adding,  setAdding]  = useState(false);

  const { data: banners, isLoading } = useQuery({
    queryKey: ['banners'],
    queryFn:  bannersApi.list,
  });

  const createMutation = useMutation({
    mutationFn: bannersApi.create,
    onSuccess: () => {
      message.success('Banner created');
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
    onError: () => message.error('Failed to create banner'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: Partial<Banner> & { id: string }) =>
      bannersApi.update(id, payload),
    onSuccess: () => {
      message.success('Banner updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
    onError: () => message.error('Failed to update banner'),
  });

  const deleteMutation = useMutation({
    mutationFn: bannersApi.delete,
    onSuccess: () => {
      message.success('Banner deleted');
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
    onError: () => message.error('Failed to delete banner'),
  });

  const columns = [
    {
      title:  'Preview',
      key:    'preview',
      width:  90,
      render: (_: unknown, b: Banner) => (
        <Image
          src={b.imageUrl}
          width={72}
          height={42}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          alt={b.title}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        />
      ),
    },
    {
      title:     'Title',
      dataIndex: 'title',
      render:    (v: string, b: Banner) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {b.linkUrl && (
            <a href={b.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              {b.linkUrl}
            </a>
          )}
        </div>
      ),
    },
    {
      title:     'Status',
      dataIndex: 'status',
      width:     100,
      render:    (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag>
      ),
    },
    {
      title:  'Schedule',
      key:    'schedule',
      width:  200,
      render: (_: unknown, b: Banner) => (
        <div style={{ fontSize: 12 }}>
          {b.startAt ? dayjs(b.startAt).format('MMM D, HH:mm') : '—'}
          {' → '}
          {b.endAt ? dayjs(b.endAt).format('MMM D, HH:mm') : 'No end'}
        </div>
      ),
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
      width:  90,
      render: (_: unknown, b: Banner) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(b)} />
          <Popconfirm
            title="Delete banner?"
            onConfirm={() => deleteMutation.mutate(b.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Banners</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
          New Banner
        </Button>
      </div>

      <Table<Banner>
        dataSource={banners ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <BannerDrawer
        banner={null}
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(vals) => createMutation.mutate(vals)}
      />
      <BannerDrawer
        banner={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={(vals) =>
          editing && updateMutation.mutate({ id: editing.id, ...vals })
        }
      />
    </Space>
  );
}
