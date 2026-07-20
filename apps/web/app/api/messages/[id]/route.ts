/**
 * PATCH /api/messages/[id]  — mark message as read / unread
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { PatchMessageSchema } from '@ko/types';
import { cancelPendingDigestsIfCaughtUp } from '@/lib/notifications/message-email-digest';

export const PATCH = createParamHandler<z.infer<typeof PatchMessageSchema>, { id: string }>({
    method: 'PATCH',
    requiredFeature: 'messages',
    schema: PatchMessageSchema,
    handler: async (_req: NextRequest, { body, orgId, params }) => {
        const { id } = params;

        const existing = await prisma.message.findFirst({ where: { id, orgId } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } },
                { status: 404 }
            );
        }

        const updated = await prisma.message.update({
            where: { id },
            data: { isRead: body.isRead },
        });

        // === FRONTEND ADDITION: cancel pending digests when inbox is caught up ===
        if (body.isRead && existing.clientId) {
            await cancelPendingDigestsIfCaughtUp({
                orgId: orgId!,
                clientId: existing.clientId,
            }).catch((err) => console.error('[messages] digest cancel failed:', err));
        }
        // === END FRONTEND ADDITION ===

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    },
});
