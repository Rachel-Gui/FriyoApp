'use client';

import { useState } from 'react';
import {
  Card, Form, Input, Button, Switch, Space, Alert,
  Typography, Row, Col, Tag, Divider,
} from 'antd';
import {
  SendOutlined, UserOutlined, GlobalOutlined, BellOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api';
import { App } from 'antd';

const { Title, Text, Paragraph } = Typography;

// ── Notification Preview ──────────────────────────────────────────────────────

function PhonePreview({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        width:        280,
        borderRadius: 20,
        background:   '#1c1c1e',
        padding:      '32px 16px',
        color:        '#fff',
        margin:       '0 auto',
      }}
    >
      {/* Phone notch */}
      <div
        style={{
          width:        80,
          height:       6,
          borderRadius: 3,
          background:   '#333',
          margin:       '0 auto 24px',
        }}
      />
      {/* Notification card */}
      <div
        style={{
          background:   'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          borderRadius: 14,
          padding:      '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width:          28,
              height:         28,
              borderRadius:   7,
              background:     '#FF6B35',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       14,
              fontWeight:     700,
            }}
          >
            F
          </div>
          <Text style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>Friyo</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginLeft: 'auto' }}>
            now
          </Text>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          {title || 'Notification Title'}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
          {body || 'Message body goes here…'}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { message } = App.useApp();
  const [form]        = Form.useForm();
  const [broadcast,   setBroadcast]   = useState(true);
  const [titlePreview, setTitle]       = useState('');
  const [bodyPreview,  setBody]        = useState('');

  const sendMutation = useMutation({
    mutationFn: notificationsApi.sendPush,
    onSuccess: () => {
      message.success('Push notification queued successfully');
      form.resetFields();
      setTitle('');
      setBody('');
    },
    onError: () => message.error('Failed to send notification'),
  });

  const onFinish = (vals: {
    title: string;
    body: string;
    userIds?: string;
    dataKey?: string;
    dataValue?: string;
  }) => {
    const payload = {
      title: vals.title,
      body:  vals.body,
      userIds: broadcast
        ? undefined
        : vals.userIds?.split(',').map((s) => s.trim()).filter(Boolean),
      data: vals.dataKey && vals.dataValue
        ? { [vals.dataKey]: vals.dataValue }
        : undefined,
    };
    sendMutation.mutate(payload);
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Push Notifications</Title>

      <Row gutter={[24, 24]}>
        {/* Form */}
        <Col xs={24} lg={14}>
          <Card style={{ borderRadius: 12 }}>
            <Alert
              type="info"
              message="Push notifications are sent via the backend notification queue and delivered through FCM / APNs."
              style={{ marginBottom: 24 }}
              showIcon
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={(_, all) => {
                setTitle(all.title ?? '');
                setBody(all.body  ?? '');
              }}
            >
              <Form.Item
                name="title"
                label="Notification Title"
                rules={[{ required: true, message: 'Title is required' }]}
              >
                <Input
                  prefix={<BellOutlined />}
                  placeholder="e.g. New recipe for you! 🍳"
                  maxLength={80}
                  showCount
                />
              </Form.Item>

              <Form.Item
                name="body"
                label="Message Body"
                rules={[{ required: true, message: 'Body is required' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Notification body text…"
                  maxLength={200}
                  showCount
                />
              </Form.Item>

              <Divider />

              {/* Target */}
              <div style={{ marginBottom: 12 }}>
                <Text strong>Recipients</Text>
              </div>
              <Space style={{ marginBottom: 16 }}>
                <Switch
                  checked={broadcast}
                  onChange={setBroadcast}
                  checkedChildren={<GlobalOutlined />}
                  unCheckedChildren={<UserOutlined />}
                />
                <Text>{broadcast ? 'Broadcast to all users' : 'Target specific users'}</Text>
              </Space>

              {!broadcast && (
                <Form.Item
                  name="userIds"
                  label="User IDs (comma-separated)"
                  rules={[{ required: !broadcast }]}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="uuid1, uuid2, uuid3…"
                  />
                </Form.Item>
              )}

              <Divider />

              {/* Custom data payload */}
              <Text strong>Custom Data Payload (optional)</Text>
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Form.Item name="dataKey" label="Key">
                    <Input placeholder="e.g. recipeId" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="dataValue" label="Value">
                    <Input placeholder="e.g. uuid…" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={sendMutation.isPending}
                  size="large"
                  block
                >
                  Send Notification
                </Button>
              </Form.Item>

              {broadcast && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ⚠️ This will send to <strong>all active users</strong>. Use with caution.
                </Text>
              )}
            </Form>
          </Card>
        </Col>

        {/* Live preview */}
        <Col xs={24} lg={10}>
          <Card title="Preview" style={{ borderRadius: 12 }}>
            <PhonePreview title={titlePreview} body={bodyPreview} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
