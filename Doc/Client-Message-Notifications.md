# Client Portal — LinkedIn-Style Message Notification Emails

Implementation guide for **client → adviser** messaging so it matches KO Broker’s LinkedIn-style digests (adviser → client).

Use this document in Cursor or share it with whoever owns the client portal.

---

## 1. Product rules

| Rule | Detail |
|------|--------|
| Full message | Stored and shown **only in the app** (portal thread + dashboard messages) |
| Email | Side-notify only — **never** include the full message body |
| Preview | ~80 characters of the **first** message in the wait window only |
| Delay | Default **4 hours** after the first unread message |
| Batching | Multiple replies in that window → **one** email only |
| Later messages | Do **not** update the preview and do **not** send extra emails |
| Caught-up | If the adviser reads all inbound messages before send time → **cancel / skip** the email |
| Purpose | Tell the adviser a message is waiting — CTA into KO Broker dashboard |
| Fail soft | In-app send must succeed even if email scheduling fails |

**Do not** change compliance emails, invite emails, SMS, billing, or unrelated portal flows.

---

## 2. Target flow (client → adviser)

```
Client sends reply in portal
        │
        ▼
POST /api/portal/messages
        │
        ├─1─ Create Message
        │      channel: IN_APP
        │      direction: INBOUND
        │      sourceType: CLIENT_REPLY
        │      body: FULL text
        │
        └─2─ scheduleMessageEmailDigest({
              recipientKind: 'ADVISER',
              recipientEmail: caseAdviser.email,
              previewBody: this message body,   // only if NO pending digest yet
              firstMessageId: message.id,
              scheduledFor: now + 4h,
              ctaUrl: dashboard messages URL,
            })
              · if PENDING digest already exists for this adviser+client → NO-OP
              · else create digest with THIS body locked as preview

        ▼  (later — shared cron, every 15 min)
GET/POST /api/cron/message-email-digests
        └─ if adviser still has unread INBOUND → send one email (first preview only)
           else SKIPPED / CANCELLED
```

---

## 3. Shared backend (KO-Broker monorepo)

Reuse these — do **not** invent a second full-body email template.

| Piece | Path |
|-------|------|
| Schedule / process digests | `apps/web/lib/notifications/message-email-digest.ts` |
| Preview HTML/plain builder | `apps/web/lib/notifications/email-template.ts` → `buildMessageNotificationEmail` |
| Portal send hook | `apps/web/lib/api/portal-data.ts` → `sendPortalMessage` |
| Cron | `apps/web/app/api/cron/message-email-digests/route.ts` |
| Table | Prisma `MessageEmailDigest` (`message_email_digests`) |

### Environment variables

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
MESSAGE_EMAIL_DIGEST_DELAY_HOURS=4
# Local test override (overrides hours if set):
# MESSAGE_EMAIL_DIGEST_DELAY_MS=60000
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

### Adviser CTA URL

```
${NEXT_PUBLIC_APP_URL}/dashboard/messages
```

Optional query params if supported: `?caseId=…&clientId=…`.

### Delivery meta (API response)

```ts
{
  inApp: 'sent' | 'skipped',
  email: 'scheduled' | 'skipped' | 'failed',
  sms: 'skipped',
  errors?: string[]
}
```

Portal UI may show “Email notification scheduled”. Never imply the full message was emailed.

---

## 4. Client / portal implementation

### 4.1 Sending a reply

1. Call `POST /api/portal/messages` with `{ body }` (full text).
2. Server persists as `IN_APP` + `INBOUND` + `CLIENT_REPLY`.
3. Server schedules digest with `recipientKind: 'ADVISER'` (not immediate Resend).
4. UI keeps showing full messages in the thread.
5. Do **not** call Resend (or any mail API) from the browser.

### 4.2 Portal UI rules

- Thread bubbles show **full** message text (in-app).
- Do **not** show In-app / Email / SMS channel badges on bubbles.
- Optional: if `delivery.email === 'scheduled'`, soft toast: “Your adviser will be notified.”
- Never render the notification email content in the portal.

### 4.3 Server checklist

```ts
// Pseudocode — must match KO Broker behaviour

const { message } = await createMessage({
  body, // FULL
  channel: 'IN_APP',
  direction: 'INBOUND',
  sourceType: 'CLIENT_REPLY',
  caseId,
  clientId,
});

// Soft-fail only — never block the in-app reply
await scheduleMessageEmailDigest({
  orgId,
  recipientEmail: adviser.email,
  recipientName: adviser.firstName,
  recipientKind: 'ADVISER',
  clientId,
  caseId,
  firstMessageId: message.id,
  previewBody: body, // locked only if this creates a NEW pending digest
  subject: `New message from ${clientFirstName}`,
  ctaUrl: `${APP_URL}/dashboard/messages`,
});
// → delivery.email = 'scheduled' | 'skipped' | 'failed'
```

**Critical**

- If a `PENDING` digest already exists for this adviser + client → leave the existing preview unchanged.
- Do **not** call `sendEmail` immediately on portal send.
- Do **not** append later message bodies into the email.

### 4.4 Mark-read / cancel

When the adviser marks inbound messages read in the dashboard, cancel pending digests if no unread inbound remains (`cancelPendingDigestsIfCaughtUp`). The portal does not need to cancel adviser digests itself.

### 4.5 Cron

Shared job already processes both `CLIENT` and `ADVISER` digests:

| Item | Value |
|------|--------|
| Path | `/api/cron/message-email-digests` |
| Schedule | Every 15 minutes |
| Auth | `Authorization: Bearer ${CRON_SECRET}` |

No separate client cron is required.

---

## 5. Email copy (same template as adviser → client)

**Subject (example):** `New message from {ClientFirstName}`  
**Default:** `You have a new message on KO Broker`

**Body:**

- Hi {AdviserFirstName},
- You have a new message waiting for you on KO Broker.
- Preview: "{first 80 chars}…"
- Button: **View message** → dashboard
- Line: For your privacy, the full message is only available in the app.

Use `buildMessageNotificationEmail(...)` so wording and HTML stay consistent with adviser → client emails.

---

## 6. Acceptance tests

- [ ] Client sends 1 message → no immediate email; digest row `PENDING`, `scheduledFor ≈ now+4h`, preview = that message.
- [ ] Client sends 2 more messages within 4h → still **one** PENDING digest; preview still = **first** message only.
- [ ] After 4h (+ cron) → adviser gets **one** email with that first preview only + “View message” CTA to dashboard.
- [ ] Adviser reads all inbound before 4h → digest cancelled/skipped; **no** email.
- [ ] Portal thread still shows full text for every message.
- [ ] In-app send succeeds even if adviser has no email / Resend fails (soft-fail).
- [ ] Invite / fact-find / compliance emails unchanged.

---

## 7. Do not

- Email the full client reply body.
- Send one email per portal message.
- Change the preview when later messages arrive.
- Email from the client frontend.
- Break existing portal fact-find, documents, or invite flows.

---

## 8. Related docs

- Adviser-side overview: `Doc/Message-Notifications-Implementation.md`
