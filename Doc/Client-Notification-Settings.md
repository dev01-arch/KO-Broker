# Client Portal — Personal Notification Settings

Implementation guide so **each KO Client** can control whether they receive message notification emails (LinkedIn-style digests), independently of the broker’s org Messaging toggles.

Use this in Cursor or share it with whoever owns the client portal.

**Related docs**

| Doc | Purpose |
|-----|---------|
| `Doc/Client-Message-Notifications.md` | How client → adviser digests are scheduled |
| `Doc/Message-Notifications-Implementation.md` | Adviser → client digests + org Settings → Messaging |

---

## 1. Product goal

| Actor | What they control today | What this adds |
|-------|-------------------------|----------------|
| Org admin (KO Broker) | Settings → Messaging: In-app / Email notifications / SMS (org-wide) | Unchanged |
| Client (portal) | — | **Personal** preference: “Email me when my adviser messages me” on/off |

**Precedence (AND logic)**

A notification email is sent only if **all** of these are true:

1. Org messaging email is **enabled** (`Organisation.settings.messaging.email.enabled`)
2. Client personal preference is **enabled** (default: on)
3. A pending digest is due and the recipient still has unread messages

If the client turns email off → cancel that client’s **CLIENT** pending digests.  
If the org turns email off → cancel **all** pending digests for that org (already implemented on broker).

Do **not** let the client disable in-app messages or SMS via this preference (SMS remains org/adviser channel control). In-app thread stay available whenever org In-app is on.

---

## 2. UX (portal)

### Suggested placement

Account / Profile / Settings in the client portal — a small “Notifications” section:

```
Notifications
─────────────
[toggle] Email notifications
         Get a delayed email when your adviser messages you.
         We only send a short preview — open the portal to read the full message.

Default: ON
```

Optional later (out of scope for v1):

- Quiet hours
- Digest frequency (keep fixed at 4h unless product says otherwise)

### Copy notes

- Do **not** promise “instant email”
- Mention preview-only + delay so expectations match LinkedIn-style behaviour
- Fail soft: saving preference must not break messaging

---

## 3. Data model

`Client` has no notification prefs today (`packages/db/prisma/schema.prisma` → `Client`).

**Recommended (v1):** add a JSON column on `Client` (flexible, matches org settings style):

```prisma
model Client {
  // ...existing fields...
  notificationPrefs Json?  // { emailMessages: boolean }
}
```

Normalise when reading:

```ts
type ClientNotificationPrefs = {
  emailMessages: boolean; // default true
};

function normalizeClientNotificationPrefs(raw: unknown): ClientNotificationPrefs {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    emailMessages: source.emailMessages !== false, // default ON
  };
}
```

**Alternative:** dedicated boolean `emailMessageNotifications Boolean @default(true)` — simpler, less extensible.

After schema change: push/migrate DB and regenerate Prisma client.

---

## 4. APIs (portal)

Auth: same portal session as other `/api/portal/*` routes. Client can only read/update **their own** prefs.

### GET `/api/portal/notification-settings`

Response:

```json
{
  "emailMessages": true,
  "orgEmailEnabled": true
}
```

| Field | Meaning |
|-------|---------|
| `emailMessages` | Client’s personal preference |
| `orgEmailEnabled` | Org Messaging → Email notifications (read-only for client) |

If `orgEmailEnabled` is false, UI should show the toggle disabled (or on but ineffective) with helper text: “Your broker has turned off email notifications.”

### PATCH `/api/portal/notification-settings`

Body:

```json
{ "emailMessages": false }
```

Behaviour:

1. Persist on `Client.notificationPrefs`
2. If `emailMessages === false` → cancel pending digests for this client as **CLIENT** recipient:

```ts
await cancelPendingMessageEmailDigestsForRecipient({
  orgId,
  recipientKind: 'CLIENT',
  recipientUserId: client.id, // or however digests key the client today
});
```

Check `message-email-digest.ts` for the exact cancel helper and recipient keys used when scheduling adviser → client digests.

3. Return updated prefs

Do **not** expose org admin Messaging PATCH from the portal.

---

## 5. Wire into digest scheduling (adviser → client)

In `apps/web/lib/api/messages-data.ts` (and any other path that schedules digests to clients), **before** `scheduleMessageEmailDigest`:

```
IF !org.messaging.email.enabled → do not schedule
IF !client.notificationPrefs.emailMessages → do not schedule
ELSE schedule as today
```

Also enforce at send time in `processDueMessageEmailDigests` (defence in depth):

```
IF client opted out → mark digest CANCELLED / SKIPPED, do not send
```

Client → adviser digests are **not** controlled by this preference (those notify the adviser). Adviser notification prefs are out of scope here.

---

## 6. Relationship to org Settings → Messaging

| Setting | Who | Effect |
|---------|-----|--------|
| Org In-app | Admin | Channels available for send |
| Org Email notifications | Admin | Master switch for digests |
| Org SMS | Admin | SMS channel |
| Client `emailMessages` | Client | Personal opt-out of digests addressed to them |

Broker UI for org toggles lives in:

- `apps/web/components/dashboard/integrations-settings-panel.tsx` (Messaging section)
- `GET/PATCH /api/settings/messaging`
- `getOrgMessagingSettings` / `updateOrgMessagingSettings` in `settings-data.ts`

Portal must **not** reuse those admin-only routes for client prefs.

---

## 7. Implementation checklist

**Backend (this repo, `KO-Broker` / `apps/web`) — already done:**

