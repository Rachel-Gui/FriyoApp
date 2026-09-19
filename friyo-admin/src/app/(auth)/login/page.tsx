'use client';

import { useState } from 'react';
import { signIn }   from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      username: values.username,
      password: values.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid username or password. Please try again.');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div
      style={{
        minHeight:       '100vh',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      }}
    >
      <Card
        style={{
          width:        400,
          borderRadius: 16,
          boxShadow:    '0 25px 50px rgba(0,0,0,0.3)',
        }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        {/* Logo / Brand */}
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 32 }}>
          <div
            style={{
              width:        56,
              height:       56,
              borderRadius: 14,
              background:   '#FF6B35',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontSize:     24,
              fontWeight:   700,
              color:        '#fff',
            }}
          >
            F
          </div>
          <Title level={3} style={{ margin: 0 }}>Friyo Admin</Title>
          <Text type="secondary">Sign in to manage the platform</Text>
        </Space>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 20 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" autoFocus />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, fontWeight: 600 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
