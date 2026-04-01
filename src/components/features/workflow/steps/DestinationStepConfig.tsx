import React, { useState, useEffect } from 'react';
import { Select, Input, Table, Button, Typography, Spin, Message, Space, Empty } from '@arco-design/web-react';
import { IconPlus, IconDelete } from '@arco-design/web-react/icon';
import { useProfiles } from '@/context/ProfileContext';

const Option = Select.Option;
const { Title } = Typography;

interface DestinationStepConfigProps {
    config: any;
    onChange: (newConfig: any) => void;
}

export function DestinationStepConfig({ config, onChange }: DestinationStepConfigProps) {
    const { activeProfile } = useProfiles();
    const [objects, setObjects] = useState<any[]>([]);
    const [fields, setFields] = useState<any[]>([]);
    const [loadingObjects, setLoadingObjects] = useState(false);
    const [loadingFields, setLoadingFields] = useState(false);

    // Initial load of objects
    useEffect(() => {
        if (activeProfile?.id) {
            fetchObjects();
        }
    }, [activeProfile]);

    // Load fields when object changes
    useEffect(() => {
        if (config.objectApiName && activeProfile?.id) {
            fetchFields(config.objectApiName);
        }
    }, [config.objectApiName]);

    const fetchObjects = async () => {
        try {
            setLoadingObjects(true);
            const res = await fetch('/data/api/fxcrm/objects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activeProfile)
            });
            const data = await res.json();
            if (data.success) {
                setObjects(data.objects || []);
            }
        } catch (e) {
            Message.error("加载对象失败");
        } finally {
            setLoadingObjects(false);
        }
    };

    const fetchFields = async (apiName: string) => {
        try {
            setLoadingFields(true);
            const res = await fetch('/data/api/fxcrm/objects/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...activeProfile, apiName })
            });
            const data = await res.json();
            if (data.success) {
                setFields(data.fields || []);
            }
        } catch (e) {
            Message.error("加载字段失败");
        } finally {
            setLoadingFields(false);
        }
    };

    const handleObjectChange = (val: string) => {
        onChange({ ...config, objectApiName: val, mappings: [] }); // Reset mappings
    };

    const addMapping = () => {
        const mappings = config.mappings || [];
        onChange({ ...config, mappings: [...mappings, { id: Date.now().toString(), source: '', target: '' }] });
    };

    const updateMapping = (index: number, key: 'source' | 'target', value: string) => {
        const mappings = [...(config.mappings || [])];
        mappings[index] = { ...mappings[index], [key]: value };
        onChange({ ...config, mappings });
    };

    const removeMapping = (index: number) => {
        const mappings = [...(config.mappings || [])];
        mappings.splice(index, 1);
        onChange({ ...config, mappings });
    };

    const columns = [
        {
            title: 'FxCRM 字段 (目标)',
            dataIndex: 'target',
            render: (val: string, item: any, index: number) => (
                <Select
                    showSearch
                    placeholder="选择 CRM 字段"
                    value={val}
                    onChange={(v) => updateMapping(index, 'target', v)}
                    loading={loadingFields}
                    filterOption={(inputValue, option) =>
                        (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                    }
                >
                    {fields.map(f => (
                        <Option key={f.api_name} value={f.api_name}>
                            {f.display_name} ({f.api_name}) {f.is_required ? "*" : ""}
                        </Option>
                    ))}
                </Select>
            )
        },
        {
            title: '源列名',
            dataIndex: 'source',
            render: (val: string, item: any, index: number) => (
                <Input
                    placeholder="例如：customer_name"
                    value={val}
                    onChange={(v) => updateMapping(index, 'source', v)}
                />
            )
        },
        {
            title: '操作',
            width: 80,
            render: (_: any, __: any, index: number) => (
                <Button icon={<IconDelete />} status="danger" shape="circle" size="small" onClick={() => removeMapping(index)} />
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div>
                <div className="mb-2 font-bold text-[var(--color-text-1)]">目标对象</div>
                <Select
                    placeholder="选择导入对象"
                    value={config.objectApiName}
                    onChange={handleObjectChange}
                    loading={loadingObjects}
                    showSearch
                    filterOption={(inputValue, option) =>
                        (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                    }
                >
                    {objects.map(o => (
                        <Option key={o.api_name} value={o.api_name}>{o.display_name} ({o.api_name})</Option>
                    ))}
                </Select>
            </div>

            {config.objectApiName && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-[var(--color-text-1)]">字段映射</div>
                        <Button size="small" type="secondary" icon={<IconPlus />} onClick={addMapping}>添加字段</Button>
                    </div>
                    <Table
                        columns={columns}
                        data={config.mappings || []}
                        pagination={false}
                        noDataElement={<Empty description="未定义映射" />}
                        rowKey="id"
                        border={false}
                        className="border rounded"
                    />
                </div>
            )}
        </div>
    );
}
