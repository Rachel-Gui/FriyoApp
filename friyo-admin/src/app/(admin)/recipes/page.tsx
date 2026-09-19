'use client';

import { useState } from 'react';
import {
  Tabs, Table, Button, Tag, Space, Modal, Form, Input, Card,
  Image, Row, Col, Typography, App, Descriptions, Steps, Badge, Select,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined,
  EyeOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipesApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { Recipe, RecipeReviewStatus } from '@/types';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  pending:  'gold',
  approved: 'green',
  rejected: 'red',
};

// ── Recipe Detail Modal ───────────────────────────────────────────────────────

function RecipeDetailModal({
  recipe,
  open,
  onClose,
  onApprove,
  onReject,
}: {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject,   setShowReject]   = useState(false);

  if (!recipe) return null;

  return (
    <Modal
      title={recipe.title}
      open={open}
      onCancel={onClose}
      width={760}
      footer={
        recipe.reviewStatus === 'pending' ? (
          <Space>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setShowReject(true)}
            >
              Reject
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => onApprove(recipe.id)}
            >
              Approve & Publish
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {/* Reject reason sub-modal */}
      <Modal
        title="Reject Recipe"
        open={showReject}
        onCancel={() => setShowReject(false)}
        onOk={() => {
          if (!rejectReason.trim()) return;
          onReject(recipe.id, rejectReason);
          setShowReject(false);
          setRejectReason('');
        }}
        okText="Confirm Reject"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection (shown to author)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* Cover image */}
      {recipe.coverImageUrl && (
        <Image
          src={recipe.coverImageUrl}
          alt={recipe.title}
          style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
        />
      )}

      <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Author">
          {recipe.author?.name ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Cuisine">{recipe.cuisineType ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Meal Type">{recipe.mealType ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Difficulty">
          <Tag>{recipe.difficulty}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Prep Time">{recipe.prepTimeMin ?? '—'} min</Descriptions.Item>
        <Descriptions.Item label="Cook Time">{recipe.cookTimeMin ?? '—'} min</Descriptions.Item>
        <Descriptions.Item label="Servings">{recipe.servings}</Descriptions.Item>
        <Descriptions.Item label="Calories/serving">
          {recipe.caloriesPerServing ?? '—'} kcal
        </Descriptions.Item>
      </Descriptions>

      {recipe.description && (
        <Paragraph style={{ color: '#666', marginBottom: 16 }}>{recipe.description}</Paragraph>
      )}

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <>
          <Text strong>Ingredients</Text>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            {recipe.ingredients.map((ing) => (
              <li key={ing.id}>
                {ing.quantity} {ing.unit} {ing.name}
                {ing.isOptional && <Tag style={{ marginLeft: 6 }}>optional</Tag>}
              </li>
            ))}
          </ul>
        </>
      )}

      {recipe.steps && recipe.steps.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginTop: 16 }}>Steps</Text>
          <Steps
            direction="vertical"
            size="small"
            style={{ marginTop: 8 }}
            items={recipe.steps.map((s) => ({
              title:       `Step ${s.stepNumber} (${s.stepType})`,
              description: s.instruction,
            }))}
          />
        </>
      )}
    </Modal>
  );
}

// ── Recipe Table ──────────────────────────────────────────────────────────────

function RecipeTable({
  reviewStatus,
  onView,
  onApprove,
  onReject,
  onDelete,
}: {
  reviewStatus?: string;
  onView:    (r: Recipe) => void;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onDelete:  (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['recipes', reviewStatus, page, search],
    queryFn:  () => recipesApi.list({ status: reviewStatus, page, limit: 20, search }),
  });

  const columns = [
    {
      title: 'Recipe',
      key: 'title',
      render: (_: unknown, r: Recipe) => (
        <Space>
          {r.coverImageUrl && (
            <Image
              src={r.coverImageUrl}
              width={48}
              height={48}
              style={{ borderRadius: 6, objectFit: 'cover' }}
              alt=""
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{r.title}</div>
            {r.titleZh && <Text type="secondary" style={{ fontSize: 12 }}>{r.titleZh}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title:     'Cuisine',
      dataIndex: 'cuisineType',
      width:     100,
      render:    (v: string) => v ?? '—',
    },
    {
      title:     'Author',
      key:       'author',
      width:     140,
      render:    (_: unknown, r: Recipe) => r.author?.name ?? '—',
    },
    {
      title:     'Status',
      dataIndex: 'reviewStatus',
      width:     100,
      render:    (v: RecipeReviewStatus) => (
        <Badge
          status={v === 'approved' ? 'success' : v === 'rejected' ? 'error' : 'processing'}
          text={v}
        />
      ),
    },
    {
      title:     'Submitted',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  130,
      render: (_: unknown, r: Recipe) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onView(r)} />
          {r.reviewStatus === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => onApprove(r.id)}
              />
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => onReject(r.id)}
              />
            </>
          )}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(r.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Input.Search
        placeholder="Search recipes…"
        onSearch={(v) => { setSearch(v); setPage(1); }}
        allowClear
        style={{ width: 280, marginBottom: 12 }}
        prefix={<SearchOutlined />}
      />
      <Table<Recipe>
        dataSource={data?.data ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current:  page,
          pageSize: 20,
          total:    data?.total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `${t} recipes`,
        }}
        style={{ background: '#fff', borderRadius: 12 }}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [viewing,   setViewing]   = useState<Recipe | null>(null);
  const [rejectId,  setRejectId]  = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recipes'] });

  const approveMutation = useMutation({
    mutationFn: recipesApi.approve,
    onSuccess: () => { message.success('Recipe approved'); invalidate(); setViewing(null); },
    onError:   () => message.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      recipesApi.reject(id, reason),
    onSuccess: () => { message.success('Recipe rejected'); invalidate(); setViewing(null); },
    onError:   () => message.error('Failed to reject'),
  });

  const deleteMutation = useMutation({
    mutationFn: recipesApi.delete,
    onSuccess: () => { message.success('Recipe deleted'); invalidate(); },
    onError:   () => message.error('Failed to delete'),
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Recipes</Title>

      <Tabs
        items={[
          {
            key:   'pending',
            label: <Badge status="processing" text="Pending Review" />,
            children: (
              <RecipeTable
                reviewStatus="pending"
                onView={setViewing}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => setRejectId(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ),
          },
          {
            key:   'approved',
            label: <Badge status="success" text="Approved" />,
            children: (
              <RecipeTable
                reviewStatus="approved"
                onView={setViewing}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => setRejectId(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ),
          },
          {
            key:   'rejected',
            label: <Badge status="error" text="Rejected" />,
            children: (
              <RecipeTable
                reviewStatus="rejected"
                onView={setViewing}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => setRejectId(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ),
          },
        ]}
      />

      {/* Recipe detail modal */}
      <RecipeDetailModal
        recipe={viewing}
        open={!!viewing}
        onClose={() => setViewing(null)}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
      />

      {/* Quick reject modal when triggered from table action button */}
      <Modal
        title="Reject Recipe"
        open={!!rejectId}
        onCancel={() => setRejectId(null)}
        onOk={() => {
          /* handled inline */ setRejectId(null);
        }}
        footer={null}
      >
        <Form
          onFinish={(vals) => {
            if (rejectId) rejectMutation.mutate({ id: rejectId, reason: vals.reason });
            setRejectId(null);
          }}
          layout="vertical"
        >
          <Form.Item
            name="reason"
            label="Reason for rejection"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button htmlType="submit" danger type="primary" block>
            Confirm Reject
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
