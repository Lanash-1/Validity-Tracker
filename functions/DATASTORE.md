# Catalyst Data Store schema

Create these tables in the Catalyst console (Data Store → Create Table) in both
Development and Production. Column names are lowercase snake_case. Every table
also has the system columns `ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME`.

Dates are stored as `text` in `YYYY-MM-DD` form so they compare correctly as
strings in ZCQL and never shift with time zones.

| Table | Column | Type | Notes |
|---|---|---|---|
| **users** | email | text (255) | unique, lowercase |
| | name | text (120) | |
| | avatar_url | text (1000) | nullable |
| | google_sub | text (64) | unique; Google account id |
| | timezone | text (64) | IANA zone, default `UTC` |
| | last_login_at | text (40) | ISO timestamp |
| **spaces** | name | text (60) | |
| | type | text (10) | `personal` / `shared` |
| | icon | text (8) | nullable |
| | owner_user_id | bigint | |
| | invite_code | text (8) | unique, nullable for personal |
| **space_members** | space_id | bigint | |
| | user_id | bigint | |
| | joined_at | text (40) | ISO timestamp |
| **categories** | space_id | bigint | NULL = built-in |
| | key | text (40) | stable key for built-ins |
| | name | text (40) | |
| | icon | text (8) | |
| | default_lead_days | int | |
| | sort_order | int | |
| **items** | space_id | bigint | |
| | name | text (120) | |
| | brand | text (80) | nullable |
| | category_id | bigint | nullable |
| | barcode | text (32) | nullable |
| | photo_file_id | text (40) | File Store file id, nullable |
| | photo_url | text (1000) | nullable |
| | quantity | double | nullable |
| | unit | text (16) | nullable |
| | location | text (60) | nullable |
| | expiry_type | text (16) | `fixed` / `period` / `after_opening` / `review` |
| | start_date | text (10) | nullable |
| | expiry_date | text (10) | nullable |
| | opened_at | text (10) | nullable |
| | pao_months | int | nullable |
| | review_date | text (10) | nullable |
| | effective_expiry | text (10) | computed by the API, nullable |
| | expiry_sort | text (10) | `effective_expiry` or `9999-12-31` |
| | reminder_lead_days | int | nullable |
| | notes | text (2000) | nullable |
| | status | text (10) | `active` / `consumed` / `archived` |
| | created_by | bigint | |
| | updated_by | bigint | |
| **reminder_log** | item_id | bigint | |
| | user_id | bigint | |
| | kind | text (10) | `lead` / `day_of` / `expired` |
| | scheduled_for | text (10) | |
| | sent_at | text (40) | |
| | channel | text (10) | |
| | dedupe_key | text (120) | unique: `item:user:kind:date` |
| **devices** | user_id | bigint | |
| | platform | text (10) | `android` / `web` / `extension` |
| | token | text (4000) | Expo token or Web Push subscription JSON |
| | token_key | text (128) | sha256 of token for upserts |
| | label | text (120) | nullable |
| | last_seen_at | text (40) | |
| **refresh_tokens** | user_id | bigint | |
| | token_hash | text (64) | sha256 hex |
| | expires_at | text (40) | ISO timestamp |
| | revoked_at | text (40) | nullable |
| | device_label | text (120) | nullable |
| | platform | text (10) | |
| **product_cache** | barcode | text (32) | unique |
| | name | text (200) | nullable |
| | brand | text (120) | nullable |
| | image_url | text (1000) | nullable |
| | quantity | text (40) | nullable |
| | source | text (40) | |
| | fetched_at | text (40) | |

After creating the tables, run `pnpm --filter api seed` (with the Catalyst
project credentials in `.catalystrc` / `CATALYST_*` env, see README) to insert
the built-in categories. The seed is idempotent.

Also create a File Store folder named `item-photos` and put its id in the
`PHOTO_FOLDER_ID` env variable of the `api` function.
