# Demo playground retention

The demo cookie contains an opaque secret; the database stores only its SHA-256 digest. A session's
`expires_at` is fixed at creation and Reset does not update it. Expired sessions are inaccessible;
creation and, off the response path, throttled ordinary HTML document traffic remove bounded batches
of expired `demo_session` rows without waiting on active edits. Maintenance failures are logged
without failing page loads. Reads hold a shared session lock through the response; edits and Reset
hold an exclusive lock so expiry and reset remain consistent. Cleanup removes reservations before
cascading tagged fictional users and wishlists, avoiding conflicting foreign-key cascades.
Per-session budgets in `src/lib/server/demo/constants.ts` bound edit and reset requests, including
failed ones. Curated images in `static/demo/` are shared static files and must not be deleted.

If traffic is absent for prolonged periods, an optional operator-managed scheduler may run this
bounded SQL against the application database with least-privilege credentials. Repeat until no rows
remain; do not run against an unreviewed migration or through development seeding:

```sql
BEGIN;
CREATE TEMP TABLE expired_demo_ids ON COMMIT DROP AS
  SELECT id FROM demo_session WHERE expires_at < now() ORDER BY expires_at LIMIT 5 FOR UPDATE SKIP LOCKED;
DELETE FROM reservation WHERE gift_id IN (
  SELECT g.id FROM gift g JOIN wishlist w ON g.wishlist_id = w.id
  WHERE w.demo_session_id IN (SELECT id FROM expired_demo_ids)
);
DELETE FROM demo_session WHERE id IN (SELECT id FROM expired_demo_ids);
COMMIT;
```

Deploy the additive migration before application code. Migration execution, scheduler configuration,
and production access require separate operator approval.
