"use client"

import * as React from "react"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import {
    Button,
    Input,
    Card,
    Tag,
    Typography,
    Upload,
    Select,
    Collapse,
    Message,
    Notification,
    Table,
    Space,
    Grid,
    Badge,
    Divider,
    Modal,
    Form,
    Layout,
    Tooltip,
    Alert,
    DatePicker,
    Radio,
    InputNumber,
    Trigger,
    Dropdown,
    Menu,
    Checkbox
} from '@arco-design/web-react';








import {
    IconUpload,
    IconFile,
    IconRefresh,
    IconDelete,
    IconPlus,
    IconDownload,
    IconSave,
    IconDown,
    IconUp,
    IconExclamationCircle,
    IconCheckCircle,
    IconInfoCircle,
    IconSettings,
    IconFileVideo,
    IconStorage,
    IconQuestionCircle,
    IconClose
} from '@arco-design/web-react/icon';
import { useProfiles } from '@/context/ProfileContext';
import { UserSelector } from '@/components/shared/UserSelector';
import { ConnectionManager } from '@/components/features/data-processing/ConnectionManager';
import { VLookupModal } from '@/components/features/data-processing/VLookupModal';
import { BatchOperationsModal } from '@/components/features/data-processing/BatchOperationsModal';
import * as XLSX from "xlsx"
import axios from "axios"
import { Plus, Save, Trash, Settings, RefreshCw, FileJson, Download, Trash2, AlertCircle, FileSpreadsheet } from "lucide-react"

const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;
const { Header, Content, Footer } = Layout;
const CollapseItem = Collapse.Item;
const FormItem = Form.Item;
const Option = Select.Option;

interface ConfigProfile {
    id: string
    name: string
    appId: string
    appSecret: string
    permanentCode: string
    currentOpenUserId: string
}

const DEFAULT_PROFILE: ConfigProfile = {
    id: "default",
    name: "默认配置",
    appId: "",
    appSecret: "",
    permanentCode: "",
    currentOpenUserId: ""
}

