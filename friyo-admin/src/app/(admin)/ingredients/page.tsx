'use client';

import { useState } from 'react';
import {
  Table, Button, Input, Drawer, Form, Select, InputNumber,
  Space, Tag, App, Typography, Popconfirm, Tooltip,
  Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MergeCellsOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingredientsApi } from '@/services/api';
import dayjs from '@/lib/dayjs';
import type { Ingredient, IngredientCategory } from '@/types';

const { Title } = Typography;

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  fresh:     'green',
  freeze:    'blue',
  pantry:    'orange',
  condiment: 'purple',
};

// ── Ingredient Form Drawer ────────────────────────────────────────────────────

function IngredientDrawer({
  ingredient,
  open,
  onClose,
  onSave,
}: {
  ingredient: Ingredient | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: Partial<Ingredient>) => void;
}) {
  const [form] = Form.useForm();
  const isEdit = !!ingredient;

  const handleOpen = () => {
    if (ingredient) form.setFieldsValue({ ...ingredient, aliases: ingredient.aliases?.join(', ') });
    else form.resetFields();
  };

  return (
    <Drawer
      title={isEdit ? 'Edit Ingredient' : 'Add Ingredient'}
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      afterOpenChange={(v) => v && handleOpen()}
      extra={
        <Button type="primary" onClick={() => {
          form.validateFields().then((vals) => {
            onSave({
              ...vals,
              aliases: vals.aliases
                ? (vals.aliases as string).split(',').map((s: string) => s.trim()).filter(Boolean)
                : [],
            });
          });
        }}>
          {isEdit ? 'Save Changes' : 'Create'}
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input placeholder="e.g. Chicken Breast" />
        </Form.Item>
        <Form.Item name="nameZh" label="Chinese Name">
          <Input placeholder="e.g. 鸡胸肉" />
        </Form.Item>
        <Form.Item name="category" label="Category" rules={[{ required: true }]}>
          <Select
            options={[
              { label: 'Fresh',     value: 'fresh' },
              { label: 'Freeze',    value: 'freeze' },
              { label: 'Pantry',    value: 'pantry' },
              { label: 'Condiment', value: 'condiment' },
            ]}
          />
        </Form.Item>
        <Form.Item name="unit" label="Default Unit">
          <Input placeholder="e.g. g, ml, pcs" />
        </Form.Item>
        <Form.Item name="caloriesPer100g" label="Calories per 100g">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="defaultShelfDays" label="Default Shelf Days">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="aliases" label="Aliases (comma-separated)">
          <Input.TextArea
            rows={2}
            placeholder="e.g. chicken, breast meat, grilled chicken"
          />
        </Form.Item>
        <Form.Item name="imageUrl" label="Image URL">
          <Input placeholder="https://..." />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

// ── Merge Drawer ──────────────────────────────────────────────────────────────

function MergeDrawer({
  open,
  onClose,
  onMerge,
  allIngredients,
}: {
  open: boolean;
  onClose: () => void;
  onMerge: (targetId: string, sourceIds: string[]) => void;
  allIngredients: Ingredient[];
}) {
  const [form] = Form.useForm();

  return (
    <Drawer
      title="Merge Ingredients"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      extra={
        <Button
          type="primary"
          onClick={() =>
            form.validateFields().then((v) => onMerge(v.targetId, v.sourceIds))
          }
        >
          Merge
        </Button>
      }
    >
      <p style={{ color: '#666', marginBottom: 16 }}>
        Select a <strong>target</strong> (canonical) ingredient and one or more
        <strong> sources</strong> to merge into it. Source ingredients will be deleted
        and all references updated.
      </p>
      <Form form={form} layout="vertical">
        <Form.Item name="targetId" label="Keep (target)" rules={[{ required: true }]}>
          <Select
            showSearch
            filterOption={(input, option) =>
              (option?.label as string).toLowerCase().includes(input.toLowerCase())
            }
            options={allIngredients.map((i) => ({ label: i.name, value: i.id }))}
            placeholder="Select the ingredient to keep"
          />
        </Form.Item>
        <Form.Item
          name="sourceIds"
          label="Merge (sources)"
          rules={[{ required: true, type: 'array', min: 1 }]}
        >
          <Select
            mode="multiple"
            showSearch
            filterOption={(input, option) =>
              (option?.label as string).toLowerCase().includes(input.toLowerCase())
            }
            options={allIngredients.map((i) => ({ label: i.name, value: i.id }))}
            placeholder="Select duplicates to remove"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IngredientsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [merging, setMerging] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients', page, search],
    queryFn:  () => ingredientsApi.list({ page, limit: 30, search }),
  });

  // Fetch all (for merge selector)
  const { data: allData } = useQuery({
    queryKey: ['ingredients-all'],
    queryFn:  () => ingredientsApi.list({ page: 1, limit: 1000 }),
  });

  const createMutation = useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => {
      message.success('Ingredient created');
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: () => message.error('Failed to create ingredient'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Ingredient> }) =>
      ingredientsApi.update(id, payload),
    onSuccess: () => {
      message.success('Ingredient updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: () => message.error('Failed to update ingredient'),
  });

  const deleteMutation = useMutation({
    mutationFn: ingredientsApi.delete,
    onSuccess: () => {
      message.success('Ingredient deleted');
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (err: Error) =>
      message.error(err.message ?? 'Failed to delete — ingredient may be referenced'),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      ingredientsApi.merge({ targetId, sourceIds }),
    onSuccess: () => {
      message.success('Ingredients merged');
      setMerging(false);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: () => message.error('Merge failed'),
  });

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: unknown, ing: Ingredient) => (
        <div>
          <strong>{ing.name}</strong>
          {ing.nameZh && <span style={{ color: '#888', marginLeft: 8 }}>{ing.nameZh}</span>}
        </div>
      ),
    },
    {
      title:     'Category',
      dataIndex: 'category',
      width:     110,
      render:    (v: IngredientCategory) => (
        <Tag color={CATEGORY_COLORS[v]}>{v}</Tag>
      ),
    },
    {
      title:     'Unit',
      dataIndex: 'unit',
      width:     80,
      render:    (v: string | null) => v ?? '—',
    },
    {
      title:     'Cal/100g',
      dataIndex: 'caloriesPer100g',
      width:     90,
      render:    (v: number | null) => (v != null ? v : '—'),
    },
    {
      title:     'Source',
      dataIndex: 'createdByAdmin',
      width:     90,
      render:    (v: boolean) => (
        <Tag color={v ? 'blue' : 'default'}>{v ? 'Admin' : 'User'}</Tag>
      ),
    },
    {
      title:     'Added',
      dataIndex: 'createdAt',
      width:     110,
      render:    (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  100,
      render: (_: unknown, ing: Ingredient) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(ing)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this ingredient?"
            description="This cannot be undone and will fail if it is referenced."
            onConfirm={() => deleteMutation.mutate(ing.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Ingredients</Title>
        <Space>
          <Button
            icon={<MergeCellsOutlined />}
            onClick={() => setMerging(true)}
          >
            Merge Duplicates
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAdding(true)}
          >
            Add Ingredient
          </Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key:   'library',
            label: 'Ingredient Library',
            children: (
              <>
                <Input.Search
                  placeholder="Search by name…"
                  onSearch={(v) => { setSearch(v); setPage(1); }}
                  allowClear
                  style={{ width: 280, marginBottom: 12 }}
                  prefix={<SearchOutlined />}
                />
                <Table<Ingredient>
                  dataSource={data?.data ?? []}
                  columns={columns}
                  rowKey="id"
                  loading={isLoading}
                  pagination={{
                    current:  page,
                    pageSize: 30,
                    total:    data?.total,
                    onChange: (p) => setPage(p),
                    showTotal: (t) => `${t} ingredients`,
                  }}
                  style={{ background: '#fff', borderRadius: 12 }}
                />
              </>
            ),
          },
          {
            key:   'user-contributed',
            label: 'User-Contributed',
            children: (
              <Table<Ingredient>
                dataSource={(data?.data ?? []).filter((i) => !i.createdByAdmin)}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 30 }}
                style={{ background: '#fff', borderRadius: 12 }}
              />
            ),
          },
        ]}
      />

      {/* Add Drawer */}
      <IngredientDrawer
        ingredient={null}
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(vals) => createMutation.mutate(vals)}
      />

      {/* Edit Drawer */}
      <IngredientDrawer
        ingredient={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={(vals) => editing && updateMutation.mutate({ id: editing.id, payload: vals })}
      />

      {/* Merge Drawer */}
      <MergeDrawer
        open={merging}
        onClose={() => setMerging(false)}
        allIngredients={allData?.data ?? []}
        onMerge={(targetId, sourceIds) =>
          mergeMutation.mutate({ targetId, sourceIds })
        }
      />
    </Space>
  );
}