1. [x] `notificationPrefs` JSON column on `Client` (`packages/db/prisma/schema.prisma`)
2. [x] `GET` + `PATCH` `/api/portal/notification-settings` (`apps/web/app/api/portal/notification-settings/route.ts`, `apps/web/lib/api/client-notification-prefs.ts`)
3. [ ] **Portal Settings UI with Email notifications toggle + copy above — NOT in this repo.** The client portal frontend is a separate app (served from `NEXT_PUBLIC_CLIENT_PORTAL_URL`, e.g. `ko-client-client.vercel.app` / `localhost:3002`), so this is the only remaining piece and must be built in that codebase. See §11 for the exact contract it must satisfy.
4. [x] On opt-out: cancel pending `CLIENT` digests for that client (`updatePortalNotificationSettings` → `cancelPendingMessageEmailDigestsForRecipient`)
5. [x] Gate `scheduleMessageEmailDigest` for adviser → client on prefs + org email (`messages-data.ts` → `clientAllowsMessageEmails`)
6. [x] Re-checked again at send time in `processDueMessageEmailDigests` (defence in depth)
7. [x] Default ON for existing clients (missing JSON → enabled)
8. [x] Compliance / invite / SMS / billing emails unchanged (unsubscribe link + header color only apply where wired below)

---

## 8. Acceptance criteria

- [ ] Client can turn **Email notifications** off in the portal; setting persists across sessions
- [ ] With preference off, new adviser messages **do not** schedule digests for that client
- [ ] Pending digests for that client are cancelled when they turn email off
- [ ] With preference on + org email on, digests behave as in `Client-Message-Notifications.md` / existing adviser → client flow
- [ ] If org email is off, client cannot cause emails by toggling their preference on
- [ ] In-app messages still work when email is off
- [ ] Non-message emails (invites, compliance, etc.) unchanged

---

## 9. Paste-ready Cursor prompt

```
Implement personal notification settings for the KO Client portal.

Goal:
- Each client can opt in/out of LinkedIn-style message notification emails.
- Default: ON.
- Org Settings → Messaging email remains the master switch (AND logic).
- Do not break in-app messaging, SMS, digests for advisers, or unrelated emails.

Data:
- Add Client.notificationPrefs Json? with { emailMessages: boolean }, default true when missing.
- Or Client.emailMessageNotifications Boolean @default(true).

APIs (portal-auth only, own client only):
- GET /api/portal/notification-settings → { emailMessages, orgEmailEnabled }
- PATCH /api/portal/notification-settings → { emailMessages }
  When false: cancel pending MessageEmailDigest rows for this client as recipientKind CLIENT.

Backend:
- Before scheduleMessageEmailDigest for adviser → client, require org messaging.email.enabled AND client emailMessages preference.
- Optionally re-check at processDueMessageEmailDigests before send.

UI:
- Portal Settings / Notifications: toggle “Email notifications” with copy explaining delayed preview-only emails.
- If orgEmailEnabled is false, show that the broker has disabled email notifications.

Docs for context:
- Doc/Client-Notification-Settings.md
- Doc/Client-Message-Notifications.md
- Doc/Message-Notifications-Implementation.md
- apps/web/lib/notifications/message-email-digest.ts
- apps/web/lib/api/settings-data.ts (org messaging only — do not reuse for client prefs)
```

---

## 10. Out of scope (v1)

- Per-case notification prefs  
- SMS opt-out for clients  
- Changing the 4-hour digest delay from the portal  
- Adviser personal email preferences (separate product decision)  
- Push / browser notifications  

---

## 11. Email template contract (already live in the backend)

Two changes shipped in `apps/web/lib/notifications/email-template.ts` / `email.ts` / `message-email-digest.ts`. Both apply automatically to **every** recipient (adviser and client) because they're in the single shared `renderBaseTemplate` used by all outbound emails — no portal-side change needed for these two items.

1. **Header color** — the branded header background moved from the heavy `#0F6E56` to the lighter `#1D9E75` (the accent already used across the Messages UI). Purely visual, no link/URL involved.
2. **"Unsubscribe" footer link** — only rendered on LinkedIn-style message-digest emails (`buildMessageNotificationEmail`, sent via `processDueMessageEmailDigests`). It is **not** added to compliance/welcome/ESIS/suitability/invite/billing emails (per §7 item 8 / the "do not change" rule in the other docs).

The backend computes the link target per recipient in `unsubscribeUrlFor()` (`apps/web/lib/notifications/message-email-digest.ts`):

| Recipient kind | Unsubscribe link target |
|---|---|
| `ADVISER` | `${NEXT_PUBLIC_APP_URL}/dashboard/settings?section=messaging` (already built, this repo) |
| `CLIENT` | `${NEXT_PUBLIC_CLIENT_PORTAL_URL}/settings?section=notifications` |

**Action required in the portal repo:** serve a page at `/settings?section=notifications` (or tell us the real route so `unsubscribeUrlFor()` can be updated to match) that:

- Reads the current preference via `GET /api/portal/notification-settings` → `{ emailMessages, orgEmailEnabled }`
- Toggles it via `PATCH /api/portal/notification-settings` → `{ emailMessages: boolean }`
- Works for a signed-out/expired portal session too — a client clicking "Unsubscribe" from an old email should either land on this page after re-auth, or the page should itself trigger the portal's normal sign-in flow before showing the toggle (do not silently 404).

Nothing else in this doc needs to change for the color/unsubscribe work — it's a UI page + link-target confirmation, not new backend logic.
