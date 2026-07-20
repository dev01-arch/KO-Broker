# Message notifications — implementation (adviser → client)

This documents how **in-app** + **LinkedIn-style email** notifications work today on the adviser/dashboard side, so the same pattern can be mirrored for **client → adviser** (portal).

---

## Product rules

| Rule | Detail |
|------|--------|
| Full message | Stored only in the DB / shown in the app UI |
| Email | Notification only — short preview (~80 chars), never the full body |
| Timing | LinkedIn-style: wait **4 hours** (configurable), then send **one** email |
| Preview lock | Only the **first** message in the wait window is previewed; later messages do not change the email |
| Caught-up | If recipient reads all messages before send time, the digest is cancelled/skipped |
| Purpose of email | “You have a message waiting — open the app” |
| CTA | Button/link into the correct inbox (portal for clients, dashboard for advisers) |
| Channel tags | Do **not** show In-app / Email / SMS badges on message list rows |

---

## Flow (adviser → client)

```
Adviser sends message (UI / API)
        │
        ▼
POST /api/messages  →  sendMessageForOrg()
        │
        ├─1─ Create Message row (full body)     ← IN_APP / EMAIL record
        │
        └─2─ scheduleMessageEmailDigest()
              · if PENDING digest already exists for recipient → no-op (keep first preview)
              · else create digest scheduledFor = now + 4h
        │
        ▼  (later, cron every 15 min)
POST/GET /api/cron/message-email-digests
        └─ processDueMessageEmailDigests()
              · skip if no unread remain
              · else sendEmail(first preview only)
```

### When email is sent

| Channel chosen | In-app row | Notification email |
|----------------|------------|--------------------|
| `IN_APP` | Yes | Scheduled digest (4h); first message preview only |
| `EMAIL` | Yes (channel=`EMAIL`) | Same delayed digest behaviour |
| `SMS` | Yes (channel=`SMS`) | No (SMS body is separate) |

Delivery `meta.email` values: `scheduled` | `skipped` | `failed` (actual send happens later via cron).

---

## Key files (already implemented)

| File | Role |
|------|------|
| `apps/web/lib/api/messages-data.ts` | `createMessageForOrg`, `sendMessageForOrg`, schedules digests |
| `apps/web/lib/notifications/message-email-digest.ts` | `scheduleMessageEmailDigest`, `processDueMessageEmailDigests` |
| `apps/web/lib/notifications/email-template.ts` | `buildMessageNotificationEmail`, `truncateMessagePreview` |
| `apps/web/app/api/cron/message-email-digests/route.ts` | Cron runner (every 15 min on Vercel) |
| `apps/web/lib/notifications/email.ts` | `sendEmail` (Resend) |
| `apps/web/app/api/messages/route.ts` | `POST` → `sendMessageForOrg` |

### Env

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
MESSAGE_EMAIL_DIGEST_DELAY_HOURS=4
# or MESSAGE_EMAIL_DIGEST_DELAY_MS=60000 for local testing
CRON_SECRET=
NEXT_PUBLIC_CLIENT_PORTAL_URL=
NEXT_PUBLIC_APP_URL=
```

---

## Core helpers (reuse these)

### 1. Preview + email payload

```ts
// apps/web/lib/notifications/email-template.ts

buildMessageNotificationEmail({
  recipientFirstName: 'Jane',
  messageBody: fullMessageBody,   // used only to build ~80 char preview
  subject?: string,               // optional; default: "You have a new message on KO Broker"
  ctaUrl: 'https://portal.../',   // where they read the full message
})
// → { subject, body /* plain text */, html }
```

Rules inside the helper:

- Truncate body to **80 characters** (`truncateMessagePreview`)
- Escape HTML in greeting/preview/URL
- Copy: waiting on KO Broker + italic preview + **View message** button
- Explicit line: full message only available in the app

### 2. Delivery wrapper

```ts
// apps/web/lib/api/messages-data.ts  (private helper)

