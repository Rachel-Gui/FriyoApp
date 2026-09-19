'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, App, Badge, Descriptions, Drawer, Switch,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agreementsApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { Agreement, AgreementType } from '@/types';

// Lazy-load markdown editor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const { Title, Text } = Typography;

const TYPE_LABELS: Record<AgreementType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy:   'Privacy Policy',
  community_rules:  'Community Rules',
};

// ── Create Agreement Drawer ───────────────────────────────────────────────────

function CreateAgreementDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (vals: {
    type: AgreementType;
    version: string;
    content: string;
    publishNow: boolean;
  }) => void;
}) {
  const [form]    = Form.useForm();
  const [content, setContent] = useState('');

  return (
    <Drawer
      title="New Agreement"
      placement="right"
      width={700}
      open={open}
      onClose={() => { onClose(); form.resetFields(); setContent(''); }}
      extra={
        <Button
          type="primary"
          onClick={() =>
            form.validateFields().then((vals) =>
              onCreate({ ...vals, content }),
            )
          }
        >
          Create
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select
            options={Object.entries(TYPE_LABELS).map(([k, v]) => ({
              label: v,
              value: k,
            }))}
            placeholder="Select agreement type"
          />
        </Form.Item>
        <Form.Item name="version" label="Version" rules={[{ required: true }]}>
          <Input placeholder="e.g. 2.1.0" />
        </Form.Item>
        <Form.Item name="publishNow" label="Publish immediately?" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Content (Markdown)" required>
          <div data-color-mode="light">
            <MDEditor
              value={content}
              onChange={(v) => setContent(v ?? '')}
              height={400}
            />
          </div>
        </Form.Item>
      </Form>
    </Drawer>
  );
}

// ── Agreement Preview Drawer ──────────────────────────────────────────────────

function PreviewDrawer({
  agreement,
  open,
  onClose,
  onPublish,
}: {
  agreement: Agreement | null;
  open: boolean;
  onClose: () => void;
  onPublish: (id: string) => void;
}) {
  const MDPreview = dynamic(() => import('@uiw/react-md-editor').then((m) => m.default.Markdown), {
    ssr: false,
  });

  if (!agreement) return null;

  return (
    <Drawer
      title={`${TYPE_LABELS[agreement.type]} v${agreement.version}`}
      placement="right"
      width={680}
      open={open}
      onClose={onClose}
      extra={
        !agreement.isCurrent ? (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => onPublish(agreement.id)}
          >
            Publish as Current
          </Button>
        ) : (
          <Tag color="green">Current Version</Tag>
        )
      }
    >
      <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Version">{agreement.version}</Descriptions.Item>
        <Descriptions.Item label="Published">
          {agreement.publishedAt ? dayjs(agreement.publishedAt).format('MMM D, YYYY') : '—'}
        </Descriptions.Item>
      </Descriptions>
      <div data-color-mode="light" style={{ padding: '0 0 24px' }}>
        <MDPreview source={agreement.content} />
      </div>
    </Drawer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgreementsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [creating,  setCreating]  = useState(false);
  const [previewing, setPreviewing] = useState<Agreement | null>(null);

  const { data: agreements, isLoading } = useQuery({
    queryKey: ['agreements'],
    queryFn:  agreementsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: agreementsApi.create,
    onSuccess: () => {
      message.success('Agreement created');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
    },
    onError: () => message.error('Failed to create agreement'),
  });

  const publishMutation = useMutation({
    mutationFn: agreementsApi.publish,
    onSuccess: () => {
      message.success('Agreement published as current');
      setPreviewing(null);
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
    },
    onError: () => message.error('Failed to publish'),
  });

  const columns = [
    {
      title:     'Type',
      dataIndex: 'type',
      width:     180,
      render:    (v: AgreementType) => TYPE_LABELS[v],
    },
    {
      title:     'Version',
      dataIndex: 'version',
      width:     90,
      render:    (v: string) => <Tag>{v}</Tag>,
    },
    {
      title:  'Status',
      key:    'status',
      width:  110,
      render: (_: unknown, a: Agreement) =>
        a.isCurrent ? (
          <Badge status="success" text="Current" />
        ) : (
          <Badge status="default" text="Draft" />
        ),
    },
    {
      title:     'Published',
      dataIndex: 'publishedAt',
      width:     130,
      render:    (v: string | null) => (v ? dayjs(v).format('MMM D, YYYY') : '—'),
    },
    {
      title:     'Created',
      dataIndex: 'createdAt',
      width:     130,
      render:    (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  120,
      render: (_: unknown, a: Agreement) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewing(a)}
          >
            Preview
          </Button>
          {!a.isCurrent && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => publishMutation.mutate(a.id)}
            >
              Publish
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Legal Agreements</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          New Version
        </Button>
      </div>

      <Table<Agreement>
        dataSource={agreements ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      <CreateAgreementDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(vals) => createMutation.mutate(vals)}
      />

      <PreviewDrawer
        agreement={previewing}
        open={!!previewing}
        onClose={() => setPreviewing(null)}
        onPublish={(id) => publishMutation.mutate(id)}
      />
    </Space>
  );
}
