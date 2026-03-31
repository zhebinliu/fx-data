export const PERMISSIONS = {
    IMPORT: 'import',
    UPDATE: 'update',
    QUERY: 'query',
    PROCESS: 'process',
    WORKFLOW: 'workflow',
    ADMIN: 'admin'
} as const;

export const PERMISSION_LABELS = {
    [PERMISSIONS.IMPORT]: '数据导入',
    [PERMISSIONS.UPDATE]: '数据更新',
    [PERMISSIONS.QUERY]: '数据查询',
    [PERMISSIONS.PROCESS]: '数据处理',
    [PERMISSIONS.WORKFLOW]: '自动化工作流',
    [PERMISSIONS.ADMIN]: '管理员'
};
