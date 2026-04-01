"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import {
    Button,
    Input,
    Card,
    Typography,
    Select,
    Message,
    Form,
    Space,
    Grid,
    Divider,
    Descriptions,
    Badge,
    Empty,
    Tag,
    DatePicker,
    Spin,
    Layout,
    Alert
} from "@arco-design/web-react"
import {
    IconSearch,
    IconRefresh,
    IconEdit,
    IconSave,
    IconLeft,
    IconLoading
} from "@arco-design/web-react/icon"
import { useProfiles } from "@/context/ProfileContext"
import { UserSelector } from "@/components/shared/UserSelector"
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

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

export default function FxcrmDataUpdater() {
    const { activeProfile } = useProfiles()

    // UI State
    const [isLoadingObjects, setIsLoadingObjects] = useState(false)
    const [isLoadingFields, setIsLoadingFields] = useState(false)
    const [isLoadingData, setIsLoadingData] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Data State
    const [objectList, setObjectList] = useState<any[]>([])
    const [selectedObject, setSelectedObject] = useState<string>("")
    const [availableFields, setAvailableFields] = useState<FieldMeta[]>([])
    const [recordList, setRecordList] = useState<any[]>([])
    const [isLoadingRecords, setIsLoadingRecords] = useState(false)

    // Operating User Override
    const [operatingUserId, setOperatingUserId] = useState<string>("")

    useEffect(() => {
        setOperatingUserId(activeProfile.currentOpenUserId)
    }, [activeProfile.currentOpenUserId])

    const [dataId, setDataId] = useState<string>("")
    const [recordData, setRecordData] = useState<any>(null)
    const [editedData, setEditedData] = useState<any>({})

    const hasChanges = Object.keys(editedData).length > 0

    // Fetch Object List
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

    // Fetch Object Description (Fields)
    const fetchObjectFields = async (apiName: string) => {
        setIsLoadingFields(true)
        try {
            const response = await fetch('/data/api/fxcrm/objects/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...activeProfile, apiName })
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.fields)) {
                setAvailableFields(result.fields)
            } else {
                Message.error(`获取字段失败: ${result.error}`)
            }
        } catch (e: any) {
            Message.error(`获取字段错误: ${e.message}`)
        } finally {
            setIsLoadingFields(false)
        }
    }

    const handleObjectChange = (val: string) => {
        setSelectedObject(val)
        setAvailableFields([])
        setRecordData(null)
        setEditedData({})
        setRecordList([])
        setDataId("")
        fetchObjectFields(val)
        fetchRecordList(val)
    }

    // Fetch all records for the selected object
    const fetchRecordList = async (apiName: string) => {
        setIsLoadingRecords(true)
        try {
            const response = await fetch('/data/api/fxcrm/data/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activeProfile,
                    currentOpenUserId: operatingUserId || activeProfile.currentOpenUserId,
                    apiName,
                    limit: 100,
                    offset: 0
                })
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
                setRecordList(result.data)
            } else {
                Message.error(`获取记录列表失败: ${result.error}`)
            }
        } catch (e: any) {
            Message.error(`获取记录列表网络错误: ${e.message}`)
        } finally {
            setIsLoadingRecords(false)
        }
    }

    // Handle record selection from dropdown
    const handleRecordSelect = (recordId: string) => {
        setDataId(recordId)
        // Auto-fetch the selected record
        setTimeout(() => {
            handleFetchRecord()
        }, 100)
    }

    // Fetch Single Record
    const handleFetchRecord = async () => {
        if (!selectedObject || !dataId) {
            Message.warning("请选择对象并输入数据 ID")
            return
        }

        setIsLoadingData(true)
        setRecordData(null)
        setEditedData({})

        try {
            const response = await fetch('/data/api/fxcrm/data/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activeProfile,
                    currentOpenUserId: operatingUserId || activeProfile.currentOpenUserId,
                    apiName: selectedObject,
                    dataId: dataId
                })
            })
            const result = await response.json()
            if (result.success && result.data) {
                setRecordData(result.data)
                Message.success("成功获取数据")
            } else {
                Message.error(`查询失败: ${result.error || "未找到数据"}`)
            }
        } catch (e: any) {
            Message.error(`查询数据网络错误: ${e.message}`)
        } finally {
            setIsLoadingData(false)
        }
    }

    // Handle Field Edit
    const handleFieldChange = (field: FieldMeta, value: any) => {
        const apiName = field.api_name
        const originalValue = recordData[apiName]

        let processedValue = value
        // Convert dates to timestamps if they are date strings from DatePicker
        if ((field.type === 'date_time' || field.type === 'date') && value && typeof value === 'string') {
            const ts = new Date(value).getTime()
            if (!isNaN(ts)) {
                processedValue = ts
            }
        }

        if (processedValue === originalValue) {
            const newEdited = { ...editedData }
            delete newEdited[apiName]
            setEditedData(newEdited)
        } else {
            setEditedData({
                ...editedData,
                [apiName]: processedValue
            })
        }
    }

    // Submit Changes
    const handleUpdate = async () => {
        if (!hasChanges) return

        // Use the actual _id from the fetched record, not the search input
        const actualId = recordData?._id || dataId

        setIsUpdating(true)
        try {
            const response = await fetch('/data/api/fxcrm/data/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activeProfile,
                    currentOpenUserId: operatingUserId || activeProfile.currentOpenUserId,
                    apiName: selectedObject,
                    dataId: actualId,
                    fieldData: editedData
                })
            })
            const result = await response.json()
            if (result.success) {
                Message.success("数据更新成功")
                // Refresh data
                handleFetchRecord()
            } else {
                Message.error(`更新失败: ${result.error}`)
            }
        } catch (e: any) {
            Message.error(`更新数据网络错误: ${e.message}`)
        } finally {
            setIsUpdating(false)
        }
    }

    const [showJson, setShowJson] = useState(false)

    const renderFieldValue = (field: FieldMeta) => {
        const val = editedData.hasOwnProperty(field.api_name)
            ? editedData[field.api_name]
            : recordData[field.api_name]

        // Handle Rich Text
        if (field.type === 'html_rich_text') {
            return (
                <div className={editedData.hasOwnProperty(field.api_name) ? 'border border-orange-500 rounded' : ''}>
                    <ReactQuill
                        theme="snow"
                        value={val || ''}
                        onChange={(content) => handleFieldChange(field, content)}
                        modules={{
                            toolbar: [
                                [{ 'header': [1, 2, false] }],
                                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                ['link', 'image'],
                                ['clean']
                            ],
                        }}
                    />
                </div>
            )
        }

        // Handle Date/Time types
        if (field.type === 'date_time' || field.type === 'date') {
            // Convert timestamp to Date object for DatePicker if it's a number
            const dateValue = typeof val === 'number' ? new Date(val) : val;

            return (
                <DatePicker
                    showTime={field.type === 'date_time'}
                    format={field.type === 'date_time' ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD"}
                    value={dateValue}
                    onChange={(v) => handleFieldChange(field, v)}
                    style={{ width: '100%' }}
                    className={editedData.hasOwnProperty(field.api_name) ? 'border-orange-500 bg-orange-50/10' : ''}
                />
            )
        }

        return (
            <Input
                value={val === null || val === undefined ? '' : (Array.isArray(val) ? val.join(',') : String(val))}
                onChange={(v) => handleFieldChange(field, v)}
                style={{ width: '100%' }}
                className={editedData.hasOwnProperty(field.api_name) ? 'border-orange-500 bg-orange-50/10' : ''}
            />
        )
    }

    return (
        <Layout className="min-h-screen bg-[var(--color-bg-1)] p-4 sm:p-8">
            <Content className="w-full bg-[var(--color-bg-2)] p-4 sm:p-8 rounded-sm shadow-sm relative">
                <div className="mb-8 border-b border-[var(--color-border-2)] pb-4">
                    <Title heading={3} className="m-0! flex items-center gap-2">
                        <IconEdit className="text-[var(--color-primary-6)]" />
                        数据更新
                    </Title>
                    <Text type="secondary">查询并更新纷享销客 CRM 单条数据 (支持自定义对象)。</Text>
                </div>

                <div className="space-y-6">
                    <Card title="查询条件" bordered={true} className="shadow-none border-[var(--color-border-2)] bg-[var(--color-fill-2)]">
                        <Form layout="vertical">
                            <Row gutter={24} align="end">
                                <Col span={6}>
                                    <FormItem
                                        label={
                                            <Space>
                                                <span>操作用户</span>
                                                <div className="text-xs text-[var(--color-text-3)] font-normal">API 调用执行者</div>
                                            </Space>
                                        }
                                        style={{ marginBottom: 0 }}
                                    >
                                        <UserSelector
                                            value={operatingUserId}
                                            onChange={(val) => setOperatingUserId(val)}
                                            size="large"
                                        />
                                    </FormItem>
                                </Col>
                                <Col span={8}>
                                    <FormItem label="目标对象" style={{ marginBottom: 0 }}>
                                        <Select
                                            placeholder="选择对象..."
                                            value={selectedObject}
                                            onChange={handleObjectChange}
                                            loading={isLoadingObjects}
                                            showSearch
                                            filterOption={(inputValue, option) =>
                                                String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                            }
                                            size="large"
                                        >
                                            {objectList.map(obj => (
                                                <Option key={obj.api_name} value={obj.api_name}>
                                                    {obj.display_name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </FormItem>
                                </Col>
                                <Col span={10}>
                                    <FormItem label="选择记录" style={{ marginBottom: 0 }}>
                                        <Select
                                            placeholder={isLoadingRecords ? "正在加载记录..." : "从列表中选择记录..."}
                                            value={dataId}
                                            onChange={handleRecordSelect}
                                            loading={isLoadingRecords}
                                            showSearch
                                            filterOption={(inputValue, option) =>
                                                String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                            }
                                            size="large"
                                            disabled={!selectedObject || recordList.length === 0}
                                            notFoundContent={selectedObject ? "未找到记录" : "请先选择对象"}
                                        >
                                            {recordList.map(record => (
                                                <Option key={record._id} value={record._id}>
                                                    {record.name || record._id} {record.account_no ? `(${record.account_no})` : ''}
                                                </Option>
                                            ))}
                                        </Select>
                                    </FormItem>
                                </Col>
                                <Col span={24} style={{ marginTop: 16, textAlign: 'right' }}>
                                    <Button
                                        type="primary"
                                        icon={<IconSearch />}
                                        onClick={handleFetchRecord}
                                        loading={isLoadingData}
                                        size="large"
                                        disabled={!dataId}
                                        style={{ width: 120 }}
                                    >
                                        查询详情
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    {isLoadingData && (
                        <div className="flex justify-center py-20">
                            <Spin tip="正在努力加载数据..." />
                        </div>
                    )}

                    {!isLoadingData && recordData && (
                        <Card
                            title={
                                <div className="flex justify-between items-center w-full">
                                    <Space size="medium">
                                        <Title heading={6} style={{ margin: 0 }}>
                                            数据主属性: {recordData.name || dataId}
                                        </Title>
                                        <Tag color="arcoblue">{selectedObject}</Tag>
                                    </Space>
                                    <Space>
                                        <Button
                                            size="small"
                                            type={showJson ? "primary" : "secondary"}
                                            onClick={() => setShowJson(!showJson)}
                                        >
                                            {showJson ? "编辑模式" : "查看 JSON"}
                                        </Button>
                                        {hasChanges && (
                                            <Button
                                                type="primary"
                                                status="warning"
                                                icon={<IconSave />}
                                                onClick={handleUpdate}
                                                loading={isUpdating}
                                            >
                                                提交修改 ({Object.keys(editedData).length})
                                            </Button>
                                        )}
                                        <Button
                                            icon={<IconRefresh />}
                                            onClick={handleFetchRecord}
                                            disabled={isUpdating}
                                        >
                                            刷新
                                        </Button>
                                    </Space>
                                </div>
                            }
                            bordered={true}
                            className="shadow-sm border-[var(--color-primary-light-2)]"
                        >
                            {showJson ? (
                                <div className="bg-[var(--color-fill-2)] p-4 rounded-lg font-mono text-sm overflow-auto max-h-[600px]">
                                    <pre>{JSON.stringify(recordData, null, 2)}</pre>
                                </div>
                            ) : (
                                <>
                                    <Alert
                                        type="info"
                                        showIcon
                                        content="修改任一字段后，右上角会出现黄色“提交修改”按钮。橙色边框表示已修改字段。"
                                        style={{ marginBottom: 20 }}
                                    />

                                    <Form layout="vertical">
                                        <Row gutter={[32, 20]}>
                                            {availableFields.map(field => (
                                                <Col span={12} key={field.api_name}>
                                                    <FormItem
                                                        label={
                                                            <div className="flex justify-between w-full group">
                                                                <span className="font-medium text-[var(--color-text-1)]">{field.display_name}</span>
                                                                <Text type="secondary" className="text-xs font-mono opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    {field.api_name}
                                                                </Text>
                                                            </div>
                                                        }
                                                        required={field.is_required}
                                                        extra={field.type ? <Text type="secondary" className="text-xs">类型: {field.type}</Text> : null}
                                                    >
                                                        {renderFieldValue(field)}
                                                    </FormItem>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Form>
                                </>
                            )}
                        </Card>
                    )}

                    {!isLoadingData && !recordData && selectedObject && (
                        <div className="text-center py-20 bg-[var(--color-bg-2)] rounded-lg border border-dashed border-[var(--color-border-3)]">
                            <Empty description="等待查询或未找到匹配数据" />
                        </div>
                    )}
                </div>
            </Content>
        </Layout>
    )
}
