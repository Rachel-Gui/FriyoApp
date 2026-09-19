'use client';

import { useState } from 'react';
import {
  Row, Col, Card, Space, DatePicker, Select, Table,
  Typography, Spin, Statistic,
} from 'antd';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/api';
import dayjs, { Dayjs } from 'dayjs';
import type { TimeBucket } from '@/types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [range,  setRange]  = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const params = {
    period,
    from: range?.[0]?.toISOString(),
    to:   range?.[1]?.toISOString(),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', period, params.from, params.to],
    queryFn:  () => analyticsApi.get(params),
  });

  const userGrowthData = data?.userGrowth.map((b) => ({
    date:  dayjs(b.bucket).format(period === 'day' ? 'HH:mm' : 'MMM D'),
    users: parseInt(b.count, 10),
  })) ?? [];

  const mealData = data?.mealActivity.map((b) => ({
    date:  dayjs(b.bucket).format(period === 'day' ? 'HH:mm' : 'MMM D'),
    meals: parseInt(b.count, 10),
  })) ?? [];

  const scanData = data?.scanActivity.map((b) => ({
    date:  dayjs(b.bucket).format(period === 'day' ? 'HH:mm' : 'MMM D'),
    scans: parseInt(b.count, 10),
  })) ?? [];

  const postData = data?.postActivity.map((b) => ({
    date:  dayjs(b.bucket).format(period === 'day' ? 'HH:mm' : 'MMM D'),
    posts: parseInt(b.count, 10),
  })) ?? [];

  const topRecipeCols = [
    { title: '#',         key: 'rank',     width: 40,  render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: 'Recipe ID', dataIndex: 'recipeId', ellipsis: true, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Logged',    dataIndex: 'count',    width: 80, render: (v: string) => parseInt(v, 10) },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Analytics</Title>
        <Space wrap>
          <Select
            value={period}
            onChange={(v) => setPeriod(v)}
            style={{ width: 120 }}
            options={[
              { label: 'Last Day',   value: 'day' },
              { label: 'Last Week',  value: 'week' },
              { label: 'Last Month', value: 'month' },
            ]}
          />
          <RangePicker
            onChange={(val) => setRange(val as [Dayjs | null, Dayjs | null] | null)}
            allowClear
          />
        </Space>
      </div>

      {/* ── User Growth ─────────────────────────────────────────────────────── */}
      <Card title="User Growth" style={{ borderRadius: 12 }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={userGrowthData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="users" name="New Users" stroke="#FF6B35" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Meal + Posts charts ──────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Meal Logs" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mealData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="meals" name="Meals Logged" fill="#52c41a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Community Posts Created" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={postData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="posts" name="Posts" fill="#1677ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* ── AI Scans + Top Recipes ───────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="AI Fridge Scans" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={scanData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="scans" name="AI Scans" stroke="#722ed1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top 10 Recipes (by meal logs)" style={{ borderRadius: 12 }}>
            <Table
              dataSource={data?.topRecipes ?? []}
              columns={topRecipeCols}
              rowKey="recipeId"
              pagination={false}
              size="small"
              style={{ maxHeight: 220, overflow: 'auto' }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
