'use client';

import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, Space } from 'antd';
import {
  UserOutlined, BookOutlined, WarningOutlined, RobotOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, communityApi, recipesApi, analyticsApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { ContentReport, Recipe } from '@/types';

const { Title } = Typography;

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, suffix, icon, color, className, extra,
}: {
  title: string;
  value: number | undefined;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  className?: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card className={className} style={{ borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Statistic
          title={<span style={{ fontWeight: 600 }}>{title}</span>}
          value={value ?? '—'}
          suffix={suffix}
          valueStyle={{ color, fontSize: 32 }}
        />
        <div
          style={{
            width:          48,
            height:         48,
            borderRadius:   12,
            background:     `${color}18`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       22,
            color,
          }}
        >
          {icon}
        </div>
      </div>
      {extra}
    </Card>
  );
}

// ── Report columns ─────────────────────────────────────────────────────────────

const reportCols = [
  {
    title:     'Type',
    dataIndex: 'contentType',
    width:     80,
    render:    (v: string) => <Tag color="orange">{v}</Tag>,
  },
  {
    title:     'Reason',
    dataIndex: 'reason',
    ellipsis:  true,
  },
  {
    title:     'Reported',
    dataIndex: 'createdAt',
    width:     120,
    render:    (v: string) => dayjs(v).fromNow(),
  },
];

const recipeCols = [
  {
    title:     'Title',
    dataIndex: 'title',
    ellipsis:  true,
  },
  {
    title:     'Cuisine',
    dataIndex: 'cuisineType',
    width:     110,
    render:    (v: string) => v ?? '—',
  },
  {
    title:     'Submitted',
    dataIndex: 'createdAt',
    width:     120,
    render:    (v: string) => dayjs(v).fromNow(),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  dashboardApi.getStats,
    refetchInterval: 60_000,
  });

  const { data: reports } = useQuery({
    queryKey: ['reports-pending-top5'],
    queryFn:  () => communityApi.reports({ page: 1, limit: 5, status: 'pending' }),
  });

  const { data: recipes } = useQuery({
    queryKey: ['recipes-pending-top5'],
    queryFn:  () => recipesApi.list({ page: 1, limit: 5 }),
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics-30d'],
    queryFn:  () => analyticsApi.get({ period: 'month' }),
  });

  const chartData = analytics?.userGrowth.map((b) => ({
    date:  dayjs(b.bucket).format('MMM D'),
    users: parseInt(b.count, 10),
  })) ?? [];

  if (statsLoading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Dashboard</Title>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            className="stat-card-users"
            title="Total Users"
            value={stats?.users.total}
            icon={<UserOutlined />}
            color="#FF6B35"
            extra={
              <div style={{ marginTop: 8, color: '#52c41a', fontSize: 13 }}>
                <ArrowUpOutlined /> {stats?.users.newLast7Days} new this week
              </div>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            className="stat-card-recipes"
            title="Recipes"
            value={stats?.recipes.total}
            icon={<BookOutlined />}
            color="#52c41a"
            extra={
              <div style={{ marginTop: 8, color: '#faad14', fontSize: 13 }}>
                {stats?.recipes.pendingReview} pending review
              </div>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            className="stat-card-reports"
            title="Open Reports"
            value={stats?.community.pendingReports}
            icon={<WarningOutlined />}
            color="#faad14"
            extra={
              <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 13 }}>
                {stats?.community.flaggedPosts} flagged posts
              </div>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            className="stat-card-ai"
            title="AI Scans"
            value={stats?.activity.totalAiScans}
            icon={<RobotOutlined />}
            color="#722ed1"
            extra={
              <div style={{ marginTop: 8, color: '#1677ff', fontSize: 13 }}>
                {stats?.activity.mealLogsThisMonth} meals logged this month
              </div>
            }
          />
        </Col>
      </Row>

      {/* ── User Growth Chart ───────────────────────────────────────────── */}
      <Card title="User Growth — Last 30 Days" style={{ borderRadius: 12 }}>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            No growth data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="users"
                name="New Users"
                stroke="#FF6B35"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Pending Tables ──────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Pending Reports"
            extra={<a href="/community">View all</a>}
            style={{ borderRadius: 12 }}
          >
            <Table<ContentReport>
              dataSource={reports?.data ?? []}
              columns={reportCols}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No pending reports' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Recipes Pending Review"
            extra={<a href="/recipes">View all</a>}
            style={{ borderRadius: 12 }}
          >
            <Table<Recipe>
              dataSource={recipes?.data ?? []}
              columns={recipeCols}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No pending recipes' }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
