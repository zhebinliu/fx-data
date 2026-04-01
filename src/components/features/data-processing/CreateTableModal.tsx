import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Table, Button, Message, Steps, Select } from '@arco-design/web-react';
import { IconUpload, IconFile } from '@arco-design/web-react/icon';
import * as XLSX from 'xlsx';

const Step = Steps.Step;
const FormItem = Form.Item;
const Option = Select.Option;

interface CreateTableModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: (tableName: string) => void;
    connection: any;
}

export function CreateTableModal({ visible, onCancel, onSuccess, connection }: CreateTableModalProps) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [tableName, setTableName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFileChange = (fileList: any[], file: any) => {
        setFile(file.originFile);
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const bstr = e.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (jsonData.length < 2) {
                    Message.error("文件内容为空或格式不正确");
                    return;
                }

                const headers = jsonData[0] as string[];
                const rows = jsonData.slice(1);

                // transform rows to objects for preview
                const previewData = rows.slice(0, 5).map((row: any, i) => {
                    const obj: any = { key: i };
                    headers.forEach((h, idx) => {
                        obj[h] = row[idx];
                    });
                    return obj;
                });

                setData(previewData);
                setColumns(headers.map(h => ({ name: h, type: 'TEXT' })));

                // Auto-suggest table name from file name
                const fName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                setTableName(fName);

                setStep(2);
            } catch (err) {
                Message.error("解析文件失败");
            }
        };
        reader.readAsBinaryString(file.originFile);
    };

    const handleCreate = async () => {
        if (!tableName) {
            Message.error("请输入表名");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Table
            const createRes = await fetch('/data/api/db/create-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection,
                    tableName,
                    columns
                })
            });
            const createResult = await createRes.json();

            if (!createResult.success) {
                throw new Error(createResult.error || "创建表失败");
            }

            // 2. Import Data (Full read this time to be simple, for large files we might need chunking which is handled in Main maybe? 
            // Ideally we pass data to Main to handle chunked import, but for "Create & Import" flow let's do it here or pass back to parent.
            // Let's try to do it here but re-read file properly to get all data.

            const reader = new FileReader();
            reader.readAsBinaryString(file as Blob);
            await new Promise<void>((resolve, reject) => {
                reader.onload = async (e: any) => {
                    const wb = XLSX.read(e.target.result, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const allData = XLSX.utils.sheet_to_json(ws);

                    // Chunk insert
                    const CHUNK_SIZE = 1000;
                    for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
                        const chunk = allData.slice(i, i + CHUNK_SIZE);
                        await fetch('/data/api/db/insert', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: connection.type,
                                host: connection.host,
                                port: connection.port,
                                user: connection.user,
                                password: connection.password,
                                database: connection.database,
                                table: tableName,
                                data: chunk
                            })
                        });
                    }
                    resolve();
                };
            });

            Message.success(`成功创建表 ${tableName} 并导入数据`);
            onSuccess(tableName);
            onCancel();

        } catch (e: any) {
            Message.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="从文件新建表"
            visible={visible}
            onCancel={onCancel}
            footer={null}
            style={{ width: 800 }}
        >
            <Steps current={step} style={{ marginBottom: 20 }}>
                <Step title="上传文件" />
                <Step title="预览与配置" />
            </Steps>

            {step === 1 && (
                <div className="h-60 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                    <Upload
                        drag
                        accept=".xlsx,.csv"
                        limit={1}
                        autoUpload={false}
                        onChange={handleFileChange}
                    >
                        <div className="text-center cursor-pointer">
                            <IconUpload style={{ fontSize: 48, color: '#86909c' }} />
                            <div className="mt-4 text-gray-600">点击或拖拽文件到此处上传</div>
                            <div className="text-gray-400 text-xs mt-2">支持 .xlsx, .csv 格式</div>
                        </div>
                    </Upload>
                </div>
            )}

            {step === 2 && (
                <div>
                    <Form layout="vertical">
                        <FormItem label="目标表名" required>
                            <Input value={tableName} onChange={setTableName} placeholder="请输入数据库表名 (英文)" />
                        </FormItem>
                        <div className="mb-4">
                            <div className="font-bold mb-2">数据预览 (前5行)</div>
                            <Table
                                size="small"
                                columns={columns.map(c => ({ title: c.name, dataIndex: c.name }))}
                                data={data}
                                pagination={false}
                                scroll={{ x: true }}
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button onClick={() => setStep(1)}>上一步</Button>
                            <Button type="primary" onClick={handleCreate} loading={loading}>创建并导入</Button>
                        </div>
                    </Form>
                </div>
            )}
        </Modal>
    );
}
