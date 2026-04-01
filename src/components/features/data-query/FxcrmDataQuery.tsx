"use client"

import * as React from "react"
import { useEffect, useState, useCallback, useRef } from "react"
import {
    Button,
    Card,
    Typography,
    Select,
    Message,
    Form,
    Space,
    Grid,
    Table,
    Modal,
    Spin,
    Layout,
    List,
    Avatar
} from "@arco-design/web-react"
import {
    IconSearch,
    IconSettings,
    IconDragDotVertical,
    IconUnorderedList
} from "@arco-design/web-react/icon"
import { useProfiles } from "@/context/ProfileContext"
import { UserSelector } from "@/components/shared/UserSelector"

const { Row, Col } = Grid
const { Title, Text } = Typography
const { Content } = Layout
const FormItem = Form.Item
const Option = Select.Option

interface FieldMeta {
    api_name: string
    display_name: string
    is_required: boolean
    type: string
}

export default function FxcrmDataQuery() {
    const { activeProfile } = useProfiles()

    // UI State
    const [isLoadingObjects, setIsLoadingObjects] = useState(false)
    const [isLoadingData, setIsLoadingData] = useState(false)
    const [progress, setProgress] = useState("")

    // Data State
    const [objectList, setObjectList] = useState<any[]>([])
    const [selectedObject, setSelectedObject] = useState<string>("")
    const [availableFields, setAvailableFields] = useState<FieldMeta[]>([])
    const [allRecords, setAllRecords] = useState<any[]>([])

    // Column Config
    const [visibleColumns, setVisibleColumns] = useState<string[]>([])
    const [showColumnConfig, setShowColumnConfig] = useState(false)
    const [draggedItem, setDraggedItem] = useState<string | null>(null)

    // Operating User Override
    const [operatingUserId, setOperatingUserId] = useState<string>("")

    useEffect(() => {
        setOperatingUserId(activeProfile.currentOpenUserId)
    }, [activeProfile.currentOpenUserId])

    // Load Objects
    const fetchObjects = useCallback(async () => {
        if (!activeProfile.appId) return

        setIsLoadingObjects(true)
        try {
            const response = await fetch('/data/api/fxcrm/objects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activeProfile)
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.objects)) {
                setObjectList(result.objects)
            } else {
                Message.error(`获取对象失败: ${result.error}`)
            }
        } catch (e: any) {
            Message.error(`获取对象列表网络错误: ${e.message}`)
        } finally {
            setIsLoadingObjects(false)
        }
    }, [activeProfile])

    useEffect(() => {
        fetchObjects()
    }, [fetchObjects])

    // Change Object
    const handleObjectChange = async (val: string) => {
        setSelectedObject(val)
        setAllRecords([])
        setVisibleColumns([])

        // Fetch fields
        const toastId = Message.loading("正在获取对象字段...")
        try {
            const response = await fetch('/data/api/fxcrm/objects/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...activeProfile, apiName: val })
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.fields)) {
                setAvailableFields(result.fields)
                // Initialize columns: index, _id, name, then others
                const initialCols = ['_index', '_id', 'name']
                const resultApiNames = result.fields.map((f: any) => f.api_name)
                    .filter((n: string) => n !== '_id' && n !== 'name')

                setVisibleColumns([...initialCols, ...resultApiNames])

                toastId()
                Message.success(`已加载 ${result.fields.length} 个字段`)
            } else {
                toastId()
                Message.error(`获取字段失败: ${result.error}`)
            }
        } catch (e: any) {
            toastId()
            Message.error(`获取字段错误: ${e.message}`)
        }
    }

    // Fetch All Data
    const handleQuery = async () => {
        if (!selectedObject) {
            Message.warning("请选择目标对象")
            return
        }

        setIsLoadingData(true)
        setAllRecords([])
        setProgress("正在初始化查询...")

        const limit = 100
        let offset = 0
        let total = 0
        let fetchedCount = 0
        let allData: any[] = []
        let hasMore = true

        try {
            while (hasMore) {
                setProgress(`正在加载数据... (已获取 ${fetchedCount} 条)`)

                const response = await fetch('/data/api/fxcrm/data/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...activeProfile,
                        currentOpenUserId: operatingUserId || activeProfile.currentOpenUserId,
                        apiName: selectedObject,
                        limit,
                        offset
                    })
                })

                const result = await response.json()

                if (result.success) {
                    const pageData = result.data || []
                    allData = [...allData, ...pageData]
                    fetchedCount += pageData.length

                    // Update total if first page
                    if (offset === 0 && result.totalCount) {
                        total = result.totalCount
                    }

                    if (pageData.length < limit) {
                        hasMore = false
                    } else {
                        offset += limit
                    }
                } else {
                    Message.error(`查询中断: ${result.error}`)
                    hasMore = false
                }
            }

            setProgress("")
            setAllRecords(allData)
            Message.success(`查询完成，共 ${allData.length} 条数据`)

        } catch (e: any) {
            Message.error(`查询过程发生错误: ${e.message}`)
        } finally {
            setIsLoadingData(false)
        }
    }

    // --- Column Config ---
    const moveColumn = (dragIndex: number, hoverIndex: number) => {
        // Skip fixed columns (0, 1, 2)
        if (dragIndex < 3 || hoverIndex < 3) return

        const newCols = [...visibleColumns]
        const [moved] = newCols.splice(dragIndex, 1)
        newCols.splice(hoverIndex, 0, moved)
        setVisibleColumns(newCols)
    }

    // --- Table ---
    const columns = visibleColumns.map((colKey, index) => {
        if (colKey === '_index') {
            return {
                title: '序号',
                dataIndex: '_index',
                fixed: 'left' as const,
                width: 80,
                render: (_: any, __: any, idx: number) => idx + 1
            }
        }

        // Find field meta for display name
        const field = availableFields.find(f => f.api_name === colKey)

        return {
            title: field ? field.display_name : colKey,
            dataIndex: colKey,
            width: colKey === '_id' ? 220 : 150,
            ellipsis: true,
            tooltip: true,
            render: (val: any) => {
                if (val === null || val === undefined) return '-'
                if (typeof val === 'object') return JSON.stringify(val)
                // Timestamps are often 13 digits, maybe format them? 
                // Keeping it simple as raw values for now as requested "list all fields"
                return String(val)
            }
        }
    })

    return (
        <Layout className="min-h-screen bg-[var(--color-bg-1)] p-4 sm:p-8">
            <Content className="w-full bg-[var(--color-bg-2)] p-4 sm:p-8 rounded-sm shadow-sm relative flex flex-col h-[calc(100vh-64px)] overflow-hidden">
                {/* Header */}
                <div className="mb-6 border-b border-[var(--color-border-2)] pb-4 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <Title heading={3} className="m-0! flex items-center gap-2">
                            <IconUnorderedList className="text-[var(--color-primary-6)]" />
                            数据查询
                        </Title>
                        <Space>
                            <Button
                                icon={<IconSettings />}
                                onClick={() => setShowColumnConfig(true)}
                                disabled={availableFields.length === 0}
                            >
                                配置列
                            </Button>
                        </Space>
                    </div>
                    <Text type="secondary">查询对象全量数据，支持自定义列展示顺序。</Text>
                </div>

                {/* Filters */}
                <Card className="mb-6 bg-[var(--color-fill-2)] shadow-none border-[var(--color-border-2)] flex-shrink-0" bordered>
                    <Form layout="inline">
                        <FormItem label="操作用户">
                            <UserSelector
                                value={operatingUserId}
                                onChange={setOperatingUserId}
                                size="default"
                                style={{ width: 200 }}
                            />
                        </FormItem>
                        <FormItem label="目标对象">
                            <Select
                                placeholder="选择对象..."
                                value={selectedObject}
                                onChange={handleObjectChange}
                                loading={isLoadingObjects}
                                showSearch
                                filterOption={(inputValue, option) =>
                                    String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                }
                                style={{ width: 240 }}
                            >
                                {objectList.map(obj => (
                                    <Option key={obj.api_name} value={obj.api_name}>
                                        {obj.display_name} ({obj.api_name})
                                    </Option>
                                ))}
                            </Select>
                        </FormItem>
                        <FormItem>
                            <Button
                                type="primary"
                                icon={<IconSearch />}
                                onClick={handleQuery}
                                loading={isLoadingData}
                                disabled={!selectedObject}
                            >
                                {isLoadingData ? "查询中..." : "开始查询"}
                            </Button>
                        </FormItem>
                    </Form>
                    {isLoadingData && (
                        <div className="mt-2 text-[var(--color-primary-6)] text-sm animate-pulse">
                            {progress}
                        </div>
                    )}
                </Card>

                {/* Data Table */}
                <div className="flex-1 overflow-hidden relative">
                    <Table
                        columns={columns}
                        data={allRecords}
                        pagination={{
                            showTotal: true,
                            sizeCanChange: true,
                            defaultPageSize: 50,
                            sizeOptions: [20, 50, 100, 200, 500]
                        }}
                        border
                        scroll={{ x: '100%', y: '100%' }}
                        style={{ height: '100%' }}
                        rowKey="_id"
                        noDataElement={
                            <div className="flex flex-col items-center justify-center h-full py-20 text-[var(--color-text-3)]">
                                {selectedObject ? "暂无数据或尚未查询" : "请选择对象并点击查询"}
                            </div>
                        }
                    />
                </div>

                {/* Column Config Modal */}
                <Modal
                    title="配置显示列 (拖拽排序)"
                    visible={showColumnConfig}
                    onOk={() => setShowColumnConfig(false)}
                    onCancel={() => setShowColumnConfig(false)}
                    autoFocus={false}
                    focusLock={true}
                    style={{ width: 600 }}
                    footer={<Button type="primary" onClick={() => setShowColumnConfig(false)}>完成</Button>}
                >
                    <div className="max-h-[500px] overflow-y-auto">
                        <List
                            dataSource={visibleColumns}
                            render={(col, index) => {
                                const isFixed = index < 3;
                                const field = availableFields.find(f => f.api_name === col);
                                const displayName = field ? `${field.display_name} (${col})` : col;
                                const label = col === '_index' ? '序号 (固定)' : (col === '_id' ? '数据 ID (固定)' : (col === 'name' ? '名称 (固定)' : displayName));

                                return (
                                    <div
                                        key={col}
                                        draggable={!isFixed}
                                        onDragStart={(e) => {
                                            if (isFixed) {
                                                e.preventDefault();
                                                return;
                                            }
                                            setDraggedItem(col)
                                        }}
                                        onDragOver={(e) => {
                                            if (isFixed) return;
                                            e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                            if (isFixed) return;
                                            e.preventDefault();
                                            if (draggedItem) {
                                                const fromIndex = visibleColumns.indexOf(draggedItem);
                                                const toIndex = index;
                                                moveColumn(fromIndex, toIndex);
                                                setDraggedItem(null);
                                            }
                                        }}
                                        className={`
                                            p-3 mb-2 rounded border flex items-center justify-between
                                            ${isFixed ? 'bg-[var(--color-fill-2)] cursor-not-allowed border-[var(--color-border-2)] text-[var(--color-text-4)]' : 'bg-[var(--color-bg-2)] cursor-move hover:border-[var(--color-primary-5)] hover:shadow-sm'}
                                        `}
                                    >
                                        <Space>
                                            {!isFixed && <IconDragDotVertical className="text-[var(--color-text-3)]" />}
                                            <span>{label}</span>
                                        </Space>
                                        {isFixed && <Typography.Text type="secondary" className="text-xs">不可调整</Typography.Text>}
                                    </div>
                                );
                            }}
                        />
                    </div>
                </Modal>
            </Content>
        </Layout>
    )
}
