# Mail Flow & Lead Hunter : Enterprise B2B Outreach Ecosystem

<div align="center">

<img width="1919" height="361" alt="Mail Flow Platform Hero" src="https://github.com/user-attachments/assets/0fee1faa-7c70-4d1f-bc22-b8593a140974" />
<img width="2158" height="445" alt="Mail Flow Dashboard Overview" src="https://github.com/user-attachments/assets/4c115ce2-e607-41e6-aefd-b76ac5993638" />

<p align="center">
  <strong>The Complete Enterprise Outbound Suite: Multi-Tenant Bulk Email Orchestration & Real-Time B2B Client Hunter</strong>
</p>

[![Django](https://img.shields.io/badge/Backend-Django%205.1%20%7C%20DRF-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%205-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Redis-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Celery](https://img.shields.io/badge/Workers-Celery%20%7C%20Redis-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Chrome Extension](https://img.shields.io/badge/Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📑 Table of Contents

- [1. Ecosystem Architecture Overview](#1-ecosystem-architecture-overview)
- [2. System 1 : Mail Flow (Core SaaS Platform)](#2-system-1--mail-flow-core-saas-platform)
  - [Core Campaign Engine](#core-campaign-engine)
  - [Multi-Tenant Quotas & 5-Tier RBAC](#multi-tenant-quotas--5-tier-rbac)
  - [On-Chain Multi-Network USDT Billing](#on-chain-multi-network-usdt-billing)
  - [Click & Unsubscribe Tracking](#click--unsubscribe-tracking)
  - [Mail Workspace & Support Ticket Desk](#mail-workspace--support-ticket-desk)
- [3. System 2 : Mail Flow Lead Hunter (Companion Suite)](#3-system-2--mail-flow-lead-hunter-companion-suite)
  - [Multi-Channel Scraper Engines](#multi-channel-scraper-engines)
  - [1-Click Real-Time Push Pipeline](#1-click-real-time-push-pipeline)
  - [Licensing, Quotas & 2-Device Policy](#licensing-quotas--2-device-policy)
  - [Extension Installation (Developer Mode & Web Store)](#extension-installation-developer-mode--web-store)
- [4. Visual Design System & Component Hierarchy](#4-visual-design-system--component-hierarchy)
- [5. Complete API Reference](#5-complete-api-reference)
- [6. Security & Cryptographic Invariants](#6-security--cryptographic-invariants)
- [7. Verification, Testing & Build Commands](#7-verification-testing--build-commands)
- [8. Deployment & Environment Setup](#8-deployment--environment-setup)
- [9. Responsible Use & License](#9-responsible-use--license)

---

## 1. Ecosystem Architecture Overview

The Mail Flow ecosystem connects high-intent B2B prospect extraction with automated cold email dispatch through an asynchronous, event-driven pipeline:

```
[ B2B PROSPECTS & SOURCES ]
  ├── Google Maps B2B Local Businesses (Phone, Address, Ratings, Web)
  ├── Facebook Community Groups & Public Business Pages
  ├── Instagram Business Profiles (Bio Emails, Follower Counts, Tags)
  └── Fiverr High-Budget Gig Buyers & Client Feedback
         │
         ▼
[ MAIL FLOW LEAD HUNTER (Chrome Extension MV3) ]
  ├── Client-Side DOM Scraper & Regex Extraction Engines
  ├── Real-Time Local Deduplication & Clean RFC 4180 CSV Export
  └── Cryptographic Hardware Binding (HMAC-SHA256 / 2-Device Policy)
         │
         ▼  (1-Click HTTP Push with Secret Header & HMAC Signature)
[ PHP CENTRAL LICENSING & RELAY SERVER (mail.annomous.com) ]
  ├── License Validation, Token Issuance & 6-Digit OTP Device Transfer
  └── Webhook Dispatch via callDjangoMailFlowApi()
         │
         ▼
[ MAIL FLOW CORE DJANGO BACKEND (mailflow.annomous.com) ]
  ├── Multi-Tenant Organization Isolation & Automatic List Mapping
  ├── Fernet-Encrypted SMTP Accounts & Round-Robin Rotation
  ├── Celery Asynchronous Dispatch Queues & Redis Rate Throttles
  └── On-Chain USDT Payment Verification (BSC, ETH, TRON, TON)
         │
         ▼
[ MAIL FLOW OPERATIONS CONSOLE (mail-flow.annomous.com) ]
  ├── React 18 + Vite 5 + Tailwind CSS v4 Dashboard
  ├── Drag-and-Drop HTML Email Builder & Personalization
  ├── Live Campaign Real-Time Polling & Click Analytics
  └── Dedicated Public /lead-hunter Interactive Showcase
```

---

## 2. System 1 : Mail Flow (Core SaaS Platform)

### Core Campaign Engine
- **Template Builder**: Visual HTML email editor and JSON layout storage with live mobile/desktop previews.
- **Merge Personalization**: Dynamic `{{name}}`, `{{email}}`, `{{company}}`, and custom recipient attributes.
- **Persistent Dispatch Logs**: Per-recipient status tracking (`Queued`, `Dispatched`, `Delivered`, `Failed`, `Bounced`, `Unsubscribed`).
- **Smart Queue Throttling**: Batch size controls, inter-email delay randomization, and auto-retry backoff.

### Multi-Tenant Quotas & 5-Tier RBAC
- **Strict Tenant Isolation**: All records bound to `organization_id` with `PROTECT`-level database foreign keys.
- **5-Tier Role Matrix**:
  - `->` **Owner**: Global platform administration, payment reviews, user and organization oversight.
  - `->` **Admin**: Organization configuration, SMTP connection management, team seats, billing renewals.
  - `->` **Manager**: Campaign creation, list management, file imports, broadcast execution.
  - `->` **Operator**: Campaign launching, template adjustments, log viewing.
  - `->` **Viewer**: Read-only access to campaign summaries and report dashboards.

### On-Chain Multi-Network USDT Billing
- **Direct Crypto Settlement**: Native on-chain verification across **BSC (BEP-20)**, **Ethereum (ERC-20)**, **Tron (TRC-20)**, and **TON**.
- **Deterministic Micro-Pricing**: Generates unique 6-decimal amounts (e.g. `29.004128 USDT`) with 72-hour expiration for automated zero-mismatch reconciliation.
- **Public Checkout Session**: 6-digit email OTP verification, Cloudflare Turnstile bot protection, and instant account onboarding.

### Click & Unsubscribe Tracking
- **Cryptographic Tracking**: Fernet-encrypted tracking tokens per recipient with SHA-256 salted IP anonymization.
- **RFC 8058 Compliance**: Automatic `List-Unsubscribe` and `List-Unsubscribe-Post` one-click header injection.

### Mail Workspace & Support Ticket Desk
- **IMAP / SMTP Sync**: Encrypted credentials for mailbox synchronization and unified team ticket threads.
- **Inbound Ticketing**: Auto-generates support tickets from customer replies with priority tagging.

---

## 3. System 2 : Mail Flow Lead Hunter (Companion Suite)

Mail Flow Lead Hunter is the enterprise B2B lead generation companion tool designed to feed verified prospect lists straight into Mail Flow campaigns with zero CSV friction.

<div align="center">
  <img width="900" alt="Lead Hunter Live Extraction Engine" src="https://mail.annomous.com/lead-hunter/logo.png" />
</div>

### Multi-Channel Scraper Engines

| Scraper Channel | Target Prospects | Extracted Data Fields | Extraction Speed |
|:---|:---|:---|:---|
| **Google Maps B2B** | Local business owners, dentists, contractors, lawyers | Business name, verified phone, website, physical address, Google rating, review counts, map coordinates | ~50 leads / 10s |
| **Facebook Pages & Groups** | Group members, niche community founders, e-com stores | Page email, phone, messenger URL, group member profile links, role titles | ~40 leads / 15s |
| **Instagram Bio Hunter** | Influencers, DTC brands, creators, agency founders | Bio business emails, phone regex matches, website link, follower/following count, verified badge | ~60 leads / 12s |
| **Fiverr Client Hunter** | High-ticket business buyers, agency clients | Active buyer usernames, total review spend history, gig review ratings, country origin (US, UK, CA, AU, EU) | ~30 leads / 8s |

### 1-Click Real-Time Push Pipeline
- **Zero Export Hassle**: Scraped contacts push directly into the active Mail Flow organization via `/api/recipients/push_leads/`.
- **Automatic Audience Deduplication**: Normalizes email formats, strips invalid records, and merges with existing lists.
- **Instant Campaign Trigger**: Configurable auto-dispatch to immediately enroll new leads in active cold email sequences.

### Licensing, Quotas & 2-Device Policy
- **Included Free for Paid Users**: Every active Mail Flow paid subscriber unlocks Lead Hunter automatically using their account email.
- **Tier Quota Breakdown**:
  - `->` **Starter Plan**: 2,500 Recipient Quota / 250 Batch Limit
  - `->` **Pro Plan**: 10,000 Recipient Quota / 500 Batch Limit
  - `->` **Enterprise Plan**: 50,000+ Recipient Quota / 1,000 Batch Limit
- **2-Device Security**: Cryptographic hardware binding allows up to 2 active computers per license. A 3rd workstation triggers an automated 6-digit OTP device transfer verification.

### Extension Installation (Developer Mode & Web Store)
- **Direct Package Download**: [**`https://mail.annomous.com/lead-hunter/lead-hunter.zip`**](https://mail.annomous.com/lead-hunter/lead-hunter.zip)
- **4-Step Developer Mode Setup**:
  1. `->` Download and extract `lead-hunter.zip` to a local folder.
  2. `->` In Google Chrome, navigate to `chrome://extensions`.
  3. `->` Toggle on **Developer mode** (top-right) and click **Load unpacked**.
  4. `->` Select the extracted folder, open the extension, and enter your active Mail Flow account email.
- **Chrome Web Store**: Currently tagged as *Coming Soon / Under Review*.

---

## 4. Visual Design System & Component Hierarchy

The web interface adheres strictly to a modern, dark glassmorphism design standard:

```
frontend/src/
├── components/
│   ├── BrandLogo.jsx                       # Master brand logo with multi-variant asset support
│   ├── landing/
│   │   ├── LandingHeader.jsx               # Sticky scroll-elevated parent SaaS navigation
│   │   ├── LandingHero.jsx                 # Dynamic monitor widget & headline
│   │   ├── LandingFeatures.jsx             # Grid feature highlights
│   │   ├── LandingPricing.jsx              # Tiered subscription selector & custom quote modal
│   │   └── LandingFooter.jsx               # Ecosystem footer with quick links
│   └── lead-hunter/
│       ├── LeadHunterHeader.jsx            # Sticky scroll-elevated Lead Hunter navbar
│       ├── LeadHunterHero.jsx              # Hero section with official logo & value pillars
│       ├── LeadHunterInteractiveScraper.jsx# Live simulated extraction engine with 4 channels
│       ├── LeadHunterInstallationGuide.jsx # 4-step Developer Mode .ZIP installation walkthrough
│       ├── LeadHunterChannels.jsx          # Deep-dive scraper engine cards
│       └── LeadHunterPlanQuotas.jsx        # Free plan quota comparison table
└── pages/
    ├── Landing.jsx                         # Main Mail Flow landing page (/)
    └── LeadHunterPublic.jsx                # Dedicated Lead Hunter public showcase (/lead-hunter)
```

### UI & Styling Rules
- `->` **Sticky Navigation**: Header transitions dynamically to `bg-[#060911]/95 backdrop-blur-2xl` with shadow elevation on scroll.
- `->` **Input Icon Padding Rule**: Input containers with prefix icons strictly enforce `!pl-12` (48px clearance) to eliminate placeholder overlap.
- `->` **Arrow Placement Rule**: Directional icons and arrows (`<ArrowRight />`) are positioned at the start of links and button labels.
- `->` **Typography**: Zero em dashes (`—`) or en dashes (`–`) in product UI; clean standard hyphens and colons only.

---

## 5. Complete API Reference

### Lead Hunter & Push Pipeline

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/recipients/push_leads/` | Relay / Secret | Receives scraped batches and auto-creates lists |
| `GET` | `/api/recipient-lists/summary/` | Authenticated | Fetches audience counts and sync statistics |
| `GET` | `/api/billing/platform/lead-hunter/licenses/` | Owner Only | Lists all issued Lead Hunter extension licenses |
| `POST` | `/api/billing/platform/lead-hunter/licenses/` | Owner Only | Provisions custom quotas or manual extension access |
| `POST` | `/api/billing/platform/lead-hunter/licenses/{key}/action/` | Owner Only | Extends, suspends, adjusts limits, or resets HWID |

### Campaign Management

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `GET` | `/api/campaigns/` | Org Users | Lists organization campaigns with pagination |
| `POST` | `/api/campaigns/` | Admin / Manager | Creates a new campaign with templates and lists |
| `POST` | `/api/campaigns/{id}/launch/` | Admin / Manager | Dispatches Celery asynchronous email workers |
| `GET` | `/api/campaigns/{id}/progress/` | Org Users | Polls live dispatch progress and delivery metrics |

### Billing & USDT Crypto Invoices

| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `GET` | `/api/billing/plans/` | Public | Retrieves active subscription plans and pricing |
| `POST` | `/api/billing/invoices/` | Public / User | Generates micro-rate USDT payment invoice |
| `POST` | `/api/billing/invoices/{id}/verify/` | Public / User | Submits on-chain transaction hash for verification |
| `GET` | `/api/billing/platform/payment-reviews/` | Owner Only | Admin queue for manual blockchain review |

---

## 6. Security & Cryptographic Invariants

- **Fernet Encryption at Rest**: SMTP passwords, mailbox credentials, API keys, and tracking tokens are encrypted using AES-128-CBC with HMAC-SHA256 authentication.
- **Hardware-Bound JWT Tokens**: Lead Hunter issues HMAC-SHA256 tokens bound to unique SHA-256 hardware fingerprints.
- **httpOnly Cookie Transport**: Access and refresh JWT tokens are transmitted exclusively over secure, httpOnly SameSite cookies.
- **Zero Raw IP Retention**: Click and unsubscribe tracking hashes visitor IP addresses using SHA-256 with an isolated server salt.
- **Custody-Free Crypto**: No private keys or wallet seeds are stored on servers; verification utilizes public blockchain explorers.

---

## 7. Verification, Testing & Build Commands

Run the full automated test and verification suite:

```bash
# 1. Backend Django Checks & Migrations
cd backend && ../.venv/Scripts/python manage.py check
cd backend && ../.venv/Scripts/python manage.py makemigrations --check --dry-run
cd backend && ../.venv/Scripts/python manage.py test billing.tests users.tests --settings=config.test_settings

# 2. Frontend React Tests, Linting & Vite Production Build
cd frontend && npm test
cd frontend && npm run build

# 3. Lead Hunter Extension Package Validation
cd D:/Tools/MailAutomation-LeadHunt && npm run build:zip

# 4. PHP Relay Syntax Checks
php -l deploy/php/mailflow-otp-relay.php
php -l deploy/php/mailflow-smtp-test-relay.php
php -l deploy/php/mailflow-campaign-relay.php
php -l deploy/php/mailflow-imap-sync-relay.php
php -l deploy/php/mailflow-leadhunt-relay.php
```

---

## 8. Deployment & Environment Setup

### Docker Compose Quickstart

```bash
# Clone repository and enter project directory
cd d:/Tools/MailAutomation

# Configure environment variables
cp .env.example .env

# Build and launch all multi-container services
docker compose up -d --build
```

### Core Environment Variables

```ini
# Django Application
DJANGO_SECRET_KEY=your-production-django-secret
DEBUG=False
ALLOWED_HOSTS=mailflow.annomous.com,localhost,127.0.0.1
FRONTEND_URL=https://mail-flow.annomous.com

# Database (PostgreSQL)
DATABASE_URL=postgres://mailflow:password@postgres:5432/mailflow_db

# Asynchronous Broker (Redis)
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Security & Relays
FERNET_KEY=your-32-byte-base64-fernet-key
MAIL_FLOW_OTP_RELAY_URL=https://mail.annomous.com/mailflow-otp-relay.php
MAIL_FLOW_OTP_RELAY_SECRET=your-relay-secret-key
MAIL_FLOW_LEADHUNT_RELAY_URL=https://mail.annomous.com/mailflow-leadhunt-relay.php
```

---

## 9. Responsible Use & License

> [!IMPORTANT]
> **Anti-Spam Compliance**: Only send cold outreach to recipients in compliance with CAN-SPAM, GDPR, and CASL regulations. Always include verified physical business addresses and functional unsubscribe mechanisms.

Copyright (c) 2026 Mail Flow Technologies. All rights reserved.