export function FxcrmImporter() {
    const { activeProfile, updateProfile, saveProfiles } = useProfiles();

    const [config, setConfig] = React.useState({
        appId: activeProfile.appId,
        appSecret: activeProfile.appSecret,
        permanentCode: activeProfile.permanentCode,
        objectApiName: "",
        currentOpenUserId: activeProfile.currentOpenUserId
    })

    // Import to DB State
    const [showImportDbModal, setShowImportDbModal] = React.useState(false);
    const [targetDbConnection, setTargetDbConnection] = React.useState<number | null>(null);
    const [targetDbTable, setTargetDbTable] = React.useState<string>('');
    const [isImportingToDb, setIsImportingToDb] = React.useState(false);
    const [autoCreateColumns, setAutoCreateColumns] = React.useState(false);

    // Sync config with active profile when it changes
    React.useEffect(() => {
        // Only update if current config is different from active profile
        // but avoid circular updates if config was just set FROM profile
        if (config.appId !== activeProfile.appId ||
            config.appSecret !== activeProfile.appSecret ||
            config.permanentCode !== activeProfile.permanentCode ||
            config.currentOpenUserId !== activeProfile.currentOpenUserId) {

            updateProfile({
                appId: config.appId,
                appSecret: config.appSecret,
                permanentCode: config.permanentCode,
                currentOpenUserId: config.currentOpenUserId
            });
        }
    }, [config.appId, config.appSecret, config.permanentCode, config.currentOpenUserId]);

    // Initialize config from active profile on mount, profile switch, or data load
    React.useEffect(() => {
        setConfig(prev => {
            // Prevent loop: if content matches, do not trigger re-render
            if (prev.appId === activeProfile.appId &&
                prev.appSecret === activeProfile.appSecret &&
                prev.permanentCode === activeProfile.permanentCode &&
                prev.currentOpenUserId === activeProfile.currentOpenUserId) {
                return prev;
            }
            return {
                ...prev,
                appId: activeProfile.appId,
                appSecret: activeProfile.appSecret,
                permanentCode: activeProfile.permanentCode,
                currentOpenUserId: activeProfile.currentOpenUserId
            };
        });
    }, [activeProfile]);

    // Helper for active cell to show suggestions
    const [activeMappingKey, setActiveMappingKey] = React.useState<string | null>(null)

    const [file, setFile] = React.useState<File | null>(null)
    const [data, setData] = React.useState<any[]>([])
    // Store mapping from Excel Header -> API Name
    const [mapping, setMapping] = React.useState<Record<string, string>>({})
    const [status, setStatus] = React.useState<"idle" | "uploading" | "processing" | "done" | "error">("idle")
    const [logs, setLogs] = React.useState<string[]>([])
    // List of available objects from FxCRM
    const [objectList, setObjectList] = React.useState<any[]>([])
    const [isLoadingObjects, setIsLoadingObjects] = React.useState(false)
    // List of available fields for the selected object
    const [availableFields, setAvailableFields] = React.useState<any[]>([])
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Toggle for showing detailed config
    const [showConfigDetails, setShowConfigDetails] = React.useState(false)
    // Track loading state for sync columns
    const [syncLoading, setSyncLoading] = React.useState<string | null>(null)
    // Track row-level import results
    const [rowResults, setRowResults] = React.useState<Record<number, { success: boolean, error?: string }>>({})
    const [showOnlyFailed, setShowOnlyFailed] = React.useState(false)
    const [showPasteModal, setShowPasteModal] = React.useState(false)
    const [pasteText, setPasteText] = React.useState("")

    // Database Source State
    const [sourceType, setSourceType] = React.useState<'file' | 'db'>('file')
    const [dbConnection, setDbConnection] = React.useState<any>(null)
    const [dbTables, setDbTables] = React.useState<string[]>([])
    const [selectedDbTable, setSelectedDbTable] = React.useState<string | null>(null)
    const [showDbConnectionModal, setShowDbConnectionModal] = React.useState(false)

    const [isLoadingDbTables, setIsLoadingDbTables] = React.useState(false)
    const [isLoadingDbData, setIsLoadingDbData] = React.useState(false)
    const [savedConnections, setSavedConnections] = React.useState<any[]>([])
    const [dbLoadLimit, setDbLoadLimit] = React.useState(5000)

    // Fetch saved connections when switching to DB source
    React.useEffect(() => {
        if (sourceType === 'db') {
            fetchSavedDbConnections()
        }
    }, [sourceType])

    const fetchSavedDbConnections = async () => {
        try {
            const res = await fetch('/data/api/config/db-connections');
            const result = await res.json();
            if (result.success) {
                setSavedConnections(result.connections || []);
            }
        } catch (e) {
            console.error("Failed to load connections", e);
        }
    };

    // Fetch fields when objectApiName changes (and credentials exist)


    // Fetch fields when objectApiName changes (and credentials exist)
    React.useEffect(() => {
        if (config.objectApiName && config.appId && config.appSecret && config.permanentCode && config.currentOpenUserId) {
            addLog(`正在获取 ${config.objectApiName} 的字段描述...`)
            fetchObjectDescription(config.objectApiName)
        } else {
            // Optional: Log why it didn't trigger if objectApiName is present but others missing
            if (config.objectApiName) {
                console.log("由于凭证缺失，跳过获取字段描述")
            }
        }
    }, [config.objectApiName, config.currentOpenUserId])

    // Auto-match fields when data or availableFields change
    React.useEffect(() => {
        if (data.length > 0 && availableFields.length > 0) {
            const headers = Object.keys(data[0])
            const newMapping = { ...mapping }
            let hasChanges = false

            headers.forEach(header => {
                // Only map if currently empty
                if (!newMapping[header]) {
                    const match = availableFields.find(f =>
                        f.display_name === header ||
                        f.api_name === header ||
                        f.display_name.includes(header) || // Simple fuzzy: field label contains header
                        header.includes(f.display_name)    // Simple fuzzy: header contains field label
                    )
                    if (match) {
                        newMapping[header] = match.api_name
                        hasChanges = true
                    }
                }
            })

            if (hasChanges) {
                setMapping(newMapping)
                addLog("已根据表头自动匹配字段。")
            }
        }
    }, [data, availableFields])

    // Save config to localStorage on change - DEPRECATED for Profiles, but keeping objectApiName mostly
    // We only create side-effects for objectApiName now, profiles handle the rest manually via Save button
    React.useEffect(() => {
        if (config.objectApiName) {
            localStorage.setItem("fxcrm_last_object", config.objectApiName)
        }
    }, [config.objectApiName])

    // Load last object on mount
    React.useEffect(() => {
        const lastObj = localStorage.getItem("fxcrm_last_object")
        if (lastObj) {
            setConfig(prev => ({ ...prev, objectApiName: lastObj }))
        }
    }, [])



    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
        if (msg.includes("成功") || msg.includes("完成")) {
            Message.success(msg)
        } else if (msg.includes("失败") || msg.includes("错误")) {
            Message.error(msg)
        } else {
            Message.info(msg)
        }
    }

    const fetchObjects = async () => {
        if (!config.appId || !config.appSecret || !config.permanentCode || !config.currentOpenUserId) {
            addLog("错误: 请先填写 App ID, App Secret, Permanent Code 和 当前用户 ID。")
            return
        }
        setIsLoadingObjects(true)
        addLog("正在获取对象列表...")
        try {
            const response = await fetch('/data/api/fxcrm/objects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.objects)) {
                setObjectList(result.objects)
                addLog(`成功加载 ${result.objects.length} 个对象。`)
            } else {
                addLog(`获取对象失败: ${result.error || "无效的响应格式"}`)
                if (result.rawResponse) {
                    addLog(`原始响应: ${JSON.stringify(result.rawResponse)}`)
                }
            }
        } catch (e: any) {
            addLog(`获取对象列表网络错误: ${e.message}`)
        } finally {
            setIsLoadingObjects(false)
        }
    }

    // Auto-load objects when config has valid credentials
    React.useEffect(() => {
        if (config.appId && config.appSecret && config.permanentCode && config.currentOpenUserId && objectList.length === 0) {
            fetchObjects();
        }
    }, [config.appId, config.appSecret, config.permanentCode, config.currentOpenUserId]);

    const fetchObjectDescription = async (apiName: string) => {
        addLog(`正在获取对象 ${apiName} 的字段列表...`)
        try {
            const response = await fetch('/data/api/fxcrm/objects/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, apiName })
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.fields)) {
                setAvailableFields(result.fields)
                addLog(`成功加载 ${result.fields.length} 个字段 (对象: ${apiName})。`)

                // User requested output of field list return value
                console.log("Full Field Metadata Response:", result)
                addLog("已在控制台 (Console) 输出完整字段元数据，请按 F12 查看。")

                if (result.fields.length === 0 && result.rawResponse) {
                    addLog(`原始响应 (0 字段): ${JSON.stringify(result.rawResponse)}`)
                }
            } else {
                addLog(`获取字段失败: ${result.error}`)
            }
        } catch (e: any) {
            addLog(`获取描述信息网络错误: ${e.message}`)
            console.error("Failed to fetch object description", e)
        }
    }

    const autoMapHeaders = (firstRow: any, currentAvailableFields: any[]) => {
        if (!firstRow || currentAvailableFields.length === 0) return {}
        const newMapping: any = { ...mapping }
        Object.keys(firstRow).forEach(header => {
            const field = currentAvailableFields.find(f_meta =>
                f_meta.display_name.toLowerCase() === header.toLowerCase() ||
                f_meta.api_name.toLowerCase() === header.toLowerCase()
            )
            if (field) newMapping[header] = field.api_name
        })
        return newMapping
    }

    const handlePasteConfirm = () => {
        if (!pasteText.trim()) {
            setShowPasteModal(false)
            return
        }

        try {
            const lines = pasteText.trim().split(/\r?\n/)
            if (lines.length < 2) {
                Message.error("粘贴内容格式不正确，请确保包含表头和至少一行数据。")
                return
            }

            const rawHeaders = lines[0].split('\t')
            const headers = rawHeaders.map((h, i) => h.trim() || `Column_${i}`)

            const jsonData = lines.slice(1).map(line => {
                const values = line.split('\t')
                const row: any = {}
                headers.forEach((header, index) => {
                    row[header] = values[index] || ""
                })
                return row
            })

            setData(jsonData)
            setRowResults({})
            addLog(`从粘贴板加载了 ${jsonData.length} 行数据。`)

            if (availableFields.length > 0) {
                const newMapping = autoMapHeaders(jsonData[0], availableFields)
                setMapping(newMapping)
            }

            setPasteText("")
            setShowPasteModal(false)
        } catch (err) {
            Message.error("解析粘贴内容失败，请确保是从 Excel 复制的标准表格数据。")
        }
    }

    const handleDbConnect = async (config: any) => {
        setDbConnection(config)
        setShowDbConnectionModal(false)
        setIsLoadingDbTables(true)
        addLog(`已连接数据库: ${config.host} / ${config.database}. 正在获取表列表...`)

        try {
            const response = await fetch('/data/api/db/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const result = await response.json();

            if (result.success && Array.isArray(result.tables)) {
                setDbTables(result.tables);
                addLog(`成功获取 ${result.tables.length} 张表。`);
            } else {
                addLog(`获取表列表失败: ${result.error}`);
                Message.error(result.error || "获取表列表失败");
            }
        } catch (e: any) {
            addLog(`获取表列表网络错误: ${e.message}`);
        } finally {
            setIsLoadingDbTables(false);
        }
    };

    const handleLoadDbData = async () => {
        if (!dbConnection || !selectedDbTable) {
            Message.warning("请选择数据库表");
            return;
        }

        setIsLoadingDbData(true);
        addLog(`正在从表 ${selectedDbTable} 读取数据...`);

        try {
            // Default limit 5000 for safety, maybe configurable later
            const response = await fetch('/data/api/db/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...dbConnection,
                    table: selectedDbTable,
                    limit: dbLoadLimit,
                    offset: 0
                })
            });
            const result = await response.json();

            if (result.success) {
                const fetchedData = result.data || [];
                // Add key if needed? DataGrid adds it, but Importer uses array index usually
                setData(fetchedData);
                setRowResults({});
                addLog(`成功从数据库加载了 ${fetchedData.length} 行数据。`);

                if (availableFields.length > 0 && fetchedData.length > 0) {
                    const newMapping = autoMapHeaders(fetchedData[0], availableFields);
                    setMapping(newMapping);
                    addLog("已尝试自动匹配字段。");
                }
            } else {
                addLog(`读取数据库失败: ${result.error}`);
                Message.error(result.error || "查询失败");
            }
        } catch (e: any) {
            addLog(`读取数据库网络错误: ${e.message}`);
        } finally {
            setIsLoadingDbData(false);
        }
    };

    const handleImportToDb = async () => {
        if (!targetDbConnection || !targetDbTable) {
            Message.error("请选择目标数据库和表");
            return;
        }
        if (data.length === 0) {
            Message.warning("没有数据可导入");
            return;
        }

        const conn = savedConnections.find(c => c.id === targetDbConnection);
        if (!conn) {
            Message.error("找不到选定的数据库连接");
            return;
        }

        setIsImportingToDb(true);
        addLog(`正在准备导入数据到数据库: ${conn.name} -> ${targetDbTable}...`);

        try {
            // Use same transformation logic as Import to CRM
            // Filter only mapped fields? Or send everything?
            // Usually DB import expects columns to match.
            // If mapping exists, we use mapped names. If no mapping for a column, we skip it or use header name?
            // Let's use mapped names where available, and skip unmapped columns to avoid errors?
            // OR let user map headers to DB columns.
            // Simplified approach: Use MAPPING. If mapped, use api_name. If not mapped, SKIP.

            const dbData: any[] = [];
            data.forEach((row, i) => {
                const newRow: any = {};
                let hasMappedField = false;

                Object.keys(row).forEach(key => {
                    const apiName = mapping[key]?.trim();
                    if (apiName) {
                        // Use mapped name as column name
                        const val = row[key];
                        // Basic conversion logic if needed (e.g. timestamps) can go here
                        // For now detailed conversion is skipped, assuming raw values or converted string
                        newRow[apiName] = val;
                        hasMappedField = true;
                    }
                });

                if (hasMappedField) {
                    dbData.push(newRow);
                }
            });

            if (dbData.length === 0) {
                Message.warning("没有有效的数据（请确保至少映射了一列）");
                setIsImportingToDb(false);
                return;
            }

            // Batch Send (chunking 1000 items)
            const CHUNK_SIZE = 1000;
            let successParams = 0;

            for (let i = 0; i < dbData.length; i += CHUNK_SIZE) {
                const chunk = dbData.slice(i, i + CHUNK_SIZE);
                addLog(`正在写入第 ${i + 1} - ${Math.min(i + CHUNK_SIZE, dbData.length)} 行...`);

                const response = await fetch('/data/api/db/insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: conn.type,
                        host: conn.host,
                        port: conn.port,
                        user: conn.user,
                        password: conn.password,
                        database: conn.database,
                        table: targetDbTable,
                        autoCreate: autoCreateColumns,
                        data: chunk
                    })
                });

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error);
                }
                successParams += chunk.length;
            }

            addLog(`数据库导入完成: 成功写入 ${successParams} 行。`);
            Message.success(`成功导入 ${successParams} 行数据`);
            setShowImportDbModal(false);

        } catch (e: any) {
            addLog(`数据库导入失败: ${e.message}`);
            Message.error(`导入失败: ${e.message}`);
        } finally {
            setIsImportingToDb(false);
        }
    };

    const handleProcess = async () => {
        // file is not strictly required if we use paste import, check data instead
        if (data.length === 0) {
            Message.warning("请先上传或导入数据")
            return
        }
        setStatus("processing")
        addLog("开始上传流程...")

        try {
            // Determine the scope of import based on the filter
            const targetData = showOnlyFailed
                ? data.filter((_, idx) => rowResults[idx] && rowResults[idx].success === false)
                : data;

            const targetIndices = showOnlyFailed
                ? data.map((_, idx) => idx).filter(idx => rowResults[idx] && rowResults[idx].success === false)
                : data.map((_, idx) => idx);

            if (targetData.length === 0) {
                setStatus("done")
                addLog(showOnlyFailed ? "没有失败的行需要导入。" : "没有数据需要导入。")
                Message.info(showOnlyFailed ? "没有失败的行需要导入。" : "没有数据需要导入。")
                return
            }

            addLog(`准备处理 ${targetData.length} 行数据...`)

            let conversionCount = 0;
            // Transform data based on mapping
            const transformedData = targetData.map((row, i) => {
                const index = targetIndices[i]; // Original index in the data array
                const newRow: any = {}
                Object.keys(row).forEach(key => {
                    const apiName = mapping[key]?.trim()
                    if (apiName && apiName !== "") {
                        const val = row[key];
                        const valStr = String(val || "").trim();

                        // 1. Personnel field automation
                        const personnelFields = [
                            'owner', 'owner_id',
                            'created_by', 'created_by_id',
                            'last_modified_by', 'last_modified_by_id',
                            'lock_user', 'lock_user_id'
                        ]

                        if (personnelFields.includes(apiName.toLowerCase())) {
                            newRow[apiName] = [config.currentOpenUserId]
                        }

                        // 3. Date to timestamp conversion
                        else {
                            const fieldMeta = availableFields.find(f => f.api_name.toLowerCase() === apiName.toLowerCase())
                            if (fieldMeta?.date_format && val && typeof val === 'string') {
                                try {
                                    const ts = new Date(val).getTime()
                                    if (!isNaN(ts)) {
                                        newRow[apiName] = ts
                                    } else {
                                        newRow[apiName] = val
                                    }
                                } catch (e) {
                                    newRow[apiName] = val
                                }
                            } else {
                                newRow[apiName] = val
                            }
                        }
                    }
                })
                return newRow
            })

            if (conversionCount > 0) {
                addLog(`完成！共计自动转换了 ${conversionCount} 处“预设业务类型”。`)
            }

            console.log("Transformed Data for Import (Sample):", transformedData[0])

            // Filter out empty rows if any
            const validIndices: number[] = []
            const validData = transformedData.filter((row, idx) => {
                const isValid = Object.keys(row).length > 0
                if (isValid) {
                    validIndices.push(idx)
                    row.__rowIdx = idx // Add index for precise matching
                }
                return isValid
            })

            if (validData.length === 0) {
                setStatus("error")
                addLog("错误: 没有映射任何字段。请至少将一列映射到 API 字段名。")
                return
            }

            addLog(`正在发送 ${validData.length} 行数据到后台 (已映射)...`)

            const response = await fetch('/data/api/fxcrm/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    data: validData
                })
            })

            const result = await response.json()
            const newResults = { ...rowResults }

            // Common logic for handling row results from details.errors
            if (result.details) {
                const errors = result.details.errors || []

                // 1. Mark all valid rows as successful first
                validIndices.forEach(idx => {
                    newResults[idx] = { success: true }
                })

                // 2. Override with failures from the backend using the explicit index
                errors.forEach((err: any) => {
                    if (err.idx !== undefined) {
                        newResults[err.idx] = { success: false, error: err.error }
                    }
                })

                addLog(`导入完成。成功: ${result.details.successCount}, 失败: ${result.details.failureCount}`)
                if (result.details.failureCount > 0) {
                    Notification.warning({
                        title: '导入完成（含失败）',
                        content: `同步完成。其中 ${result.details.successCount} 条成功，${result.details.failureCount} 条失败。请检查状态图标。`,
                    })
                } else {
                    Message.success(`导入成功: 共 ${result.details.successCount} 条`)
                }
            } else if (result.success) {
                validIndices.forEach(idx => {
                    newResults[idx] = { success: true }
                })
                addLog("导入已完成。")
                Message.success(`导入成功: 共 ${validData.length} 条`)
            } else {
                addLog(`导入失败: ${result.error}`)
                Message.error(`导入失败: ${result.error}`)
            }

            setRowResults(newResults)
            setStatus(result.success || (result.details && result.details.successCount > 0) ? "done" : "error")
        } catch (err: any) {
            setStatus("error")
            addLog(`系统错误: ${err.message}`)
        }
    }

    const handleCellEdit = (rowIndex: number, key: string, value: string) => {
        const newData = [...data]
        newData[rowIndex] = { ...newData[rowIndex], [key]: value }
        setData(newData)
    }

    // Auto-fetch object list if we have fields with target_api_name but no object list loaded
    // This handles the case where user loads a single object but hasn't loaded the full object repository
    React.useEffect(() => {
        if (availableFields.length > 0 && objectList.length === 0) {
            const hasRelatedFields = availableFields.some(f => f.target_api_name);
            if (hasRelatedFields && config.appId && config.appSecret && config.permanentCode && config.currentOpenUserId) {
                console.log("Auto-fetching object list due to related fields detection...");
                fetchObjects();
            }
        }
    }, [availableFields, objectList, config]);

    const handleDownloadData = (format: 'xlsx' | 'csv') => {
        if (data.length === 0) {
            Message.warning("当前没有数据可下载");
            return;
        }

        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Export_${config.objectApiName || 'Data'}_${dateStr}.${format}`;

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

            XLSX.writeFile(workbook, fileName);
            addLog(`已导出数据到 ${fileName}`);
        } catch (e: any) {
            addLog(`导出失败: ${e.message}`);
            Message.error("导出失败");
        }
    };



    const handleExportMapping = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapping, null, 2))
        const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const fileName = `FX_${config.objectApiName || 'Global'}_${dateStr}.json`

        const downloadAnchorNode = document.createElement('a')
        downloadAnchorNode.setAttribute("href", dataStr)
        downloadAnchorNode.setAttribute("download", fileName)
        document.body.appendChild(downloadAnchorNode)
        downloadAnchorNode.click()
        downloadAnchorNode.remove()
        addLog(`映射配置已导出至 ${fileName}`)
    }

    const handleImportMapping = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string)
                if (typeof json === 'object') {
                    setMapping(prev => ({ ...prev, ...json }))
                    addLog("映射导入成功。")
                }
            } catch (err) {
                addLog("解析映射文件配置失败。")
            }
        }
        reader.readAsText(file)
        // Reset input
        event.target.value = ''
    }

    const handleDeleteColumn = (columnKey: string) => {


        // Remove from data
        const newData = data.map(row => {
            const newRow = { ...row }
            delete newRow[columnKey]
            return newRow
        })
        setData(newData)

        // Remove from mapping
        const newMapping = { ...mapping }
        delete newMapping[columnKey]
        setMapping(newMapping)

        addLog(`已删除列: ${columnKey}`)
    }

    const handleAddColumn = (columnName?: string, autoMapping?: string) => {
        let newColumnName = columnName
        if (!newColumnName) {
            newColumnName = prompt("请输入新列的名称 (Excel 表头):", "New Column") || ""
        }
        if (!newColumnName) return

        if (data.length > 0 && Object.keys(data[0]).includes(newColumnName)) {
            if (autoMapping) {
                setMapping(prev => ({ ...prev, [newColumnName]: autoMapping }))
                addLog(`列 "${newColumnName}" 已存在，已自动关联到 ${autoMapping}`)
            } else {
                alert("该列名已存在。")
            }
            return
        }

        // Add to data with empty strings
        const newData = data.map(row => ({
            ...row,
            [newColumnName]: ""
        }))

        setData(newData)

        if (autoMapping) {
            setMapping(prev => ({ ...prev, [newColumnName]: autoMapping }))
            addLog(`已添加新列 "${newColumnName}" 并自动关联到 ${autoMapping}`)
        } else {
            addLog(`已添加新列: ${newColumnName}`)
        }
    }

    const handleSyncColumn = async (columnKey: string, targetApiName: string) => {
        if (syncLoading) return
        setSyncLoading(columnKey)
        addLog(`正在同步列 "${columnKey}" 的关联数据(目标对象: ${targetApiName})...`)

        try {
            // Extract unique non-empty values
            const values = Array.from(new Set(data.map(row => row[columnKey]).filter(v => v && typeof v === 'string' && v.trim() !== "")))

            if (values.length === 0) {
                addLog(`列 "${columnKey}" 没有有效数据，跳过同步。`)
                return
            }

            let response;
            if (targetApiName.toLowerCase() === 'recordtype' || targetApiName.toLowerCase() === 'record_type') {
                // Call record-types API
                response = await fetch('/data/api/fxcrm/objects/record-types', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...config,
                        apiName: config.objectApiName
                    })
                })
                const result = await response.json()
                if (result.success && Array.isArray(result.recordTypes)) {
                    const mappingObj: Record<string, string> = {}
                    result.recordTypes.forEach((rt: any) => {
                        if (rt.name && rt.api_name) {
                            mappingObj[rt.name] = rt.api_name
                        }
                    })

                    let matchCount = 0
                    const newData = data.map(row => {
                        const val = row[columnKey]
                        if (val && mappingObj[val]) {
                            matchCount++
                            return { ...row, [columnKey]: mappingObj[val] }
                        }
                        return row
                    })
                    setData(newData)
                    addLog(`记录类型同步完成: 成功匹配并替换了 ${matchCount} 条数据。`)
                    return
                } else {
                    addLog(`获取记录类型失败: ${result.error || "未知错误"}`)
                    return
                }
            }

            if (targetApiName === 'sales_process_id' || targetApiName === 'sales_stage') {
                addLog(`正在获取 ${config.objectApiName} 的销售流程定义...`)
                response = await fetch('/data/api/fxcrm/objects/sales-processes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...config,
                        apiName: config.objectApiName
                    })
                })
                const result = await response.json()
                if (result.success && Array.isArray(result.salesProcesses)) {
                    const mappingObj: Record<string, string> = {}

                    if (targetApiName === 'sales_process_id') {
                        result.salesProcesses.forEach((sp: any) => {
                            if (sp.name && sp.id) {
                                mappingObj[sp.name] = sp.id
                            }
                        })
                    } else if (targetApiName === 'sales_stage') {
                        // Aggregate stages from all processes
                        result.salesProcesses.forEach((sp: any) => {
                            if (Array.isArray(sp.stages)) {
                                sp.stages.forEach((stage: any) => {
                                    if (stage.name && stage.id) {
                                        mappingObj[stage.name] = stage.id
                                    }
                                })
                            }
                        })
                    }

                    let matchCount = 0
                    const newData = data.map(row => {
                        const val = row[columnKey]
                        if (val && mappingObj[val]) {
                            matchCount++
                            return { ...row, [columnKey]: mappingObj[val] }
                        }
                        return row
                    })
                    setData(newData)
                    addLog(`${targetApiName === 'sales_process_id' ? '销售流程' : '销售阶段'}同步完成: 成功匹配并替换了 ${matchCount} 条数据。`)
                    return
                } else {
                    addLog(`获取销售流程失败: ${result.error || "未知错误"} `)
                    return
                }
            }

            // --- Employee / Personnel Sync Logic ---
            // If target is PersonnelObj (standard) or we detect an employee field
            const isEmployeeField = targetApiName === 'PersonnelObj' || availableFields.find(f => f.api_name === mapping[columnKey])?.type === 'employee';

            if (isEmployeeField) {
                addLog(`正在尝试解析人员字段 "${columnKey}" ...`);

                // 1. Query PersonnelObj by Name to get Mobile
                addLog(`步骤 1/2: 通过姓名查询 PersonnelObj 获取手机号...`);
                const personnelResponse = await fetch('/data/api/fxcrm/data/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...config,
                        apiName: 'PersonnelObj',
                        values, // Searching for these names
                        field: 'name'
                    })
                });

                const personnelResult = await personnelResponse.json();
                if (!personnelResult.success) {
                    addLog(`人员查询失败: ${personnelResult.error}`);
                    return;
                }

                const nameToMobile: Record<string, string> = {};
                if (personnelResult.data && Array.isArray(personnelResult.data)) {
                    personnelResult.data.forEach((p: any) => {
                        // Check standard mobile fields
                        const mobile = p.mobile1 || p.mobile || p.phone;
                        if (p.name && mobile) {
                            nameToMobile[p.name] = mobile;
                        }
                    });
                }

                const foundMobiles = Object.keys(nameToMobile).length;
                addLog(`已找到 ${foundMobiles} 个关联人员的手机号。`);

                if (foundMobiles === 0) {
                    addLog("未找到任何匹配的人员记录。");
                    return;
                }

                // 2. Query OpenID by Mobile
                addLog(`步骤 2/2: 通过手机号换取 OpenUserId...`);
                const nameToOpenId: Record<string, string> = {};
                let resolvedCount = 0;

                // Process in sequence or batched promises to avoid rate limits? 
                // Given standard limits, serial or small chunks is safer.
                const mobilesToQuery = Array.from(new Set(Object.values(nameToMobile)));

                // Helper to fetch single user
                const fetchUser = async (mobile: string) => {
                    try {
                        const res = await fetch('/data/api/fxcrm/user/get-by-mobile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...config,
                                mobile
                            })
                        });
                        const resData = await res.json();
                        if (resData.success) {
                            let uid = "";
                            const uData = resData.data;
                            // Prioritize empList logic as seen in user logs
                            if (uData.empList && uData.empList.length > 0) uid = uData.empList[0].openUserId;
                            else if (uData.openUserId) uid = uData.openUserId;
                            else if (uData.userList && uData.userList.length > 0) uid = uData.userList[0].openUserId;

                            return uid;
                        }
                    } catch (e) { console.error(e); }
                    return null;
                };

                // Map Mobile -> OpenID
                const mobileToOpenId: Record<string, string> = {};
                for (const mobile of mobilesToQuery) {
                    const uid = await fetchUser(mobile);
                    if (uid) mobileToOpenId[mobile] = uid;
                }

                // Build Final Map Name -> OpenID
                Object.entries(nameToMobile).forEach(([name, mobile]) => {
                    if (mobileToOpenId[mobile]) {
                        nameToOpenId[name] = mobileToOpenId[mobile];
                    }
                });

                // Update Data
                let matchCount = 0;
                const newData = data.map(row => {
                    const val = row[columnKey];
                    if (val && nameToOpenId[val]) {
                        matchCount++;
                        return { ...row, [columnKey]: nameToOpenId[val] };
                    }
                    return row;
                });

                setData(newData);
                addLog(`人员同步完成: 成功匹配并替换了 ${matchCount} 条数据。`);
                return;
            }

            // Normal data query sync (original logic for other objects)
            response = await fetch('/data/api/fxcrm/data/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    apiName: targetApiName,
                    values
                })
            })

            const result = await response.json()
            if (result.success && result.mapping) {
                let matchCount = 0
                const newData = data.map(row => {
                    const val = row[columnKey]
                    if (val && result.mapping[val]) {
                        matchCount++
                        return { ...row, [columnKey]: result.mapping[val] }
                    }
                    return row
                })
                setData(newData)
                addLog(`同步完成: 成功匹配并替换了 ${matchCount} 条数据。`)
            } else {
                addLog(`同步失败: ${result.error || "未知错误"} `)
            }

        } catch (e: any) {
            addLog(`同步网络错误: ${e.message} `)
        } finally {
            setSyncLoading(null)
        }
    }

    const allKeyedData = useMemo(() => data.map((r, i) => ({ ...r, key: i })), [data]);

    const tableData = useMemo(() => {
        if (showOnlyFailed) {
            return allKeyedData.filter((r) => rowResults[r.key] && !rowResults[r.key].success);
        }
        return allKeyedData;
    }, [allKeyedData, showOnlyFailed, rowResults]);

    return (
        <Layout className="bg-[var(--color-bg-1)] p-4 sm:p-8">
            <Content className="w-full bg-[var(--color-bg-2)] p-4 sm:p-8 rounded-sm shadow-sm relative">
                <div className="mb-8 border-b pb-4">
                    <Title heading={3} className="m-0! flex items-center gap-2">
                        <IconSettings className="text-[var(--color-primary-6)]" />
                        数据导入
                    </Title>
                    <Text type="secondary">支持字段自动匹配，快速将 Excel 数据导入到纷享销客。</Text>
                </div>

                <Row gutter={[24, 24]}>
                    {/* Left Column: Configuration */}
                    <Col xs={24} lg={8}>
                        <Card
                            title="连接配置"
                            bordered={true}
                            className="h-full shadow-sm hover:shadow-md transition-shadow"
                            extra={
                                <Button
                                    type="secondary"
                                    size="small"
                                    status="success"
                                    icon={<IconSave />}
                                    onClick={() => {
                                        saveProfiles();
                                        Message.success("配置已手动保存");
                                    }}
                                >
                                    保存配置
                                </Button>
                            }
                        >
                            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                                <Form layout="vertical">
                                    <div className="bg-blue-50 p-3 rounded-sm mb-4 border border-blue-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <Text bold>当前配置：{activeProfile.name}</Text>
                                            <Text type="secondary" className="text-xs">右上角可切换/修改</Text>
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            <div className="flex justify-between py-1 border-b border-blue-100/50">
                                                <span>App ID:</span>
                                                <span className="font-mono">{activeProfile.appId || '未设置'}</span>
                                            </div>
                                            <div className="flex justify-between py-1">
                                                <span>当前用户 ID:</span>
                                                <span className="font-mono">{activeProfile.currentOpenUserId || '未设置'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Collapse expandIconPosition="right">
                                        <CollapseItem header="API 凭据详情" name="advanced">
                                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                                <FormItem label="App ID" style={{ marginBottom: 8 }} className="text-xs">
                                                    <Input
                                                        value={config.appId}
                                                        onChange={(val) => setConfig({ ...config, appId: val })}
                                                        autoComplete="off"
                                                        size="small"
                                                        disabled
                                                    />
                                                </FormItem>
                                                <FormItem label="App Secret" style={{ marginBottom: 8 }} className="text-xs">
                                                    <Input.Password
                                                        value={config.appSecret}
                                                        onChange={(val) => setConfig({ ...config, appSecret: val })}
                                                        size="small"
                                                        disabled
                                                    />
                                                </FormItem>
                                                <FormItem label="Permanent Code" style={{ marginBottom: 8 }} className="text-xs">
                                                    <Input.Password
                                                        value={config.permanentCode}
                                                        onChange={(val) => setConfig({ ...config, permanentCode: val })}
                                                        size="small"
                                                        disabled
                                                    />
                                                </FormItem>
                                                <FormItem
                                                    label={
                                                        <Space>
                                                            <span>操作用户</span>
                                                            <Tooltip content="API 调用将以该用户身份执行">
                                                                <IconQuestionCircle />
                                                            </Tooltip>
                                                        </Space>
                                                    }
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <UserSelector
                                                        value={config.currentOpenUserId}
                                                        onChange={(val) => setConfig({ ...config, currentOpenUserId: val })}
                                                    />
                                                </FormItem>
                                            </Space>
                                        </CollapseItem>
                                    </Collapse>

                                    <Divider />

                                    <FormItem label={
                                        <div className="flex justify-between w-full">
                                            <span>对象 API 名称</span>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<IconRefresh className={isLoadingObjects ? "animate-spin" : ""} />}
                                                onClick={fetchObjects}
                                                loading={isLoadingObjects}
                                            >
                                                {objectList.length > 0 ? "刷新" : "获取对象列表"}
                                            </Button>
                                        </div>
                                    }>
                                        {objectList.length > 0 ? (
                                            <Select
                                                placeholder="请选择对象..."
                                                value={config.objectApiName}
                                                onChange={(val) => setConfig({ ...config, objectApiName: val })}
                                                showSearch
                                                filterOption={(inputValue, option) =>
                                                    String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                                }
                                                size="small"
                                            >
                                                {objectList.map((obj: any) => (
                                                    <Option key={obj.api_name} value={obj.api_name}>
                                                        {obj.display_name} ({obj.api_name})
                                                    </Option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <Input
                                                placeholder="例如 AccountObj"
                                                value={config.objectApiName}
                                                onChange={(val) => setConfig({ ...config, objectApiName: val })}
                                                size="small"
                                            />
                                        )}
                                    </FormItem>

                                </Form>
                            </Space>
                        </Card>
                    </Col>


                    {/* Middle Column: Upload / Source */}
                    <Col xs={24} lg={8}>
                        <Card
                            title="数据来源"
                            bordered={true}
                            headerStyle={{ borderBottom: '1px solid #f2f3f5' }}
                            extra={
                                <Radio.Group
                                    type="button"
                                    value={sourceType}
                                    onChange={setSourceType}
                                    size="small"
                                >
                                    <Radio value="file">
                                        <Space size={4}><IconFile /> Excel</Space>
                                    </Radio>
                                    <Radio value="db">
                                        <Space size={4}><IconStorage /> 数据库</Space>
                                    </Radio>
                                </Radio.Group>
                            }
                        >
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>

                                {sourceType === 'file' ? (
                                    <>
                                        <Upload
                                            drag
                                            accept=".xlsx,.csv"
                                            limit={1}
                                            beforeUpload={(f) => {
                                                setFile(f);
                                                const reader = new FileReader();
                                                reader.onload = (e: any) => {
                                                    const dataBin = e.target?.result;
                                                    const workbook = XLSX.read(dataBin, { type: 'binary' });
                                                    const sheetName = workbook.SheetNames[0];
                                                    const sheet = workbook.Sheets[sheetName];
                                                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                                                    addLog(`成功加载文件: ${f.name}，共 ${jsonData.length} 行数据。`);

                                                    if (availableFields.length > 0) {
                                                        const newMapping: any = { ...mapping }
                                                        Object.keys(jsonData[0] || {}).forEach(header => {
                                                            const field = availableFields.find(f_meta =>
                                                                f_meta.display_name.toLowerCase() === header.toLowerCase() ||
                                                                f_meta.api_name.toLowerCase() === header.toLowerCase()
                                                            )
                                                            if (field) newMapping[header] = field.api_name
                                                        })
                                                        setMapping(newMapping)

                                                        // Auto-convert record_type values based on mapping
                                                        let autoConvertCount = 0;
                                                        jsonData.forEach((row: any) => {
                                                            Object.keys(row).forEach(header => {
                                                                if (newMapping[header] === 'record_type' && String(row[header]).trim() === '预设业务类型') {
                                                                    row[header] = 'default__c';
                                                                    autoConvertCount++;
                                                                }
                                                            })
                                                        });
                                                        if (autoConvertCount > 0) {
                                                            addLog(`自动转换: 已将 ${autoConvertCount} 处 "预设业务类型" 转为 "default__c"`);
                                                        }
                                                    }
                                                    setData(jsonData as any[]);
                                                };
                                                reader.readAsBinaryString(f);
                                                return false; // Prevent auto-upload
                                            }}
                                            tip="支持 .xlsx, .csv 格式"
                                        />

                                        <div className="flex gap-2">
                                            <Button
                                                size="large"
                                                icon={<IconPlus />}
                                                onClick={() => setShowPasteModal(true)}
                                                title="从剪贴板粘贴数据"
                                                className="w-full"
                                            >
                                                粘贴导入
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="bg-[var(--color-fill-2)] p-3 rounded border border-[var(--color-border-2)]">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-gray-700 font-medium">选择数据库连接</div>
                                                <Button type="text" size="mini" onClick={() => setShowDbConnectionModal(true)}>
                                                    管理/新建连接
                                                </Button>
                                            </div>
                                            <Select
                                                placeholder="请选择已保存的连接"
                                                value={dbConnection?.id || undefined}
                                                onChange={(val) => {
                                                    const conn = savedConnections.find(c => c.id === val);
                                                    if (conn) {
                                                        handleDbConnect(conn); // Auto connect
                                                    }
                                                }}
                                                allowClear
                                                onClear={() => {
                                                    setDbConnection(null);
                                                    setDbTables([]);
                                                    setData([]);
                                                }}
                                                showSearch
                                                filterOption={(inputValue, option) =>
                                                    String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                                }
                                            >
                                                {savedConnections.map(c => (
                                                    <Option key={c.id} value={c.id}>
                                                        {c.name || `${c.user}@${c.host}/${c.database}`}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </div>

                                        {dbConnection && (
                                            <>
                                                <div className="flex items-center gap-2 text-xs text-green-600 px-1">
                                                    <IconCheckCircle /> 已连接到: {dbConnection.host} / {dbConnection.database}
                                                </div>
                                                <Select
                                                    placeholder="请选择数据表"
                                                    value={selectedDbTable || undefined}
                                                    onChange={setSelectedDbTable}
                                                    showSearch
                                                    filterOption={(inputValue, option) =>
                                                        (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                                    }
                                                    loading={isLoadingDbTables}
                                                >
                                                    {dbTables.map(t => <Option key={t} value={t}>{t}</Option>)}
                                                </Select>

                                                <div className="flex gap-2 items-center">
                                                    <span className="text-gray-500 whitespace-nowrap text-xs">Limit:</span>
                                                    <InputNumber
                                                        mode="button"
                                                        value={dbLoadLimit}
                                                        onChange={val => setDbLoadLimit(Number(val))}
                                                        style={{ width: 140 }}
                                                        min={1}
                                                        max={100000}
                                                        step={1000}
                                                    />
                                                    <Button
                                                        type="primary"
                                                        disabled={!selectedDbTable}
                                                        loading={isLoadingDbData}
                                                        onClick={handleLoadDbData}
                                                        className="flex-1"
                                                    >
                                                        加载数据
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <Divider style={{ margin: '12px 0' }} />



                                <div className="flex gap-2 w-full">
                                    <Button
                                        type="primary"
                                        size="large"
                                        className="flex-1"
                                        status="success"
                                        loading={status === 'processing'}
                                        disabled={data.length === 0}
                                        onClick={handleProcess}
                                        icon={<IconUpload />}
                                    >
                                        {status === 'processing'
                                            ? '正在同步中...'
                                            : (showOnlyFailed ? '仅重试失败行' : '开始导入到 CRM')}
                                    </Button>

                                    <Button
                                        size="large"
                                        icon={<IconStorage />}
                                        title="导入到数据库"
                                        disabled={data.length === 0}
                                        onClick={() => {
                                            if (savedConnections.length === 0) fetchSavedDbConnections();
                                            setShowImportDbModal(true);
                                        }}
                                    />

                                    <Dropdown
                                        droplist={
                                            <Menu onClickMenuItem={(key) => handleDownloadData(key as 'xlsx' | 'csv')}>
                                                <Menu.Item key="xlsx">导出为 Excel (.xlsx)</Menu.Item>
                                                <Menu.Item key="csv">导出为 CSV (.csv)</Menu.Item>
                                            </Menu>
                                        }
                                        trigger="click"
                                    >
                                        <Button size="large" icon={<IconDownload />} title="下载数据">

                                        </Button>
                                    </Dropdown>
                                </div>
                            </Space>
                        </Card>
                    </Col>

                    {/* Right Column: Logs */}
                    <Col xs={24} lg={8}>
                        <Card
                            title="同步日志"
                            bordered={true}
                            headerStyle={{ borderBottom: '1px solid #f2f3f5' }}
                        >
                            <div className="bg-[#1d2129] p-4 rounded-sm h-[320px] overflow-y-auto font-mono text-[10px] text-[#e5e6eb] shadow-inner border border-[#272b33]">
                                {logs.length === 0 ? (
                                    <Text type="secondary" style={{ color: '#4e5969' }}>等待操作启动...</Text>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className="mb-1 border-l-2 border-[#165dff] pl-2 py-0.5 hover:bg-[#272b33] transition-colors">
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>

                <Divider />

                {data.length > 0 && (
                    <Card
                        title={
                            <div className="flex justify-between items-center w-full">
                                <Space direction="vertical" size={0}>
                                    <Title heading={5} style={{ margin: 0 }}>数据预览与映射</Title>
                                    <Text type="secondary" style={{ fontSize: 12 }}>支持单元格内联编辑，请根据表头提示完成字段映射。</Text>
                                </Space>
                                <Space>
                                    {Object.keys(rowResults).length > 0 && (
                                        <div className="flex items-center gap-2 bg-[var(--color-fill-2)] px-2 py-1 rounded">
                                            <Text style={{ fontSize: 12 }}>只看失败行</Text>
                                            <input
                                                type="checkbox"
                                                checked={showOnlyFailed}
                                                onChange={(e) => setShowOnlyFailed(e.target.checked)}
                                            />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept=".json"
                                        onChange={handleImportMapping}
                                    />
                                    <Button size="small" icon={<IconFile />} onClick={() => fileInputRef.current?.click()}>
                                        导入配置
                                    </Button>
                                    <Button size="small" icon={<IconDownload />} onClick={handleExportMapping}>
                                        导出配置
                                    </Button>
                                    <Button type="primary" size="small" icon={<IconPlus />} onClick={() => handleAddColumn()}>
                                        增加列
                                    </Button>
                                </Space>
                            </div>
                        }
                        bordered={true}
                    >
                        <div className="p-4">
                            {availableFields.length > 0 && (() => {
                                const mappedApiNames = new Set(Object.values(mapping).filter(Boolean))
                                const missingRequired = availableFields.filter(f => f.is_required && !mappedApiNames.has(f.api_name))

                                if (missingRequired.length > 0) {
                                    return (
                                        <div className="mb-4 p-4 border border-[var(--color-danger-light-2)] bg-[var(--color-danger-light-1)] text-[var(--color-danger-6)] rounded-sm flex items-start shadow-sm">
                                            <IconExclamationCircle style={{ fontSize: 20, marginRight: 12, marginTop: 2, flexShrink: 0 }} />
                                            <div>
                                                <h4 className="font-bold text-sm">缺少必填映射字段</h4>
                                                <p className="text-xs mt-1 opacity-90">以下当前对象必填字段尚未建立映射关系，可能导致导入失败：</p>
                                                <ul className="list-disc list-inside text-xs mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                                                    {missingRequired.map(f => (
                                                        <li key={f.api_name} className="flex items-center gap-1">
                                                            <span className="font-medium underline decoration-dotted">{f.display_name}</span>
                                                            <span className="text-[10px] opacity-70">({f.api_name})</span>
                                                            <Button
                                                                type="text"
                                                                size="mini"
                                                                className="h-4 w-4 p-0 ml-1 text-[var(--color-primary-6)] hover:bg-[var(--color-primary-light-1)]"
                                                                onClick={() => handleAddColumn(f.display_name, f.api_name)}
                                                                title="一键添加列"
                                                            >
                                                                <IconPlus />
                                                            </Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            <div className="border border-[var(--color-border-2)] rounded-sm shadow-inner bg-[var(--color-bg-2)] overflow-hidden">
                                <Table
                                    border
                                    hover
                                    stripe
                                    size="small"
                                    scroll={{ x: true, y: 600 }}
                                    pagination={false}
                                    virtualized
                                    data={tableData}
                                    rowClassName={(record) => {
                                        const result = rowResults[record.key]
                                        if (!result) return ""
                                        return result.success ? "bg-[var(--color-success-light-1)]" : "bg-[var(--color-danger-light-1)]"
                                    }}
                                    columns={[
                                        {
                                            title: '#',
                                            width: 80,
                                            align: 'center',
                                            fixed: 'left',
                                            render: (_, __, index) => index + 1
                                        },
                                        {
                                            title: '导入状态',
                                            width: 80,
                                            align: 'center',
                                            fixed: 'left',
                                            render: (_, record) => {
                                                const result = rowResults[record.key]
                                                return result ? (
                                                    result.success ? (
                                                        <IconCheckCircle style={{ color: '#00b42a', fontSize: 16 }} />
                                                    ) : (
                                                        <Tooltip content={result.error}>
                                                            <IconExclamationCircle style={{ color: '#f53f3f', fontSize: 16 }} />
                                                        </Tooltip>
                                                    )
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border border-[#E5E6EB] mx-auto" />
                                                )
                                            }
                                        },
                                        ...Object.keys(data[0] || {}).map((key) => {
                                            const mappedApiName = mapping[key]?.trim();
                                            const mappedField = mappedApiName ? availableFields.find(f => f.api_name.toLowerCase() === mappedApiName.toLowerCase()) : null;

                                            return {
                                                title: (
                                                    <div className="flex flex-col gap-1.5 min-h-[96px] justify-between py-1 relative">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center gap-1 overflow-hidden">
                                                                    <Text bold style={{ fontSize: 13, color: '#1D2129' }} className="truncate max-w-[140px]" title={key}>{key}</Text>
                                                                    {mappedField?.is_required && <span className="text-[#F53F3F] font-bold text-xs">*</span>}
                                                                </div>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    className="h-5 w-5 p-0 text-[var(--color-text-3)] hover:text-[var(--color-danger-6)] hover:bg-[var(--color-danger-light-1)]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteColumn(key);
                                                                    }}
                                                                >
                                                                    <IconDelete style={{ fontSize: 12 }} />
                                                                </Button>
                                                            </div>

                                                            <Trigger
                                                                popup={() => (
                                                                    <div className="w-[200px] max-h-60 overflow-auto rounded-md border bg-[var(--color-bg-popup)] shadow-md p-1">
                                                                        {availableFields.length === 0 ? (
                                                                            <div className="p-2 text-gray-400 text-xs text-center">暂无可用字段</div>
                                                                        ) : (
                                                                            availableFields
                                                                                .filter(f => {
                                                                                    const val = mapping[key] || ""
                                                                                    if (!val) return true
                                                                                    return f.api_name.toLowerCase().includes(val.toLowerCase()) ||
                                                                                        f.display_name.toLowerCase().includes(val.toLowerCase())
                                                                                })
                                                                                .map((f: any) => (
                                                                                    <div
                                                                                        key={f.api_name}
                                                                                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs hover:bg-[var(--color-fill-2)] cursor-pointer"
                                                                                        onClick={() => {
                                                                                            setMapping({ ...mapping, [key]: f.api_name })
                                                                                            if (document.activeElement instanceof HTMLElement) {
                                                                                                document.activeElement.blur();
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex flex-col w-full">
                                                                                            <span className="font-medium">
                                                                                                {f.display_name}
                                                                                                {f.is_required && <span className="text-red-500 ml-1">*</span>}
                                                                                            </span>
                                                                                            <span className="text-gray-500 text-[10px]">{f.api_name}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                        )}
                                                                    </div>
                                                                )}
                                                                trigger="focus"
                                                                position="bl"
                                                            >
                                                                <Input
                                                                    placeholder="映射 API 字段..."
                                                                    size="small"
                                                                    className={mappedField?.is_required ? "border-l-2 border-l-[#F53F3F]" : ""}
                                                                    style={{ backgroundColor: 'transparent', fontSize: 11, color: '#4E5969', height: 24, padding: '0 8px' }}
                                                                    value={mapping[key] || ""}
                                                                    onChange={(val) => setMapping({ ...mapping, [key]: val })}
                                                                    autoComplete="off"
                                                                />
                                                            </Trigger>
                                                        </div>
                                                        <div className="min-h-[24px] flex items-end">
                                                            {(mappedField?.target_api_name || mappedField?.api_name?.toLowerCase() === 'record_type' || mappedField?.api_name?.toLowerCase() === 'sales_process_id' || mappedField?.api_name?.toLowerCase() === 'sales_stage' || mappedField?.type === 'employee') && (() => {
                                                                let display_name = '关联对象';
                                                                let prefix = '关联: ';
                                                                const fieldApiName = mappedField?.api_name?.toLowerCase();
                                                                const isPersonnel = mappedField?.type === 'employee' || mappedField?.target_api_name === 'PersonnelObj';

                                                                if (fieldApiName === 'record_type') {
                                                                    display_name = '业务类型';
                                                                    prefix = '类型: ';
                                                                } else if (fieldApiName === 'sales_process_id') {
                                                                    display_name = '销售流程';
                                                                    prefix = '流程: ';
                                                                } else if (fieldApiName === 'sales_stage') {
                                                                    display_name = '销售阶段';
                                                                    prefix = '阶段: ';
                                                                } else if (isPersonnel) {
                                                                    display_name = '人员(姓名->ID)';
                                                                    prefix = '解析: ';
                                                                } else {
                                                                    const targetObj = objectList.find((o: any) => o.api_name === mappedField?.target_api_name);
                                                                    display_name = targetObj ? targetObj.display_name : (objectList.length > 0 ? mappedField?.target_api_name : "加载中...");
                                                                }

                                                                return (
                                                                    <Tag
                                                                        color={isPersonnel ? "blue" : "orange"}
                                                                        size="small"
                                                                        className="w-fit scale-90 origin-left"
                                                                        icon={
                                                                            <IconRefresh
                                                                                className={`cursor-pointer ${syncLoading === key ? "animate-spin" : ""} `}
                                                                                onClick={() => handleSyncColumn(key, fieldApiName === 'record_type' ? 'RecordType' : (fieldApiName === 'sales_process_id' ? 'sales_process_id' : (fieldApiName === 'sales_stage' ? 'sales_stage' : (isPersonnel ? 'PersonnelObj' : mappedField?.target_api_name))))}
                                                                            />
                                                                        }
                                                                    >
                                                                        {prefix}{display_name}
                                                                    </Tag>
                                                                );
                                                            })()}
                                                        </div>

                                                    </div>
                                                ),
                                                dataIndex: key,
                                                width: 210,
                                                render: (val: any, record: any) => {
                                                    const i = record.key;
                                                    const apiName = mapping[key]?.trim()
                                                    const fieldMeta = apiName ? availableFields.find(f => f.api_name.toLowerCase() === apiName.toLowerCase()) : null
                                                    const isDate = !!fieldMeta?.date_format
                                                    const result = rowResults[i]

                                                    let displayValue = String(val || "")
                                                    if (isDate && val && !isNaN(Number(val))) {
                                                        try {
                                                            const d = new Date(Number(val))
                                                            if (!isNaN(d.getTime())) {
                                                                const pad = (n: number) => n.toString().padStart(2, '0')
                                                                displayValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                                                            }
                                                        } catch (e) { }
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-0.5">
                                                            {isDate ? (
                                                                <DatePicker
                                                                    showTime
                                                                    size="small"
                                                                    format="YYYY-MM-DD HH:mm"
                                                                    value={displayValue ? displayValue.replace('T', ' ') : undefined}
                                                                    onChange={(dateString) => handleCellEdit(i, key, dateString)}
                                                                    className="border-transparent hover:border-[#165DFF] focus:border-[#165DFF] w-full"
                                                                    style={{ backgroundColor: 'transparent' }}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    size="small"
                                                                    value={displayValue}
                                                                    onChange={(val) => handleCellEdit(i, key, val)}
                                                                    className="border-transparent hover:border-[#165DFF] focus:border-[#165DFF]"
                                                                    style={{ backgroundColor: 'transparent' }}
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                }
                                            }
                                        })
                                    ]}
                                />
                            </div >
                        </div >
                    </Card >
                )}
            </Content >


            <Modal
                title="配置数据库连接"
                visible={showDbConnectionModal}
                onCancel={() => {
                    setShowDbConnectionModal(false)
                    // Refresh list logic if needed
                    if (typeof fetchSavedDbConnections === 'function') {
                        fetchSavedDbConnections();
                    }
                }}
                footer={null}
                style={{ width: 600 }}
            >
                <ConnectionManager onConnect={handleDbConnect} />
            </Modal>

            <Modal
                title="从粘贴导入数据"
                visible={showPasteModal}
                onOk={handlePasteConfirm}
                onCancel={() => {
                    setShowPasteModal(false)
                    setPasteText("")
                }}
                okText="确认导入"
                cancelText="取消"
                style={{ width: '90%', maxWidth: 800 }}
            >
                <div className="mb-4">
                    <Alert
                        type="info"
                        content="请直接从 Excel 中复制包含表头的区域，然后粘贴到下方。系统将自动解析 Tab 分隔符。"
                    />
                </div>
                <Input.TextArea
                    placeholder="在此处粘贴 Excel 数据...&#10;第一行应为表头"
                    value={pasteText}
                    onChange={(val) => setPasteText(val)}
                    autoSize={{ minRows: 10, maxRows: 20 }}
                />
            </Modal>
            {/* Import to DB Modal */}
            <Modal
                title="导入数据到数据库"
                visible={showImportDbModal}
                onOk={handleImportToDb}
                onCancel={() => setShowImportDbModal(false)}
                okText="开始导入"
                cancelText="取消"
                confirmLoading={isImportingToDb}
            >
                <div className="flex flex-col gap-4">
                    <Form layout="vertical">
                        <FormItem label="选择数据库连接">
                            <Select
                                placeholder="请选择目标数据库"
                                value={targetDbConnection || undefined}
                                onChange={val => setTargetDbConnection(val as number)}
                            >
                                {savedConnections.map(conn => (
                                    <Option key={conn.id} value={conn.id}>
                                        {conn.name} ({conn.type})
                                    </Option>
                                ))}
                            </Select>
                        </FormItem>
                        <FormItem label="目标表名">
                            <Input
                                placeholder="输入表名 (例如: my_table)"
                                value={targetDbTable}
                                onChange={val => setTargetDbTable(val)}
                            />
                            <div className="text-gray-500 text-xs mt-1">
                                注意: 将直接写入数据，请确保表结构与当前映射的字段 (API Name) 匹配。
                            </div>
                        </FormItem>
                        <FormItem>
                            <Checkbox checked={autoCreateColumns} onChange={setAutoCreateColumns}>
                                自动添加缺少的列 (Auto-add missing columns)
                            </Checkbox>
                        </FormItem>
                    </Form>
                </div>
            </Modal>
        </Layout >
    )
}
