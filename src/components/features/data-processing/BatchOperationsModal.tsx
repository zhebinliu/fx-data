
import React, { useState } from 'react';
import { Modal, Form, Select, Input, InputNumber, Button, Message, Radio, Tabs, DatePicker, Checkbox } from '@arco-design/web-react';
import { IconThunderbolt } from '@arco-design/web-react/icon';

const FormItem = Form.Item;
const Option = Select.Option;
const TabPane = Tabs.TabPane;

interface BatchOperationsModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    connection: any;
    tableName: string;
    columns: string[];
    selectedIds?: any[];
    primaryKey?: string;
}

export function BatchOperationsModal({ visible, onCancel, onSuccess, connection, tableName, columns, selectedIds, primaryKey }: BatchOperationsModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [operationType, setOperationType] = useState('SET');

    const handleExecute = async () => {
        try {
            const values = await form.validate();
            setLoading(true);

            // Construct payload based on operation type
            let payload: any = {
                ...connection,
                table: tableName,
                column: values.column,
                operation: operationType,
                params: {},
                ids: selectedIds,
                primaryKey: primaryKey
            };

            switch (operationType) {
                case 'SET':
                    payload.params = { value: values.value };
                    break;
                case 'REPLACE':
                    payload.params = { from: values.fromStr, to: values.toStr };
                    break;
                case 'MATH':
                    payload.params = { operator: values.mathOp, value: values.mathValue };
                    break;
                case 'UPPER':
                case 'LOWER':
                case 'TRIM':
                    // No params needed
                    break;
                case 'DATE_FMT':
                    payload.params = { fromFormat: values.fromFmt, toFormat: values.toFmt };
                    break;
                case 'SPLIT':
                    payload.params = {
                        separator: values.separator,
                        targetColumns: values.targetColumns.split(',').map((s: string) => s.trim()).filter(Boolean),
                        autoCreate: values.autoCreate
                    };
                    break;
            }

            const res = await fetch('/data/api/db/batch-transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                Message.success(`成功更新 ${result.affectedRows} 行数据`);
                onSuccess();
                onCancel();
            } else {
                Message.error('操作失败: ' + result.error);
            }

        } catch (e: any) {
            console.error(e);
            Message.error('验证失败或执行错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center">
                    <IconThunderbolt className="mr-2 text-blue-500" />
                    批量数据处理
                </div>
            }
            visible={visible}
            onCancel={onCancel}
            onOk={handleExecute}
            confirmLoading={loading}
            okText="执行处理"
            cancelText="取消"
        >
            <Form form={form} layout="vertical">
                <FormItem label="选择目标列" field="column" rules={[{ required: true }]}>
                    <Select placeholder="选择要更新的列">
                        {columns.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                </FormItem>

                <FormItem label="选择操作类型" field="operationType">
                    <Select
                        placeholder="请选择操作类型"
                        value={operationType}
                        onChange={(v) => {
                            setOperationType(v);
                            form.clearFields(['value', 'fromStr', 'toStr', 'mathOp', 'mathValue', 'fromFmt', 'toFmt', 'separator', 'targetColumns', 'autoCreate']);
                        }}
                    >
                        <Option value="SET">赋值 (Set Value)</Option>
                        <Option value="REPLACE">替换 (Replace)</Option>
                        <Option value="STRING">文本处理 (String Ops)</Option>
                        <Option value="MATH">数值计算 (Math Ops)</Option>
                        <Option value="DATE_FMT">日期格式化 (Date Format)</Option>
                        <Option value="SPLIT">数据分列 (Split Column)</Option>
                    </Select>
                </FormItem>

                {/* Assignment */}
                {operationType === 'SET' && (
                    <FormItem label="新值" field="value" rules={[{ required: true }]}>
                        <Input placeholder="输入要统一设置的值" />
                    </FormItem>
                )}

                {/* Replace */}
                {operationType === 'REPLACE' && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormItem label="查找内容" field="fromStr" rules={[{ required: true }]}>
                            <Input placeholder="输入要查找的内容" />
                        </FormItem>
                        <FormItem label="替换为" field="toStr" rules={[{ required: true }]}>
                            <Input placeholder="输入替换后的内容" />
                        </FormItem>
                    </div>
                )}

                {/* String Ops */}
                {operationType === 'STRING' && (
                    <FormItem field="stringOp" label="文本操作">
                        <Radio.Group onChange={v => setOperationType(v)}>
                            <Radio value="UPPER">转大写</Radio>
                            <Radio value="LOWER">转小写</Radio>
                            <Radio value="TRIM">去空格</Radio>
                        </Radio.Group>
                    </FormItem>
                )}

                {/* Math Ops */}
                {operationType === 'MATH' && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormItem label="运算符" field="mathOp" rules={[{ required: true }]} initialValue="*">
                            <Select>
                                <Option value="+">加 (+)</Option>
                                <Option value="-">减 (-)</Option>
                                <Option value="*">乘 (*)</Option>
                                <Option value="/">除 (/)</Option>
                            </Select>
                        </FormItem>
                        <FormItem label="操作数" field="mathValue" rules={[{ required: true }]}>
                            <InputNumber placeholder="例如: 100" />
                        </FormItem>
                    </div>
                )}

                {/* Date Format */}
                {operationType === 'DATE_FMT' && (
                    <div className="bg-orange-50 p-3 rounded mb-4 text-orange-800 text-xs">
                        ⚠️ 日期格式化依赖于数据库函数。请确保格式字符串与 MySQL (DATE_FORMAT) 或 PostgreSQL (TO_CHAR) 兼容。
                        <br /> 例如: MySQL '%Y-%m-%d', PG 'YYYY-MM-DD'
                    </div>
                )}
                {operationType === 'DATE_FMT' && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormItem label="原格式" field="fromFmt" rules={[{ required: true }]} tooltip="MySQL: %Y/%m/%d, PG: YYYY/MM/DD">
                            <Input placeholder="例如: %Y/%m/%d" />
                        </FormItem>
                        <FormItem label="新格式" field="toFmt" rules={[{ required: true }]} tooltip="目标格式模式">
                            <Input placeholder="例如: %Y-%m-%d" />
                        </FormItem>
                    </div>
                )}

                {/* Split Column */}
                {operationType === 'SPLIT' && (
                    <>
                        <div className="bg-blue-50 p-3 rounded mb-4 text-blue-800 text-xs">
                            将选定列的内容按分隔符拆分到多个新列中。
                        </div>
                        <FormItem label="分隔符 (Separator)" field="separator" rules={[{ required: true }]} initialValue=",">
                            <Input placeholder="例如: , - | (空格)" />
                        </FormItem>
                        <FormItem label="目标列名 (Target Columns)" field="targetColumns" rules={[{ required: true }]} tooltip="用逗号分隔，按顺序对应拆分后的值">
                            <Input placeholder="Col1, Col2, Col3..." />
                        </FormItem>
                        <FormItem field="autoCreate" noStyle>
                            <Checkbox>
                                <span style={{ color: 'var(--color-text-1)' }}>
                                    如果列不存在自动创建 (Auto-create missing columns)
                                </span>
                            </Checkbox>
                        </FormItem>
                    </>
                )}


            </Form>
        </Modal>
    );
}