await deliverMessageNotificationEmail({
  settings,           // from getOrgMessagingSettings(orgId)
  client,             // { id, email, firstName, ... } or null
  body: input.body,
  subject: input.subject,
  delivery,           // mutates delivery.email = sent | skipped | failed
  requireRecipient,   // true for EMAIL channel; false for IN_APP side-notify
});
```

### 3. Persist full message

```ts
await createMessageForOrg(orgId, {
  body,                 // FULL text
  channel: 'IN_APP',    // primary channel for reading in UI
  direction: 'OUTBOUND' | 'INBOUND',
  sourceType: 'CASE_UPDATE' | 'CLIENT_REPLY' | ...,
  caseId?,
  clientId?,
  subject?,
});
```

---

## API contract (adviser)

**Request** `POST /api/messages`

```json
{
  "body": "Full message text stored in DB",
  "channel": "IN_APP",
  "sourceType": "CASE_UPDATE",
  "clientId": "clxxxx",
  "caseId": "optional",
  "subject": "optional — becomes email subject if provided"
}
```

**Response** `201` — `data` is the primary `Message` row; `meta.delivery`:

```json
{
  "inApp": "sent",
  "email": "sent",
  "sms": "skipped",
  "errors": []
}
```

Frontend should surface `meta.delivery` after send so failures (missing email, Resend down) are visible.

---

## Client-side mirror (client → adviser) — TODO for you

Today `sendPortalMessage` in `apps/web/lib/api/portal-data.ts` **only** creates an IN_APP inbound message. It does **not** email the adviser.

### Target behaviour (same product rules)

1. Client submits reply in portal → `POST /api/portal/messages`
2. Create `Message` with:
   - `channel: 'IN_APP'`
   - `direction: 'INBOUND'`
   - `sourceType: 'CLIENT_REPLY'`
   - full `body`
3. Side-notify adviser by email using **the same** `buildMessageNotificationEmail`:
   - Recipient = case adviser (or org admin fallback)
   - `ctaUrl` = `${NEXT_PUBLIC_APP_URL}/dashboard/messages` (or deep-link with `caseId` / `clientId` if you add query support)
   - Preview only — never full body in email
4. Return delivery meta if useful: `{ inApp: 'sent', email: 'sent' | 'failed' | 'skipped' }`

### Suggested change in `sendPortalMessage`

```ts
// Pseudocode — mirror of adviser path

const { message } = await createMessageForOrg(session.orgId, {
  body,
  channel: 'IN_APP',
  direction: 'INBOUND',
  sourceType: 'CLIENT_REPLY',
  caseId: session.caseId,
  clientId: session.clientId,
});

const adviser = await resolveCaseAdviser(session); // email, firstName
const settings = await getOrgMessagingSettings(session.orgId);

const delivery = { inApp: 'sent', email: 'skipped', sms: 'skipped', errors: [] };

if (adviser?.email && settings.email?.enabled !== false) {
  const notification = buildMessageNotificationEmail({
    recipientFirstName: adviser.firstName,
    messageBody: body,
    subject: `New message from ${clientFirstName}`,
    ctaUrl: `${appUrl}/dashboard/messages`,
  });
  const result = await sendEmail({
    to: adviser.email,
    subject: notification.subject,
    body: notification.body,
    html: notification.html,
  });
  delivery.email = result.ok ? 'sent' : 'failed';
}

return { ...message fields, delivery };
```

### Portal UI notes

- List messages from `GET /api/portal/messages` (already returns full `body` for in-app thread)
- No channel tags on bubbles/rows
- Email is never rendered in the portal — only the in-app thread shows full text
- Optional: show a small “Email notified” toast only from `delivery.email`, not as a message tag

### Adviser resolution

Reuse existing helper patterns in `portal-data.ts` (`resolvePortalAdviser` / case `adviser` include). Prefer:

1. Case assigned adviser email  
2. Else inviting user / org admin  
3. If none → `delivery.email = 'skipped'` (do not fail the in-app send)

---

## Checklist for client-side parity

- [ ] Persist full body as `IN_APP` + `INBOUND` + `CLIENT_REPLY`
- [ ] Call `buildMessageNotificationEmail` (do not invent a second full-body template)
- [ ] CTA points at **dashboard** messages for advisers
- [ ] Respect org messaging settings (`email.enabled`)
- [ ] Soft-fail email without blocking in-app success
- [ ] No full message in subject, HTML, or plaintext email
- [ ] No In-app/Email channel badges on portal message UI
- [ ] Smoke test: send from portal → adviser gets preview email → opens dashboard → sees full body

---

## Out of scope (do not change when mirroring)

- Compliance / stage emails (`sendWelcomeNotification`, fact-find, ESIS, etc.)
- Welcome / invite emails
- SMS content (still full short SMS when SMS channel is used)
- Billing / Stripe emails
`}