"use client"

import React from 'react';
import { Menu, Input, Empty } from '@arco-design/web-react';
import { IconFile } from '@arco-design/web-react/icon';

const MenuItem = Menu.Item;

interface TableExplorerProps {
    tables: string[];
    selectedTable: string | null;
    onSelect: (table: string) => void;
}

export function TableExplorer({ tables, selectedTable, onSelect }: TableExplorerProps) {
    const [filter, setFilter] = React.useState("");

    const filteredTables = tables.filter(t => t.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="flex flex-col h-full">
            <div className="p-2 sticky top-0 bg-[var(--color-fill-2)] z-10">
                <Input.Search
                    placeholder="搜索数据表..."
                    onChange={setFilter}
                    className="bg-[var(--color-bg-2)]"
                />
            </div>

            {filteredTables.length === 0 ? (
                <div className="py-10">
                    <Empty description="未找到数据表" />
                </div>
            ) : (
                <Menu
                    selectedKeys={selectedTable ? [selectedTable] : []}
                    onClickMenuItem={onSelect}
                    style={{ border: 'none', background: 'transparent' }}
                >
                    {filteredTables.map(table => (
                        <MenuItem key={table}>
                            <div className="flex items-center">
                                <IconFile className="mr-2 text-[var(--color-text-3)]" />
                                <span className="truncate" title={table}>{table}</span>
                            </div>
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </div>
    );
}
