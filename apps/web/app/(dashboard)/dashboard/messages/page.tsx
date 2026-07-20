'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  Circle,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  User,
  X,
} from 'lucide-react';
import { useMessages, useSendMessage, useMarkMessageRead } from '@/hooks/use-messages';
import { usePlanFeature } from '@/hooks/use-org';
import { useMessagingSettings } from '@/hooks/use-settings';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { PlanGate } from '@/components/dashboard/plan-gate';
import type { MessageRecord, MessageChannel } from '@/lib/api/client';
import { formatApiError } from '@/lib/api/client';

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  IN_APP: 'In-app',
};

const CHANNEL_ICON: Record<MessageChannel, React.ReactNode> = {
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <Phone className="h-4 w-4" />,
  IN_APP: <MessageSquare className="h-4 w-4" />,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const LIST_QUERY = { page: 1, perPage: 50 } as const;

type DeliveryResult = { inApp?: string; email?: string; sms?: string; errors?: string[] };

function DeliveryLine({ label, status }: { label: string; status: string }) {
  const labelText =
    status === 'sent'
      ? '✓ Sent'
      : status === 'scheduled'
        ? '⏱ Scheduled'
        : '✗ Failed';
  const ok = status === 'sent' || status === 'scheduled';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-60">{label}</span>
      <span className={ok ? 'font-medium text-brand-teal-700' : 'font-medium text-red'}>
        {labelText}
      </span>
    </div>
  );
}

