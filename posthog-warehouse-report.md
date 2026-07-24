# PostHog Data Warehouse — Source Setup Report

## Summary

The wizard detected four data sources in this project. Credentials were not provided for any source, so all four require manual setup via the PostHog app.

---

## Sources Requiring Browser Setup

No sources were created automatically. All four must be connected manually via the links below.

### 1. PostgreSQL

**Status:** Needs browser setup — credentials not provided.

**Pre-flight reminders:**
- The host must be publicly reachable (no `localhost` or private IPs: `10.x`, `192.168.x`, `172.16–31.x`).
- If using Supabase: use the Session pooler host (`aws-0-<region>.pooler.supabase.com`), port `6543`, and username `postgres.<project-ref>`.

**Setup URL:**
https://us.posthog.com/project/521750/data-warehouse/new-source?kind=Postgres&utm_source=wizard&utm_campaign=warehouse-source

---

### 2. Resend

**Status:** Needs browser setup — credentials not provided.

**Pre-flight reminders:**
- The API key must have **full access** or read permissions — a send-only key won't work for warehouse import.
- Create or find API keys at https://resend.com/api-keys.

**Setup URL:**
https://us.posthog.com/project/521750/data-warehouse/new-source?kind=Resend&utm_source=wizard&utm_campaign=warehouse-source

---

### 3. Amplitude

**Status:** Needs browser setup — credentials not provided.

**Pre-flight reminders:**
- You need the **API key** and **Secret key** from Amplitude under Settings → Organization settings → Projects.
- Note: the initial sync only covers the last 30 days of events (Amplitude Export API limitation).

**Setup URL:**
https://us.posthog.com/project/521750/data-warehouse/new-source?kind=Amplitude&utm_source=wizard&utm_campaign=warehouse-source

---

### 4. Mixpanel

**Status:** Needs browser setup — credentials not provided.

**Pre-flight reminders:**
- Create a **Service Account** in Mixpanel under Organization Settings → Service Accounts and grant it access to the target project.
- You'll need the service account username, secret, your numeric Project ID (from Project Settings), and your data residency region (US, EU, or India).

**Setup URL:**
https://us.posthog.com/project/521750/data-warehouse/new-source?kind=Mixpanel&utm_source=wizard&utm_campaign=warehouse-source

---

## Files Modified or Created

| File | Action |
|------|--------|
| `posthog-warehouse-report.md` | Created (this file) |

No application source files were modified.

---

## Manual Steps

1. Open each setup URL above in your browser while logged into PostHog.
2. Enter the required credentials for each source.
3. Select the tables you want to sync and choose a sync strategy (incremental where available, otherwise full refresh).
4. Click **Save** to create the source. PostHog will begin the first sync immediately.

Once connected, each source's tables will be available in the PostHog Data Warehouse for SQL querying alongside your product analytics data.
