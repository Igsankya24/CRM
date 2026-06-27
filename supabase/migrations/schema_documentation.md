# CRM with AI Integration — Database Schema Documentation

Merged database schema documentation (consolidation of all schema features). All database operations are account-scoped under `accounts` tenancy with role-based row-level security (RLS) policies.

---

## Master Schema File
The single source of truth for the entire database is located at:
- **Database Schema**: [schema.sql](file:///e:/CRM/CRM/supabase/migrations/schema.sql)

---

## Tables

### `profiles`
Auto-created on user signup via database trigger. Maps user metadata to their active account and RBAC role.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Profile ID |
| `user_id` | UUID | FK → auth.users, UNIQUE | Auth user reference |
| `full_name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | NOT NULL | Email address |
| `avatar_url` | TEXT | | Profile picture URL |
| `role` | TEXT | DEFAULT 'user' | Legacy role column (deprecated) |
| `beta_features` | TEXT[] | DEFAULT [] | Opt-in beta features keys |
| `account_id` | UUID | FK → accounts | Active account tenancy ID |
| `account_role` | account_role_enum | | Role inside the account |
| `mobile` | TEXT | | Mobile number |
| `department` | TEXT | | Department name |
| `designation` | TEXT | | Designation name |
| `is_active` | BOOLEAN | DEFAULT true | Account status indicator |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Auto-updated by trigger |

**RLS**: Users can view, update, or insert their own profile row.

---

### `accounts`
Multi-user workspace accounts representing tenants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Account ID |
| `name` | TEXT | NOT NULL | Account/workspace name |
| `owner_user_id` | UUID | FK → auth.users, RESTRICT | Account owner reference |
| `default_currency` | TEXT | DEFAULT 'USD' | Preferred base currency |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `account_members`
A helper junction view representing active profiles belonging to an account.

---

### `account_invitations`
Pending workspace invitations sent by administrators.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Invitation ID |
| `account_id` | UUID | FK → accounts | Target account |
| `role` | account_role_enum | | Role offered |
| `token_hash` | TEXT | UNIQUE | SHA-256 hash of plaintext token |
| `label` | TEXT | | Human-readable description |
| `created_by_user_id` | UUID | | |
| `expires_at` | TIMESTAMPTZ | | |
| `accepted_at` | TIMESTAMPTZ | | |
| `accepted_by_user_id` | UUID | | |

---

### `contacts`
Customer profiles mapped to WhatsApp numbers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Contact ID |
| `user_id` | UUID | FK → auth.users | Attribution user reference |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `phone` | TEXT | NOT NULL | Customer phone number |
| `phone_normalized` | TEXT | GENERATED, UNIQUE | Digits-only unique E.164 string |
| `name` | TEXT | | Customer display name |
| `email` | TEXT | | Email address |
| `company` | TEXT | | Company name |
| `avatar_url` | TEXT | | Profile avatar URL |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `tags`
Categorization labels for contacts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Tag ID |
| `user_id` | UUID | FK → auth.users | Author |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `name` | TEXT | NOT NULL | Label |
| `color` | TEXT | DEFAULT '#3b82f6' | Hex color code |
| `created_at` | TIMESTAMPTZ | | |

---

### `contact_tags`
Many-to-many junction table mapping tags to contacts.

---

### `conversations`
WhatsApp chat threads, supporting human agency and AI-agent modes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Conversation ID |
| `user_id` | UUID | FK → auth.users | Author |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `contact_id` | UUID | FK → contacts | Contact reference |
| `status` | TEXT | open / pending / closed | State indicator |
| `assigned_agent_id` | UUID | | Assigned agent ID |
| `last_message_text` | TEXT | | Last message preview |
| `last_message_at` | TIMESTAMPTZ | | Timestamp |
| `unread_count` | INTEGER | DEFAULT 0 | Unread message count |
| `ai_mode` | BOOLEAN | DEFAULT false | Toggle for AI auto-reply agency |
| `ai_model` | TEXT | | Custom OpenRouter model override |
| `ai_system_prompt` | TEXT | | Custom agent system prompt |
| `ai_handoff_reason` | TEXT | | Reason for human agent takeover |
| `ai_handed_off_at` | TIMESTAMPTZ | | Time of human handoff |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `messages`
Individual WhatsApp messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Message ID |
| `conversation_id` | UUID | FK → conversations | Parent thread reference |
| `sender_type` | TEXT | customer / agent / bot | Sender entity classification |
| `sender_id` | UUID | | Author user ID |
| `content_type` | TEXT | text/image/document/etc. | Media type |
| `content_text` | TEXT | | Message body |
| `media_url` | TEXT | | Media attachment URL |
| `template_name` | TEXT | | Template key if template message |
| `message_id` | TEXT | | Meta-assigned WhatsApp ID |
| `status` | TEXT | sending/sent/delivered/etc. | Webhook status indicator |
| `reply_to_message_id` | UUID | | swipe-reply parent reference |
| `interactive_reply_id` | TEXT | | ID of tapped button/list item |
| `created_at` | TIMESTAMPTZ | | |

---

### `crm_leads`
The core CRM leads tracking table, capturing pipeline status, scoring, and assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Lead ID |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `b2b_lead_id` | UUID | FK → b2b_leads | Source marketplace lead reference |
| `contact_id` | UUID | FK → contacts | Customer contact reference |
| `conversation_id` | UUID | FK → conversations | WhatsApp chat thread reference |
| `buyer_name` | TEXT | | Buyer full name |
| `company_name` | TEXT | | Company name |
| `phone` | TEXT | | Phone number |
| `email` | TEXT | | Email address |
| `city` | TEXT | | City |
| `state` | TEXT | | State |
| `country` | TEXT | | Country |
| `source` | TEXT | Check constraint | INDIAMART / WEBSITE / MANUAL / etc. |
| `stage` | TEXT | Check constraint | NEW_LEAD / QUALIFIED / CLOSED / etc. |
| `lead_category` | TEXT | HOT / WARM / COLD / LOST | Lead warmth classification |
| `lead_score` | INTEGER | DEFAULT 0 | Algorithmic lead score |
| `is_spam` | BOOLEAN | DEFAULT false | Spam filter flag |
| `urgency` | TEXT | LOW / MEDIUM / HIGH / CRITICAL | Action priority level |
| `assigned_to` | UUID | FK → profiles | Assigned salesperson profile ID |
| `assigned_at` | TIMESTAMPTZ | | Date/time of assignment |
| `ai_summary` | TEXT | | Automated summary generated by AI |
| `ai_engagement_status`| TEXT | NOT_STARTED / IN_PROGRESS / etc.| AI workflow status tracking |
| `ai_score` | TEXT | HOT / WARM / COLD / SPAM | AI-assigned score |
| `ai_score_reasons` | JSONB | DEFAULT '[]' | AI score reasoning factors |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `company_settings`
Company business profiles and policies feeding the AI knowledge base.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Settings ID |
| `account_id` | UUID | FK → accounts, UNIQUE | Tenancy key |
| `company_name` | TEXT | | Business name |
| `company_description`| TEXT | | Description of services |
| `address` | TEXT | | Office address |
| `email` | TEXT | | Main contact email |
| `phone` | TEXT | | Main contact phone |
| `website` | TEXT | | Website URL |
| `logo_url` | TEXT | | Logo image URL |
| `catalog_pdf_url` | TEXT | | Catalog document link |
| `terms_and_conditions`| TEXT | | Policy text |
| `shipping_policy` | TEXT | | Policy text |
| `return_policy` | TEXT | | Policy text |
| `payment_terms` | TEXT | | Policy text |
| `social_media` | JSONB | DEFAULT '{}' | Linked social handles |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `company_products`
Product catalog metadata feeding AI recommendations and requirements matching.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Product ID |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `product_name` | TEXT | NOT NULL | Product name |
| `category` | TEXT | | Category grouping |
| `description` | TEXT | | Product description |
| `specification` | TEXT | | Detailed tech specs |
| `price` | NUMERIC | | Standard product price |
| `moq` | INTEGER | DEFAULT 1 | Minimum Order Quantity |
| `unit` | TEXT | DEFAULT 'pcs' | Selling unit |
| `image_url` | TEXT | | Product image link |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | | |

---

### `company_faq`
Frequently asked questions database utilized by the AI agent to clarify customer queries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | FAQ ID |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `question` | TEXT | NOT NULL | Customer query |
| `answer` | TEXT | NOT NULL | Resolution text |
| `category` | TEXT | | Group tag |
| `priority` | INTEGER | DEFAULT 0 | Ordering priority |
| `is_active` | BOOLEAN | DEFAULT true | Active status |

---

### `ai_conversation_memory`
Structured contextual memory captured during AI-customer WhatsApp interactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Memory ID |
| `account_id` | UUID | FK → accounts | Tenancy key |
| `conversation_id` | UUID | FK → conversations, UNIQUE | WhatsApp thread link |
| `summary` | TEXT | | Running conversation summary |
| `customer_interest` | TEXT | | Product interest indicators |
| `budget` | TEXT | | Customer budget details |
| `product` | TEXT | | Identified product of interest |
| `quantity` | TEXT | | Desired quantity |
| `urgency` | TEXT | | Perceived purchase urgency |
| `location` | TEXT | | Shipping location |
| `need_date` | TEXT | | Delivery date requirements |
| `stage` | TEXT | Check constraint | greeting / clarifying / serious_buyer / etc.|
| `message_count` | INTEGER | DEFAULT 0 | Count of all messages |
| `customer_message_count`| INTEGER | DEFAULT 0 | Count of customer messages |
| `ai_message_count` | INTEGER | DEFAULT 0 | Count of bot messages |
| `extracted_facts` | JSONB | DEFAULT '{}' | Free-form facts extracted by AI |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `automations`
No-code event-trigger automations.

---

### `flows` & `flow_runs`
Visual interactive chatbot flow logic and executions.

---

## Triggers

- `on_auth_user_created`: Invokes `public.handle_new_user()` when a new user signs up.
- `set_updated_at`: Invokes `update_updated_at_column()` on UPDATE.

---

## Row Level Security (RLS) Policy
Tenancy protection is enforced across all tables:
- **Standard Account Security**: Read access checks membership using `is_account_member(account_id)`.
- **Write Checks**: Creation and updates verify minimal privileges (`is_account_member(account_id, 'agent')` or `'admin'`).
