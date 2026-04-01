import { NextResponse } from 'next/server';
import { getCurrentUser, updateUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { theme, primaryColor, aiConfig } = body;

        // Construct updates object, ensuring we only update allowed fields
        const updates: any = {};
        if (theme || primaryColor || aiConfig) {
            updates.preferences = {
                ...user.preferences,
                ...(theme && { theme }),
                ...(primaryColor && { primaryColor }),
                ...(aiConfig && { aiConfig })
            };
        }

        // If other profile fields need updating (like name), add them here
        // if (name) updates.name = name;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true, user });
        }

        const updatedUser = await updateUser(user.id, updates);

        return NextResponse.json({ success: true, user: updatedUser });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
