'use client';

import { useState } from 'react';
import {
  Tabs, Table, Tag, Button, Space, Row, Col, Card,
  Image, Typography, App, Badge, Popconfirm, Select,
  Descriptions, Input,
} from 'antd';
import {
  CheckCircleOutlined, DeleteOutlined, StopOutlined,
  SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { ContentReport, CommunityPost } from '@/types';

const { Title, Text, Paragraph } = Typography;

// ── Report panel (right-side content preview) ────────────────────────────────

function ReportDetailPanel({ report }: { report: ContentReport | null }) {
  if (!report) {
    return (
      <div style={{ padding: 24, color: '#999', textAlign: 'center' }}>
        Select a report to preview
      </div>
    );
  }

  return (
    <Card bordered={false} style={{ height: '100%' }}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Report ID">
          <Text code>{report.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Reporter">
          {report.reporter?.name ?? report.reporterId}
        </Descriptions.Item>
        <Descriptions.Item label="Content Type">
          <Tag color="orange">{report.contentType}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Content ID">
          <Text code>{report.contentId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Badge
            status={
              report.status === 'pending'  ? 'processing' :
              report.status === 'resolved' ? 'success'    : 'default'
            }
            text={report.status}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Reported">
          {dayjs(report.createdAt).format('MMM D, YYYY HH:mm')}
        </Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Reason</Text>
        <Paragraph style={{ marginTop: 4, background: '#f9f9f9', padding: 12, borderRadius: 8 }}>
          {report.reason}
        </Paragraph>
      </div>
    </Card>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState('pending');
  const [selected,  setSelected]  = useState<ContentReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', page, status],
    queryFn:  () => communityApi.reports({ page, limit: 20, status }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'resolved' | 'dismissed' }) =>
      communityApi.resolveReport(id, { action }),
    onSuccess: () => {
      message.success('Report updated');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => message.error('Failed to update report'),
  });

  const columns = [
    {
      title:     'Type',
      dataIndex: 'contentType',
      width:     90,
      render:    (v: string) => <Tag color="orange">{v}</Tag>,
    },
    {
      title:     'Reason',
      dataIndex: 'reason',
      ellipsis:  true,
    },
    {
      title:     'Reporter',
      key:       'reporter',
      width:     130,
      render:    (_: unknown, r: ContentReport) => r.reporter?.name ?? '—',
    },
    {
      title:     'Date',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  140,
      render: (_: unknown, r: ContentReport) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(r)} />
          {r.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => resolveMutation.mutate({ id: r.id, action: 'resolved' })}
                title="Resolve"
              />
              <Button
                size="small"
                icon={<StopOutlined />}
                onClick={() => resolveMutation.mutate({ id: r.id, action: 'dismissed' })}
                title="Dismiss"
              />
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col xs={24} lg={14}>
        <Space style={{ marginBottom: 12 }}>
          <Select
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            style={{ width: 140 }}
            options={[
              { label: 'Pending',   value: 'pending' },
              { label: 'Resolved',  value: 'resolved' },
              { label: 'Dismissed', value: 'dismissed' },
            ]}
          />
        </Space>
        <Table<ContentReport>
          dataSource={data?.data ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          rowClassName={(r) => r.id === selected?.id ? 'ant-table-row-selected' : ''}
          onRow={(r) => ({ onClick: () => setSelected(r) })}
          pagination={{
            current:  page,
            pageSize: 20,
            total:    data?.total,
            onChange: (p) => setPage(p),
          }}
          style={{ background: '#fff', borderRadius: 12, cursor: 'pointer' }}
        />
      </Col>
      <Col xs={24} lg={10}>
        <ReportDetailPanel report={selected} />
      </Col>
    </Row>
  );
}

// ── Flagged Posts Tab ─────────────────────────────────────────────────────────

function PostsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['flagged-posts', page],
    queryFn:  () => communityApi.flaggedPosts({ page, limit: 20 }),
  });

  const approveMutation = useMutation({
    mutationFn: communityApi.approvePost,
    onSuccess: () => {
      message.success('Post approved');
      queryClient.invalidateQueries({ queryKey: ['flagged-posts'] });
    },
    onError: () => message.error('Failed to approve'),
  });

  const removeMutation = useMutation({
    mutationFn: communityApi.removePost,
    onSuccess: () => {
      message.success('Post removed');
      queryClient.invalidateQueries({ queryKey: ['flagged-posts'] });
    },
    onError: () => message.error('Failed to remove'),
  });

  const columns = [
    {
      title: 'Post',
      key:   'post',
      render: (_: unknown, p: CommunityPost) => (
        <Space>
          {p.photoUrls?.[0] && (
            <Image
              src={p.photoUrls[0]}
              width={48}
              height={48}
              style={{ borderRadius: 6, objectFit: 'cover' }}
              alt=""
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>
              {p.user?.name ?? p.userId}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {p.caption ?? 'No caption'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title:     'Status',
      dataIndex: 'moderationStatus',
      width:     100,
      render:    (v: string) => (
        <Badge
          status={v === 'flagged' ? 'warning' : v === 'removed' ? 'error' : 'success'}
          text={v}
        />
      ),
    },
    {
      title:     'Likes',
      dataIndex: 'likesCount',
      width:     70,
    },
    {
      title:     'Posted',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  120,
      render: (_: unknown, p: CommunityPost) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => approveMutation.mutate(p.id)}
            title="Approve"
          />
          <Popconfirm
            title="Remove this post?"
            onConfirm={() => removeMutation.mutate(p.id)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Remove"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table<CommunityPost>
      dataSource={data?.data ?? []}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      pagination={{
        current:  page,
        pageSize: 20,
        total:    data?.total,
        onChange: (p) => setPage(p),
        showTotal: (t) => `${t} flagged posts`,
      }}
      style={{ background: '#fff', borderRadius: 12 }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Community Moderation</Title>

      <Tabs
        items={[
          {
            key:   'reports',
            label: <Badge count={0} overflowCount={99} showZero={false}><span>Reports</span></Badge>,
            children: <ReportsTab />,
          },
          {
            key:   'posts',
            label: 'Flagged Posts',
            children: <PostsTab />,
          },
        ]}
      />
    </Space>
  );
}