function ComposeModal({
  onClose,
  onSend,
  isPending,
  error,
  delivery,
  availableChannels,
}: {
  onClose: () => void;
  onSend: (data: {
    body: string;
    subject?: string;
    channel: MessageChannel;
    clientId?: string;
  }) => void | Promise<void>;
  isPending: boolean;
  error?: string | null;
  delivery?: DeliveryResult | null;
  availableChannels: MessageChannel[];
}) {
  const channels =
    availableChannels.length > 0 ? availableChannels : (['IN_APP'] as MessageChannel[]);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [channel, setChannel] = useState<MessageChannel>(channels[0] ?? 'IN_APP');
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (!channels.includes(channel)) {
      setChannel(channels[0] ?? 'IN_APP');
    }
  }, [channels, channel]);

  if (delivery) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-20 px-6 py-4">
            <h2 className="font-heading text-sm font-bold text-ink">Message sent</h2>
            <button type="button" onClick={onClose} className="text-ink-60 hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3 px-6 py-5">
            {delivery.inApp && delivery.inApp !== 'skipped' && (
              <DeliveryLine label="In-app" status={delivery.inApp} />
            )}
            {delivery.email && delivery.email !== 'skipped' && (
              <DeliveryLine label="Email" status={delivery.email} />
            )}
            {delivery.sms && delivery.sms !== 'skipped' && (
              <DeliveryLine label="SMS" status={delivery.sms} />
            )}
            {delivery.errors && delivery.errors.length > 0 && (
              <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
                {delivery.errors.join('. ')}
              </p>
            )}
          </div>
          <div className="flex justify-end border-t border-ink-20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-teal-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-20 px-6 py-4">
          <h2 className="font-heading text-sm font-bold text-ink">New Message</h2>
          <button type="button" onClick={onClose} className="text-ink-60 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1.5 flex items-center gap-1">
              <User className="h-3 w-3" /> Client ID
              <span className="text-ink-40 font-normal">
                (needed for email notifications / SMS — In-app alone skips email)
              </span>
            </label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Paste client CUID…"
              className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink font-mono focus:border-brand-teal-500 focus:outline-none"
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1.5">Channel</label>
            <div className="flex gap-2">
              {channels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    channel === ch
                      ? 'border-brand-teal-500 bg-brand-teal-50 text-brand-teal-700'
                      : 'border-ink-20 text-ink-60 hover:bg-ink-08',
                  ].join(' ')}
                >
                  {CHANNEL_ICON[ch]}
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
            {channels.length < 3 && (
              <p className="mt-1.5 text-xs text-ink-60">
                Some channels are off in Settings → Messaging.
              </p>
            )}
            {!clientId.trim() && (
              <p className="mt-1.5 text-xs text-amber flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {channel === 'IN_APP'
                  ? 'Add a Client ID so we can email them that a message is waiting.'
                  : `A Client ID is required to deliver via ${CHANNEL_LABELS[channel]}.`}
              </p>
            )}
          </div>

          {/* Subject (email only) */}
          {channel === 'EMAIL' && (
            <div>
              <label className="block text-xs font-medium text-ink-60 mb-1.5">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject"
                className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink focus:border-brand-teal-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Type your message…"
              className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink focus:border-brand-teal-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink-20 px-4 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!body.trim() || isPending}
            onClick={() =>
              onSend({
                body: body.trim(),
                subject: channel === 'EMAIL' ? subject.trim() || undefined : undefined,
                channel,
                clientId: clientId.trim() || undefined,
              })
            }
            className="flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand-teal-600"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

type MessageRecordWithContext = MessageRecord & {
  client?: { id: string; firstName: string; lastName: string } | null;
  case?: { id: string; referenceNumber: string } | null;
};

function MessageRow({
  message,
  onMarkRead,
}: {
  message: MessageRecordWithContext;
  onMarkRead: () => void;
}) {
  const clientName =
    message.client ? `${message.client.firstName} ${message.client.lastName}` : null;

  return (
    <div
      className={`flex items-start gap-4 px-6 py-4 border-b border-ink-20 hover:bg-ink-08 transition-colors ${!message.isRead ? 'bg-brand-teal-50/40' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {message.subject && (
              <p className="truncate text-sm font-semibold text-ink">{message.subject}</p>
            )}
            <p
              className={`text-sm ${message.subject ? 'text-ink-60' : 'font-medium text-ink'} line-clamp-2`}
            >
              {message.body}
            </p>
            {clientName && (
              <p className="mt-0.5 text-xs text-ink-60">
                {message.direction === 'INBOUND' ? 'From' : 'To'}: {clientName}
                {message.case && (
                  <span className="ml-1.5 font-mono text-[10px] text-ink-40">
                    ({message.case.referenceNumber})
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-ink-60 whitespace-nowrap">
              {formatTime(message.createdAt)}
            </span>
            {!message.isRead && (
              <button
                type="button"
                onClick={onMarkRead}
                title="Mark as read"
                className="text-xs text-brand-teal-600 hover:underline"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              message.direction === 'INBOUND'
                ? 'bg-blue/10 text-blue'
                : message.direction === 'OUTBOUND'
                  ? 'bg-brand-teal-50 text-brand-teal-700'
                  : 'bg-ink-08 text-ink-60'
            }`}
          >
            {message.direction === 'INBOUND'
              ? '↙ Inbound'
              : message.direction === 'OUTBOUND'
                ? '↗ Outbound'
                : 'System'}
          </span>
          {message.isRead ? (
            <span className="flex items-center gap-1 text-[10px] text-ink-60">
              <CheckCheck className="h-3 w-3" /> Read
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-brand-teal-600">
              <Circle className="h-2.5 w-2.5 fill-current" /> Unread
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const hasMessages = usePlanFeature('messages');
  const [showCompose, setShowCompose] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeDelivery, setComposeDelivery] = useState<DeliveryResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: messagingSettings } = useMessagingSettings();
  const availableChannels = useMemo((): MessageChannel[] => {
    const messaging = messagingSettings?.data;
    const channels: MessageChannel[] = [];
    if (messaging?.inApp?.enabled !== false) channels.push('IN_APP');
    if (messaging?.email?.enabled !== false) channels.push('EMAIL');
    if (messaging?.sms?.enabled !== false) channels.push('SMS');
    return channels.length ? channels : ['IN_APP'];
  }, [messagingSettings?.data]);

  const { data, isLoading, isError, error, refetch } = useMessages(
    { ...LIST_QUERY, unreadOnly: filter === 'unread' },
    { enabled: hasMessages },
  );
  const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
  const { mutateAsync: markRead } = useMarkMessageRead();

  const messages = (data?.data ?? []) as MessageRecordWithContext[];
  const meta = data?.meta;
  const unreadCount = messages.filter((m) => !m.isRead).length;

  async function handleSend(input: {
    body: string;
    subject?: string;
    channel: MessageChannel;
    clientId?: string;
  }) {
    setComposeError(null);
    try {
      const result = await sendMessage({ ...input, sourceType: 'CASE_UPDATE' });
      const meta = (result as { meta?: { delivery?: DeliveryResult } }).meta?.delivery;
      if (meta) {
        setComposeDelivery(meta);
      } else {
        setShowCompose(false);
      }
    } catch (err) {
      setComposeError(formatApiError(err, { fallback: 'Could not send message. Please try again.' }));
    }
  }

  function handleCloseCompose() {
    setShowCompose(false);
    setComposeError(null);
    setComposeDelivery(null);
  }

  if (!hasMessages) {
    return (
      <>
        <div className="flex h-[52px] items-center border-b border-ink-20 bg-white px-7">
          <h1 className="font-heading text-[15px] font-bold text-ink">Messages</h1>
        </div>
        <PlanGate
          feature="messages"
          title="Messages are a Professional feature"
          description="Upgrade to send in-app, email, and SMS messages to clients from case threads."
        />
      </>
    );
  }

  return (
    <>
      {showCompose && (
        <ComposeModal
          onClose={handleCloseCompose}
          onSend={handleSend}
          isPending={isSending}
          error={composeError}
          delivery={composeDelivery}
          availableChannels={availableChannels}
        />
      )}

      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[15px] font-bold text-ink">Messages</h1>
          <p className="text-xs text-ink-60 hidden sm:block">In-app, email, and SMS</p>
          {meta && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {meta.total}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-teal-500 px-2 py-0.5 text-xs font-medium text-white">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-20 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === 'all' ? 'bg-brand-teal-500 text-white' : 'text-ink-60 hover:bg-ink-08'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === 'unread' ? 'bg-brand-teal-500 text-white' : 'text-ink-60 hover:bg-ink-08'}`}
            >
              Unread
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-teal-600"
          >
            <Send className="h-4 w-4" />
            New message
          </button>
        </div>
      </div>

      <div className="p-7">
        <div className="flex max-h-[min(640px,calc(100vh-160px))] min-h-[320px] flex-col overflow-hidden rounded-xl border border-ink-20 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-ink-60">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading messages…</span>
            </div>
          ) : isError ? (
            <ApiErrorState
              error={error}
              fallback="Failed to load messages. Please try again."
              onRetry={() => void refetch()}
            />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <MessageSquare className="h-10 w-10 text-ink-20" />
              <p className="text-sm font-medium text-ink-60">
                {filter === 'unread' ? 'No unread messages.' : 'No messages yet.'}
              </p>
              <button
                type="button"
                onClick={() => setShowCompose(true)}
                className="text-sm text-brand-teal-600 hover:underline"
              >
                Send your first message →
              </button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  onMarkRead={() => markRead(msg.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
