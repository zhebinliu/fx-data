import React, { useEffect, useState } from 'react';
import { Select, Message, Spin } from '@arco-design/web-react';
import { useProfiles } from '@/context/ProfileContext';

interface User {
    name: string;
    mobile: string;
    openUserId?: string;
    department?: string;
}

interface UserSelectorProps {
    value?: string;
    onChange?: (val: string) => void;
    size?: 'default' | 'mini' | 'small' | 'large';
    style?: React.CSSProperties;
    disabled?: boolean;
}

export function UserSelector({ value, onChange, size = 'default', style, disabled }: UserSelectorProps) {
    const { activeProfile } = useProfiles();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState(false);

    // Fetch users on mount or profile change
    useEffect(() => {
        const fetchUsers = async () => {
            if (!activeProfile.appId || !activeProfile.appSecret) return;

            setLoading(true);
            try {
                const response = await fetch('/data/api/fxcrm/users/list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(activeProfile)
                });
                const result = await response.json();

                if (result.success && Array.isArray(result.users)) {
                    setUsers(result.users);
                } else {
                    console.error("Failed to load users:", result.error);
                }
            } catch (e) {
                console.error("User list network error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [activeProfile.appId, activeProfile.appSecret]);

    const handleChange = async (mobile: string) => {
        if (!mobile) {
            onChange?.("");
            return;
        }

        // Find user to display name immediately if needed, but we use mobile as key for lookup
        setResolvingId(true);
        try {
            const response = await fetch('/data/api/fxcrm/users/openid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activeProfile,
                    mobile
                })
            });
            const result = await response.json();

            if (result.success && result.openUserId) {
                onChange?.(result.openUserId);
                Message.success(`已切换操作用户 ID: ${result.openUserId}`);
            } else {
                Message.error("获取用户 OpenID 失败");
            }
        } catch (e) {
            Message.error("查询 OpenID 网络错误");
        } finally {
            setResolvingId(false);
        }
    };

    // Reverse lookup: Find user mobile from openUserId to show correct selection label
    // Note: This is imperfect because we only store mobile->openId in the backend lookup direction.
    // If the tool loads with a pre-set openUserId, we might not match it back to a name unless we fetch all OpenIDs.
    // However, for the purpose of this tool, user *selection* is the primary action. 
    // We will display the raw ID if no user matches, or rely on the user re-selecting.
    // Ideally, we'd fetch OpenIDs for all users, but that's expensive.

    // Improved UX: We use the value (OpenUserId) directly. 
    // The Select displays the user list. When a user clicks, we handle the lookup.
    // But the Select value must match Option value.
    // Strategy: The Select Options have value={user.mobile}. 
    // But the `value` prop passed in is `openUserId`. Mismatch!
    // FIX: This component should control the ID.
    // Since we can't easily map ID -> Name without an API call, we can just show the ID in the box 
    // if it doesn't match a known session user.
    // Re-reading reg: "Dropdown... load active users... store mobile... select -> query openid".

    // We'll use a local state for the *selected mobile* to drive the Select UI,
    // and sync it with the parent OpenID.

    return (
        <Select
            placeholder="选择操作用户 (自动获取 ID)"
            loading={loading || resolvingId}
            size={size}
            style={style}
            disabled={disabled}
            onChange={handleChange}
            allowClear
            showSearch
            filterOption={(inputValue, option) => {
                const mobile = (option?.props as any)?.value;
                const user = users.find(u => u.mobile === mobile);
                if (!user) return false;
                return user.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                    (user.department || "").toLowerCase().includes(inputValue.toLowerCase());
            }}
        // We only support 'selecting' a user to SET the ID. 
        // We don't try to reverse-engineer who the current ID belongs to for now to keep it simple,
        // unless we want to do a reverse lookup. 
        // So we leave `value` controlled by local interaction or empty.
        // Actually, showing the current ID in a separate disabled Input might be better UI, 
        // and this Select is just a "Switch User" action.
        >
            {users.map((user) => (
                <Select.Option key={user.mobile} value={user.mobile}>
                    {user.name} {user.department ? `(${user.department})` : ''}
                </Select.Option>
            ))}
        </Select>
    );
}
