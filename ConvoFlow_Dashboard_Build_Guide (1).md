# ConvoFlow Attribution & Client Performance Dashboard
# Complete Build Guide for Development Team

**Deadline: Friday, April 18, 2026**
**Team: Ujjawal (Data Pipes/n8n) + Mark & Noel (decide your own roles between yourselves)**
**Build Tool: Claude Code**
**Prepared by: Abdus Samad Khan, CEO**

---

## WHAT YOU'RE BUILDING

A hosted web application that gives ConvoFlow's internal team and clients a single source of truth. It merges Meta Ads data (spend, leads, CPL per ad creative), GoHighLevel CRM data (lead outcomes, pipeline stages, meetings, closes), and VAPI call data (Sarah's transcripts, call outcomes, qualification status) into one dashboard.

This replaces the current workflow where Abdus manually exports CSVs from Meta and GHL, feeds them into Claude for cross-referencing, and spends 2-3 hours per audit just to figure out which ads are producing qualified meetings and which are wasting money.

The dashboard answers one question: "Is this working, and if not, where is it breaking?"

For ConvoFlow internally, it shows which ad creatives produce pipeline and which don't. For clients, it shows what their AI is doing, how many leads came in, how many meetings booked, and whether they're on track to hit their targets.

---

## HOW THE CALL DECISIONS SHAPE THIS

From the April 15 team call, these decisions were confirmed:

**Build approach:** React web app built with Claude Code. Not Base44 (used for onboarding portal but wrong for data-heavy dashboards). Not Google Sheets (hits limits at 15+ clients). Custom build from day one.

**Team split:** Three people, three layers, zero dependency on any single person. Ujjawal owns n8n and all data pipes (GHL webhooks, VAPI webhooks, Meta API pulls, WhatsApp alerts). Mark and Noel own the app (database, backend, frontend, UI). Decide between yourselves who takes what. Shared GitHub repo with separate branches. Ujjawal is the only ongoing dependency and he's the senior dev already doing this work.

**V1 scope:** ConvoFlow's own sub-account only. One dashboard showing ConvoFlow's UK campaign data with LIVE data from Meta Ads and GHL. Once this works, template it for clients.

**Iteration approach:** Don't try to make it perfect from day one. Get the initial working prototype with real live data. Then iterate on design, accuracy, and features. Don't try to ship the finished product. Ship something that works and improve it.

**Multi-tenant from day one:** Even though V1 is ConvoFlow only, the database schema must support multiple clients via a client_id on every table. Admin sees all sub-accounts. Clients see only their own.

**Authentication:** Google sign-in.

**Deadline:** Friday April 18 to Saturday April 19 for initial working prototype. This means: ConvoFlow's real Meta Ads data and GHL lead data pulling live into the dashboard. Real numbers, not hardcoded. The UI doesn't need to be perfect. The data needs to be accurate and live.

---

## TEAM RESPONSIBILITIES (this is decided, not a question)

Three people, three layers. No overlap. No dependency on any single person for the app to keep working.

### UJJAWAL — Data Pipes (n8n, webhooks, API connections, alerts)

Ujjawal is the senior dev. He owns everything between the data sources and the database. If data isn't flowing into Supabase, it's Ujjawal's problem. If a webhook breaks, Ujjawal fixes it. If a new client goes live, Ujjawal sets up their data pipes.

**Before Mark and Noel start (deliver by end of Tuesday April 15):**
- Provide GHL API credentials (API key or OAuth) for ConvoFlow UK sub-account
- Provide the GHL sub-account location ID for ConvoFlow UK
- Provide VAPI API key and server URL for Sarah's agents
- Provide access to ConvoFlow's n8n instance (URL + login)
- Confirm the exact GHL custom field name where ad_id is stored
- Confirm the exact GHL pipeline stage names used in ConvoFlow UK

**Build (Wednesday-Thursday):**
- n8n workflow: GHL webhook listener. Listens for ContactCreate, ContactUpdate, OpportunityCreate, OpportunityStageUpdate, AppointmentCreate. Writes to Supabase.
- n8n workflow: VAPI webhook listener. Receives end-of-call-report from VAPI. Extracts transcript, summary, duration, recording URL, structured data. Matches to contact by phone number. Writes to Supabase.
- n8n workflow: Meta Ads API scheduled pull. Runs every 30-60 minutes. Pulls spend, impressions, reach, frequency, clicks, leads per ad per day. Writes to Supabase ad_daily_metrics table.
- n8n workflow: Daily WhatsApp alert. Runs at 8 AM Dubai time. Reads from Supabase daily_snapshots. Formats message. Sends to Abdus via WhatsApp.
- n8n workflow: Real-time alerts. Fires immediately when: meeting booked (notify Abdus), hot lead flagged by VAPI (notify sales team), meeting stuck with no status update 2 hours after scheduled time (notify Abdus).
- GHL webhook setup: inside GHL sub-account, configure outbound webhooks pointing to n8n webhook URLs.
- VAPI webhook setup: configure end-of-call-report server URL on Sarah's agents to point to n8n.
- VAPI Structured Outputs: if not already configured, add JSON schema to Sarah's agents for call outcome, lead quality score (1-10), hot lead flag, and summary.

**CAPI fix (while you're in GHL anyway):**
- Set up fbclid pass-through from instant form to GHL
- Configure staged CAPI events: Lead (AED 50), Qualified (AED 200), Meeting Booked (AED 500), Proposal Sent (AED 1,000), Closed Won (AED 5,000)
- This doesn't affect the dashboard but it fixes Meta's algorithm. It's been pending since Day 1.

**Ongoing after launch:**
- When a new client goes live, clone the n8n workflows, point them at the new GHL sub-account and VAPI agents, add the client to Supabase clients table.
- If any webhook breaks or n8n errors out, Ujjawal debugs and fixes.
- If GHL pipeline stages change, Ujjawal updates the n8n mapping.

### NOEL — Database & Backend (Supabase, schema, API, auth)

The backend developer builds the foundation that the frontend sits on. Once it's built, it runs. They don't need to be available daily after launch unless new features are needed.

**Build (Wednesday-Thursday):**
- Create Supabase project
- Build all database tables (see DATABASE SCHEMA section below)
- Set up row-level security policies (client_id based isolation)
- Set up Google OAuth via Supabase Auth
- Create database views or functions for: per-ad funnel aggregation (leads, meetings, shows, active, closed per ad), daily/weekly/monthly rollups, health score calculation, unit economics calculation (CPL, cost per meeting, cost per active opp)
- Create API endpoints (Supabase Edge Functions or direct Supabase client queries) that the React frontend calls
- Ensure n8n can write to all tables (create a service role key for n8n)
- Test that data written by Ujjawal's n8n workflows appears correctly in queries
- Help frontend developer connect to Supabase data

**Deploy (Friday):**
- Deploy Supabase project (it's hosted by default)
- Verify auth works
- Verify data queries return correct numbers
- Stress test: what happens when n8n writes 50 contacts in rapid succession

### MARK — Frontend & UI (React, charts, design, UX)

The frontend developer builds what everyone sees. The dashboard needs to look premium. ConvoFlow is a premium consulting brand. The UI must match.

**Build (Wednesday-Thursday):**
- Set up React project with routing
- Build layout shell: fixed sidebar, header with date picker and sync status, client selector dropdown
- Build Overview view: KPI cards (actual vs target, red/green, trend arrows), visual funnel, active pipeline list
- Build Ad Creatives view: table with per-ad metrics, color coding, expandable rows
- Build Lead Tracker view: contact table with filters, expandable rows showing Sarah's call summary, timeline
- Build Trends view: week-over-week table, daily CPL chart, frequency tracker
- Build Health Dashboard view: actual vs target table, health score, churn risk
- Build Settings view: targets editor, sync status, team management
- Implement Google sign-in UI
- Connect all views to Supabase data (work with backend dev on queries)
- Implement PDF and CSV export
- Apply ConvoFlow brand: Outfit font, pink accent, light theme, premium feel

**Polish (Friday):**
- Ensure all color coding works (green/red/amber based on targets)
- Test with real data from ConvoFlow campaign
- Fix any responsive issues
- Final design pass

## QUESTIONS FOR MARK AND NOEL (answer before you start coding)

**1. GitHub repo structure?**
- Repo name?
- Branch strategy? (main + feature branches, or main + mark-branch + noel-branch?)
- Who creates the repo?

**2. Estimated timeline?**
Break it down: what will be done by end of Wednesday, end of Thursday, and Friday morning? Send this breakdown to Abdus in the WhatsApp group before you start.

**3. What do you need from Abdus?**
Review the "API Credentials Needed" section at the bottom. Tell Abdus what you need. Don't wait until you're blocked.

**4. Where are you hosting the frontend?**
Vercel (free tier works for V1) or Cloudflare Pages? Decide and set it up on day 1 so you can deploy early and often.

**6. How will you handle the data sync?**
Option A: n8n pulls from GHL and Meta on a schedule (every 30-60 min) and pushes to Supabase.
Option B: GHL webhooks push to n8n in real-time for lead events, n8n pulls Meta on a schedule.
Option B is better. Use webhooks for GHL (real-time), scheduled pulls for Meta (every 30-60 min). Confirm you're both aligned on this.

**7. What's your testing approach?**
Before connecting live APIs, test with ConvoFlow's actual exported data (the CSVs exist in the Claude chat). Load them into Supabase manually. Build the frontend against real data. Then swap in the live API connection. This way you're not blocked on API setup while building the UI.

---

## THE ARCHITECTURE

```
DATA SOURCES                    UJJAWAL'S DOMAIN           NOEL'S DOMAIN        MARK'S DOMAIN
─────────────────              ──────────────────          ─────────────        ─────────────
Meta Ads API ────────┐
                     ├──→ n8n (scheduled sync) ──→ Supabase DB ──→ React Frontend
GHL API ─────────────┤         (Ujjawal)              (Mark & Noel)
                     ├──→ n8n (webhook listener) ──→ Supabase DB
VAPI ────────────────┘

Supabase DB ──→ n8n (daily rules check) ──→ WhatsApp alerts to Abdus
                     (Ujjawal)
```

**Why this architecture and why three people:**

Ujjawal owns n8n. He already knows it. He already builds GHL and VAPI automations in it. If a webhook breaks at 2 AM, Ujjawal fixes it in n8n without calling anyone else. If you onboard a new client, Ujjawal clones the n8n workflow and points it at the new GHL sub-account. If a GHL pipeline stage name changes, Ujjawal updates the mapping in n8n. n8n is the only ongoing maintenance dependency and it sits with the senior dev.

Mark and Noel build the Supabase database, backend, and React frontend. They decide between themselves who handles which parts. Once built, it runs. Supabase is managed hosting so there's no server maintenance.

The frontend only reads from Supabase. It never touches GHL, Meta, or VAPI directly.

If Mark or Noel disappear tomorrow, the data still flows through Ujjawal's n8n to Supabase. The only person needed ongoing is Ujjawal, and he's already doing this work as part of his regular role.

---

## TECH STACK

**Frontend:** React
**Backend/Database:** Supabase (PostgreSQL)
**Auth:** Google OAuth via Supabase Auth
**Data Pipeline:** n8n (Ujjawal's responsibility, already in ConvoFlow's stack)
**Hosting:** Vercel or Cloudflare Pages (ConvoFlow already uses Cloudflare)
**Alerts:** WhatsApp via GHL internal notification or Twilio (through n8n)
**Export:** PDF/CSV generation from frontend

---

## DATABASE SCHEMA

Build these tables in Supabase. Every table has client_id for multi-tenant support even in V1.

### clients
```
id              UUID PRIMARY KEY
name            TEXT NOT NULL (e.g. "ConvoFlow UK", "Lux Homes", "Monetize")
ghl_location_id TEXT (GHL sub-account ID)
meta_ad_account_id TEXT
industry        TEXT
service_type    TEXT (Lead Qualification / Mass Calling / Both)
onboarding_date DATE
account_manager TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

### targets (set during onboarding, editable by admin)
```
id              UUID PRIMARY KEY
client_id       UUID REFERENCES clients(id)
metric_name     TEXT (monthly_leads, monthly_meetings, monthly_closes, booking_rate, show_rate, close_rate, cpl_target, cost_per_meeting, cost_per_active)
target_value    NUMERIC
updated_at      TIMESTAMP
updated_by      UUID REFERENCES users(id)
```

### ads
```
id              UUID PRIMARY KEY
client_id       UUID REFERENCES clients(id)
meta_ad_id      TEXT (the ad ID from Meta, e.g. "120245303991500170")
ad_name         TEXT (e.g. "Video5-Abdus")
ad_set_name     TEXT
campaign_name   TEXT
status          TEXT (active, paused, off)
created_at      TIMESTAMP
```

### ad_daily_metrics (one row per ad per day, enables trend analysis)
```
id              UUID PRIMARY KEY
ad_id           UUID REFERENCES ads(id)
date            DATE NOT NULL
spend           NUMERIC
impressions     INTEGER
reach           INTEGER
frequency       NUMERIC
clicks          INTEGER
leads_meta      INTEGER (leads reported by Meta)
ctr             NUMERIC
cpm             NUMERIC
created_at      TIMESTAMP
UNIQUE(ad_id, date)
```

### contacts (every lead from GHL)
```
id              UUID PRIMARY KEY
client_id       UUID REFERENCES clients(id)
ghl_contact_id  TEXT
first_name      TEXT
last_name       TEXT
email           TEXT
phone           TEXT
company         TEXT
ad_id           UUID REFERENCES ads(id) (matched via GHL ad_id field)
meta_ad_id_raw  TEXT (the raw ad_id string from GHL, for matching)
created_at      TIMESTAMP
last_updated    TIMESTAMP
```

### contact_events (append-only timeline of everything that happens to a lead)
```
id              UUID PRIMARY KEY
contact_id      UUID REFERENCES contacts(id)
event_type      TEXT (lead_created, ai_call_completed, qualified, disqualified, not_interested, wrong_number, meeting_booked, meeting_confirmed, meeting_showed, meeting_noshow, proposal_sent, follow_up_meeting, closed_won, closed_lost)
event_data      JSONB (flexible payload: call transcript, DQ reason, meeting date, deal value, etc.)
source          TEXT (ghl_webhook, vapi_webhook, manual, n8n_sync)
timestamp       TIMESTAMP NOT NULL
```

### contact_current_status (denormalized for fast dashboard queries)
```
contact_id      UUID PRIMARY KEY REFERENCES contacts(id)
current_stage   TEXT (new, contacted, qualified, disqualified, not_interested, wrong_number, meeting_booked, showed, noshow, active, proposal_sent, follow_up_meeting, closed_won, closed_lost, follow_up, no_answer, callback)
current_tags    TEXT[]
call_summary    TEXT (Sarah's latest call summary)
call_transcript TEXT (full transcript from VAPI)
lead_quality_score INTEGER (1-10 from VAPI structured output)
hot_lead        BOOLEAN
follow_up_attempts INTEGER
meeting_date    TIMESTAMP
deal_value      NUMERIC
last_updated    TIMESTAMP
```

### daily_snapshots (for daily/weekly/monthly reporting)
```
id              UUID PRIMARY KEY
client_id       UUID REFERENCES clients(id)
date            DATE NOT NULL
total_leads     INTEGER
contacted       INTEGER
qualified_booked INTEGER
qualified_no_meeting INTEGER
disqualified    INTEGER
not_interested  INTEGER
unreachable     INTEGER
wrong_number    INTEGER
meetings_booked INTEGER
shows           INTEGER
no_shows        INTEGER
closes          INTEGER
revenue         NUMERIC
ad_spend        NUMERIC
booking_rate    NUMERIC
show_rate       NUMERIC
close_rate      NUMERIC
health_score    NUMERIC
health_status   TEXT (GREEN, YELLOW, RED)
UNIQUE(client_id, date)
```

### alert_rules
```
id              UUID PRIMARY KEY
client_id       UUID REFERENCES clients(id)
rule_name       TEXT
metric          TEXT
operator        TEXT (>, <, =, >=, <=)
threshold       NUMERIC
alert_channel   TEXT (whatsapp, email, in_app)
enabled         BOOLEAN DEFAULT true
last_triggered  TIMESTAMP
```

### users
```
id              UUID PRIMARY KEY
email           TEXT UNIQUE
name            TEXT
role            TEXT (admin, team, client)
client_id       UUID REFERENCES clients(id) (NULL for admin/team, set for client users)
avatar_url      TEXT
created_at      TIMESTAMP
```

---

## DATA SOURCES: WHERE EACH METRIC COMES FROM

This is the critical reference. For every number shown on the dashboard, this tells you exactly where it originates.

### From Meta Ads API (via n8n scheduled pull)
- Ad spend (per ad, per day)
- Impressions, reach, frequency (per ad, per day)
- Link clicks, CTR, CPM (per ad, per day)
- Leads reported by Meta (per ad, per day)
- Ad status (active, paused)
- Ad name, ad set name, campaign name

**Meta Marketing API endpoint:** GET /{ad_id}/insights with fields=spend,impressions,reach,frequency,clicks,actions&date_preset=last_7d&time_increment=1
**Auth:** Access token from Meta Business settings
**Rate limit:** 200 calls per hour per ad account
**n8n schedule:** Every 30-60 minutes

### From GoHighLevel API (via n8n webhook + scheduled sync)
- Contact details (name, email, phone, company, ad_id)
- Pipeline stage (which stage the lead is currently in)
- Tags (qualified, disqualified, meeting_booked, wrong_number, etc.)
- Opportunity data (deal value, pipeline name, stage name)
- Appointment data (date, status, showed/noshow)
- Call recording URL
- Call summary (Sarah's AI-generated summary stored as a contact field)

**GHL API base:** https://services.leadconnectorhq.com
**Key endpoints:**
- GET /contacts/ (search contacts by date, tags, pipeline)
- GET /contacts/{id} (individual contact with all fields)
- GET /opportunities/ (pipeline opportunities with values)
- GET /calendars/events (appointment bookings)

**GHL Webhook events to listen for:**
- ContactCreate (new lead enters)
- ContactUpdate (tags change, fields update)
- OpportunityCreate (new opportunity in pipeline)
- OpportunityStageUpdate (lead moves stages, this is the most important one)
- AppointmentCreate (meeting booked)

**GHL API rate limit:** 100 requests per 10 seconds, 200,000 per day per location
**Auth:** OAuth 2.0 or API key per sub-account

### From VAPI (via n8n webhook)
- Full call transcript
- AI-generated call summary
- Call duration, cost, recording URL
- Structured outputs (if configured): interest level, appointment booked, objections, lead quality score
- Call ended reason (completed, no_answer, voicemail, error)
- Success evaluation score

**VAPI webhook:** end-of-call-report fires automatically when each call completes
**VAPI Analytics API:** POST /analytics for aggregate queries (total calls, avg duration, outcomes by date)
**n8n connection:** Webhook node receives VAPI POST, HTTP Request node calls VAPI API
**Auth:** Bearer token

### Calculated fields (computed in app or n8n, not from any API)
- Cost per lead = ad spend / leads
- Cost per meeting = ad spend / meetings booked
- Cost per active opportunity = ad spend / active opportunities
- Cost per close = ad spend / closes
- Booking rate = meetings booked / leads contacted
- Show rate = shows / (shows + no_shows)
- Close rate = closes / shows
- Health score = average of (actual leads / target leads, actual meetings / target meetings, actual closes / target closes)
- Health status = GREEN if health score >= 80%, YELLOW if >= 60%, RED if < 60%
- ROAS = revenue / ad spend

---

## GHL PIPELINE STAGES (standardized across all clients)

Every client uses the same pipeline stages. This is the mapping for n8n to know which GHL stage increments which counter.

| GHL Pipeline Stage | Dashboard Category | Counter to Increment |
|---|---|---|
| New Lead | Lead Created | total_leads |
| AI Contacted | Contacted by AI | contacted |
| Qualified - Meeting Booked | Meeting Booked | qualified_booked, meetings_booked |
| Qualified - No Meeting | Qualified (no meeting) | qualified_no_meeting |
| Disqualified | Disqualified | disqualified |
| Not Interested | Not Interested | not_interested |
| Unreachable / Follow-up | Follow-up | unreachable |
| Wrong Number | Wrong Number | wrong_number |
| Callback Requested | Callback | (stays in follow-up) |
| Meeting Confirmed | Meeting Confirmed | (no new counter) |
| Meeting Showed | Showed Up | shows |
| Meeting No-Show | No Show | no_shows |
| Proposal Sent | Active Opportunity | (tracked in opportunities) |
| Follow-Up Meeting | Active Opportunity | (tracked in opportunities) |
| Closed Won | Closed | closes, revenue |
| Closed Lost | Lost | (tracked separately) |

---

## FRONTEND VIEWS

### View 1: Overview (default landing page)

What the user sees when they log in. Date range defaults to "Last 7 days" with a date picker.

**Row 1: Volume KPI Cards (6 cards in a row)**
Each card shows: metric name, current value, target value (from targets table), red/green indicator, week-over-week trend arrow with percentage change.

Cards: Total Spend (AED), Leads, Meetings Booked, Showed Up, Active Opportunities, Closed Won

**Row 2: Unit Economics KPI Cards (6 cards)**
Same format but inverse color coding (lower is better for cost metrics).

Cards: Cost per Lead, Cost per Meeting, Cost per Active Opp, Show Rate %, Meeting Rate %, ROAS

**Visual Funnel (below KPI cards)**
Horizontal bar chart. Leads at top (full width), then Meetings Booked, Showed Up, Active Opps, Closed Won. Each bar shows count and conversion rate from stage above.

**Active Pipeline (below funnel)**
List of contacts where current_stage is "active" (proposal_sent, follow_up_meeting). Shows name, company, stage, source ad, date.

### View 2: Ad Creatives

Table of every ad creative.

Columns: Ad Name, Status (active/off badge), Spend, Leads, CPL, Meetings, Showed, Active Opps, Cost per Active Opp, Frequency, CTR

Color coding: CPL green if below target, red if above. Frequency amber if > 1.5, red if > 2.0. Cost per active opp green if below target, red if above. Inactive ads faded/greyed.

Click any row to expand: daily spend/lead chart for that ad, list of all contacts from that ad with status.

### View 3: Lead Tracker

Full table of all contacts.

Columns: Name, Company, Source Ad, Date, Stage, Status Badge (color-coded: green=active, amber=upcoming/followup, red=DQ/noshow)

Filters: By ad creative, by status, by date range.

Expandable rows: Click any lead to see:
- Meeting date
- Follow-up attempts count
- Source ad
- Sarah's call summary (full text)
- Call transcript (if available from VAPI)
- Lead quality score (if available)
- Timeline of all events from contact_events table

### View 4: Trends

Week-over-week comparison table with color coding showing direction of each metric.

Daily CPL line chart with target line.

Frequency tracker: progress bar showing current frequency vs 2.5 ceiling.

Daily lead volume chart.

### View 5: Health Dashboard (from client tracking system)

Current month snapshot: leads, meetings, shows, closes, revenue, rates.

Target comparison table: Actual vs Target with % of target and GREEN/YELLOW/RED status for each metric.

Overall health score and churn risk indicator.

### View 6: Settings (admin only)

Targets management: edit all target values per client.

Alert rules: enable/disable, set thresholds.

Team management: add/remove users, set roles.

Sync status: shows last sync time, manual refresh button.

Client management: add new client sub-accounts, set GHL location ID, Meta ad account ID.

---

## NAVIGATION AND LAYOUT

**Sidebar (fixed left):**
- ConvoFlow logo
- Client selector dropdown (admin sees all clients, client users see only theirs)
- Overview
- Ad Creatives
- Lead Tracker
- Trends
- Health Dashboard
- Settings (admin only)

**Header (fixed top):**
- Date range picker (presets: Today, Last 7 Days, Last 30 Days, This Month, Custom)
- Last synced timestamp
- Manual refresh button
- User avatar + name + logout

---

## DESIGN SYSTEM

**Brand colors:**
- Primary accent: #EC4899 (ConvoFlow pink)
- Dark/text: #0F0F1A
- Body text: #333333
- Subtle text: #6B7280
- Light gray: #9CA3AF
- Green (positive/on target): #16A34A
- Red (negative/off target): #DC2626
- Amber (warning): #F59E0B
- Blue (info/proposal): #2563EB
- Background: #FAFAFA
- Card background: #FFFFFF
- Border: #E5E7EB
- Subtle background: #F3F4F6

**Font:** Outfit (Google Fonts) - already used across ConvoFlow brand.

**Theme:** Light/white. Clean, premium, breathable. Same aesthetic as ConvoFlow landing page.

**Layout:** Desktop-first. Responsive but desktop is priority for V1.

**Design principles:**
- This is a premium consulting firm. The dashboard must look the part.
- ConvoFlow branding on everything. Not generic.
- Color coding is functional, not decorative. Green means on target. Red means off target. Amber means watch.
- No clutter. Each view has a clear purpose.
- Data should be scannable in 5 seconds at the top level, with drill-down for detail.

---

## AUTOMATED ALERTS (n8n workflows, Ujjawal's responsibility)

### Daily report (8 AM Dubai time)
n8n reads from Supabase: today's metrics for the client.

Sends WhatsApp message to Abdus (and eventually Armaan for client accounts):

```
ConvoFlow Daily Report — Apr 15

SPEND: AED 420 (target: AED 420) ✅
LEADS: 4 (target: 4/day) ✅
MEETINGS: 1 ✅
CPL: AED 105 (target: AED 85) ❌

ALERTS:
❌ CPL above target (AED 105 vs AED 85)
⚠️ Video5 frequency at 1.85 (ceiling: 2.5)

PIPELINE: 6 active | 0 closed
```

### Weekly report (Sunday 10 AM)
Same structure but weekly totals with week-over-week comparison.

### Monthly report (1st of month, 10 AM)
Full month metrics, target comparisons, health score, trend analysis.

### Real-time alerts (fire immediately)
- New meeting booked: notify with lead name, company, source ad, meeting time
- Meeting stuck (no show/noshow status 2 hours after scheduled time): "Check with sales team"
- Hot lead flagged by VAPI: "Hot lead: [name] from [company]. Call them now."
- System issue detected in VAPI call: "Urgent: AI agent issue detected. Check transcript."

---

## EXPORT

**PDF export:** Generates a formatted report with all KPIs, funnel, per-ad breakdown, active pipeline. Available from any view via export button.

**CSV export:** Raw data dump of all contacts with attribution, status, and event history for selected date range.

---

## BUILD PRIORITY (what to do in what order)

### Day 0 (Tuesday April 15 — TODAY)

**Ujjawal (unblocks everyone else):**
- Send to WhatsApp group: GHL API credentials, GHL location ID, VAPI API key, n8n instance access
- Confirm exact GHL pipeline stage names and ad_id custom field name
- Confirm VAPI server URL configuration

**Abdus:**
- Send to WhatsApp group: Meta Marketing API access token, Meta ad account ID
- Create Google Cloud Console OAuth client ID and share credentials
- Share ConvoFlow logo files (PNG, SVG)

**Mark + Noel (split as you decide):**
- Create shared GitHub repo
- Agree on branch strategy
- Send estimated day-by-day breakdown to WhatsApp group

### Day 1 (Wednesday April 16)

**Ujjawal:**
- Build n8n workflow: GHL webhook listener (ContactCreate, ContactUpdate, OpportunityStageUpdate, AppointmentCreate). Receives webhook, maps to correct Supabase table, writes data.
- Build n8n workflow: Meta Ads API scheduled pull. Every 30-60 mins, pulls per-ad daily metrics. Writes to ad_daily_metrics table.
- Build n8n workflow: VAPI end-of-call-report webhook listener. Receives transcript, summary, structured data. Matches to contact by phone. Writes to contact_events and contact_current_status.
- Set up GHL outbound webhooks in ConvoFlow UK sub-account pointing to n8n URLs
- Set up VAPI server URL on Sarah's agents pointing to n8n
- Test: create a test lead in GHL, move it through stages, verify data lands in Supabase

**Backend tasks:**
- Create Supabase project
- Build all database tables (schema in this document)
- Set up row-level security policies
- Set up Google OAuth in Supabase Auth
- Create a service role key for n8n (give to Ujjawal)
- Share Supabase project URL and anon key with each other
- Create database views for dashboard queries (per-ad funnel, daily rollups, health score)

**Frontend tasks:**
- Set up React project with routing
- Install Supabase client, Recharts, Outfit font
- Build layout shell: sidebar, header with date picker, ConvoFlow branding
- Build Overview view with KPI cards (use test data if live data not ready yet)
- Implement Google sign-in UI

**Everyone:** Deploy to hosting at end of day 1, even if empty. Get the deployment pipeline working early.

### Day 2 (Thursday April 17)

**Ujjawal:**
- Build n8n workflow: daily WhatsApp alert (8 AM Dubai, reads daily_snapshots, sends to Abdus)
- Build n8n workflow: real-time meeting booked alert
- Build n8n workflow: stuck meeting alert (checks every 2 hours)
- Build n8n workflow: daily snapshot aggregation (runs nightly, counts contacts per stage, writes to daily_snapshots)
- Fix CAPI: fbclid pass-through + staged events
- End-to-end test: Meta spend + GHL lead + VAPI transcript all arriving in Supabase correctly

**Backend tasks:**
- Create calculated field queries (CPL, cost per meeting, cost per active opp, ROAS, health score)
- Build any Supabase Edge Functions for complex aggregations
- Help frontend developer connect to live data
- Test auth flow end-to-end
- Build the manual refresh endpoint that triggers n8n sync

**Frontend tasks:**
- Connect Overview KPI cards to live Supabase data
- Build visual funnel component
- Build Ad Creatives table with color coding and expandable rows
- Build Lead Tracker with filters and expandable rows (transcript display)
- Style everything to ConvoFlow brand

### Day 3 (Friday April 18) — DEADLINE

**Ujjawal:**
- Verify all data pipes stable and accurate
- Run full reconciliation: Meta Ads Manager numbers match dashboard numbers, GHL contact counts match
- Ensure WhatsApp daily report fires correctly

**Backend tasks:**
- Verify all queries return correct numbers (Video5 = 49 leads, 13 meetings, 6 active — dashboard must match)
- Fix any data accuracy issues
- Stress test concurrent usage

**Frontend tasks:**
- Build Trends view (week-over-week table, frequency tracker)
- Build Health Dashboard (actual vs target, health score)
- Build Settings page (targets management, sync status)
- Final UI polish, branding check
- PDF/CSV export
- Demo to Abdus with real ConvoFlow data

### If it takes until Saturday April 19

That's fine. The prototype needs to work with live data. A working dashboard with imperfect design is better than a beautiful dashboard with no data. Prioritize data accuracy over visual polish.

---

## WHAT TO SUBMIT TO ABDUS

**Ujjawal (today, Tuesday):**
1. All API credentials and access (see list above)
2. Confirmed GHL pipeline stage names
3. Confirmed ad_id field name in GHL

**Mark + Noel (before starting Wednesday):**
1. GitHub repo link
2. Estimated day-by-day breakdown
3. Any additional credentials needed from Abdus

**End of each day (everyone):**
Quick update in the WhatsApp group: what was completed, what's blocked, what's planned for tomorrow.

**By Friday/Saturday:**
Working prototype URL that Abdus can open in his browser and see ConvoFlow's real data.

---

## KEY CONTEXT FOR DEVELOPERS

### Why attribution matters so much

ConvoFlow ran a UK Meta Ads campaign for 12 days. They spent AED 9,194 across 12 different ad creatives. One ad (Video5-Abdus) produced 100% of the active sales pipeline. The other 11 ads spent AED 5,226 (57% of budget) and produced zero active opportunities.

The only way they discovered this was by manually exporting data from Meta and GHL, cross-referencing by email, and spending hours in Claude chat doing attribution analysis. Multiple errors were made during this manual process (miscounting leads by 70%, misclassifying no-shows that were actually missed by the sales team, etc.).

This dashboard exists to make those errors impossible and those discoveries instant.

### How the data connects

The join key between Meta Ads and GHL is the ad_id field on each GHL contact. When someone fills out a Meta instant form, Meta passes the ad_id to GHL. The dashboard matches this to the ads table to connect spend data with lead outcomes.

Some early contacts have empty ad_id fields (a GHL mapping issue from the first 3 days of the campaign). For these, email cross-referencing with Meta lead exports is needed as a fallback. The app should handle both: match by ad_id first, fall back to email match if ad_id is empty.

### GHL pipeline stages to contact_current_status mapping

When a GHL webhook fires OpportunityStageUpdate, Ujjawal's n8n workflow needs to:
1. Find the contact in Supabase by ghl_contact_id
2. Update contact_current_status.current_stage to the new stage
3. Insert a new row in contact_events with the stage change
4. Update daily_snapshots counters for today

### VAPI call data flow

When VAPI fires end-of-call-report:
1. Ujjawal's n8n workflow receives the webhook payload
2. Extract: transcript, summary, duration, recording_url, structured_data (if available)
3. Match to a contact in Supabase by phone number
4. Insert contact_event with event_type = "ai_call_completed" and the full payload as event_data
5. Update contact_current_status with call_summary and lead_quality_score
6. If structured_data.hot_lead = true, fire a WhatsApp alert immediately

### Health Score calculation

Health Score = Average of three percentages:
- Actual leads / target leads
- Actual meetings / target meetings
- Actual closes / target closes

Health Status:
- GREEN: Health Score >= 80%
- YELLOW: Health Score >= 60% and < 80%
- RED: Health Score < 60%

Churn Risk:
- LOW: Health Score >= 80% and improving or stable
- MEDIUM: Health Score 60-80% or declining
- HIGH: Health Score < 60% or declining for 2+ consecutive weeks

---

## API CREDENTIALS NEEDED (Abdus to provide)

Before Mark and Noel start, they need:

1. **GHL API key or OAuth credentials** for ConvoFlow's sub-account
2. **GHL sub-account location ID** for ConvoFlow UK
3. **Meta Marketing API access token** for the ConvoFlow ad account
4. **Meta ad account ID**
5. **VAPI API key** and server URL configuration
6. **n8n instance URL** (ConvoFlow's existing n8n)
7. **Supabase project URL and anon key** (whoever handles backend creates the project and shares with the team)
8. **Google OAuth client ID** (create in Google Cloud Console)
9. **ConvoFlow logo files** (PNG, SVG)

---

## COMMUNICATION

WhatsApp group chat: Abdus + Mark + Noel

**Rules:**
- Send mockups and screenshots for review before building full views. A quick screenshot saves hours of rework.
- If you need data format examples, GHL field names, or API access, ask Abdus immediately. Don't wait until you're blocked.
- Daily end-of-day update in the group: what was done, what's blocked, what's next. One message each, not a novel.
- If something is harder than expected or will take longer, say so immediately. Abdus would rather know Wednesday night than Friday morning.

---

## WHAT "DONE" MEANS FOR FRIDAY

To be clear, the Friday/Saturday deadline is for an initial working prototype. Not a finished product.

**Must have (non-negotiable for Friday):**
- Hosted URL that Abdus can open in a browser
- Google sign-in working
- ConvoFlow's real Meta Ads data showing (spend per ad, leads per ad, CPL)
- ConvoFlow's real GHL data showing (leads with status, meetings, pipeline stages)
- Overview with KPI cards showing real numbers
- Ad Creatives table showing real per-ad performance
- Lead Tracker with real contacts and their current status

**Should have (aim for Friday, okay if Saturday):**
- Lead Tracker expandable rows with Sarah's call summary
- Visual funnel
- Actual vs target indicators (requires targets to be set)
- Basic trend comparison

**Nice to have (can come after the weekend):**
- Daily WhatsApp alert automation
- Health dashboard with churn risk
- Settings page with editable targets
- PDF/CSV export
- VAPI transcript integration
- Full design polish

---

## SUCCESS CRITERIA

V1 is done when:

1. Abdus can log in and see ConvoFlow's real spend, leads, meetings, active opps, and unit economics with actual vs target indicators.
2. Abdus can see which ad creative is producing pipeline and which isn't, without exporting any CSVs.
3. Abdus can click on any lead and see Sarah's call summary, meeting status, and full timeline.
4. The daily WhatsApp report fires at 8 AM with accurate numbers.
5. The data refreshes on a schedule (minimum hourly) with a manual refresh button.
6. The dashboard looks premium and matches ConvoFlow branding.
7. Multi-tenant data structure is in place (client_id on every table) even though V1 only has one client.

---

## EXISTING REFERENCE MATERIALS

These files already exist and should be shared with the team:

1. **ConvoFlow_Dashboard_V1.jsx** — React prototype built in Claude chat with ConvoFlow's real campaign data. Hardcoded data but shows the exact layout, KPI cards, funnel, ad creatives table, lead tracker with expandable rows, trends view, and frequency tracker. Use this as the visual starting point.

2. **ConvoFlow_Attribution_Dashboard_PRD.md** — Full product requirements document with architecture, database schema, views, alerts, and design system.

3. **Client_Performance_Tracking_System.docx** — The client tracking system document with GHL pipeline stages, health score calculations, churn risk methodology, and WhatsApp report templates.

4. **Client_Performance_Dashboard_Template.xlsx** — Google Sheets template with the Daily Log, Weekly Summary, Monthly Summary, Health Dashboard, and Report Templates tabs. Use the formulas and structure as reference for how calculations work.

5. **ConvoFlow_UK_Campaign_Full_Report_Day12.docx** — The full campaign report showing how attribution analysis works, what data points matter, and what decisions get made from the data. This is the "what the dashboard replaces" reference.

6. **Fathom transcript of April 15 team call** — Context on the project requirements discussed live.

---

## ADDITIONAL RECOMMENDATIONS FOR ABDUS

Things to consider adding or deciding:

**1. Error handling for bad data:** GHL sometimes has contacts with empty ad_id fields (we saw this with the first 3 days of the UK campaign). The dashboard needs to handle "unattributed" leads gracefully. Show them in a separate "Unknown Source" bucket rather than hiding them.

**2. Data accuracy validation:** Build a simple reconciliation check. Total leads in dashboard should match total contacts in GHL. Total spend should match Meta Ads Manager. If there's a gap, flag it. This catches the exact errors we spent hours finding manually.

**3. Manual override capability:** Sometimes you or the sales team know something the data doesn't (like Ron missing Mashud's meeting, or Steve Branch being DQ'd despite pipeline showing "audit done"). The dashboard should allow an admin to manually update a contact's status with a note explaining why. This is critical for data accuracy.

**4. Naming convention for ads:** Right now your ad names are like "UK-PF-04-Video5Music-Abdus - 2". The dashboard should display a clean name ("Video5 - Abdus") while storing the raw Meta ad name. Consider a display_name field in the ads table.

**5. Client onboarding flow for multi-tenant:** When you add a new client, someone needs to: create the client record, set their GHL location ID, set their Meta ad account ID, set their targets, and configure the n8n webhooks for their sub-account. This should eventually be a simple form in the Settings page, not a database operation.

**6. Historical data backfill:** For ConvoFlow's UK campaign, you have 12 days of data that exists in CSV exports but not in any database. Load this historical data into Supabase as part of setup so the dashboard has data from day one, not just from the moment the API connection goes live.

---

## WHAT V1 DOES NOT INCLUDE (save for later)

- Client-facing login and multi-tenant UI (data model supports it, UI shows only ConvoFlow for now)
- Mobile-optimized responsive design
- Real-time WebSocket live updates (scheduled sync + manual refresh is fine for V1)
- Transcript analysis AI pipeline (VAPI's built-in structured outputs handle this)
- Automated ad management (turning ads on/off from the dashboard)
- Invoice or billing integration
- The full onboarding form integration (separate system on Base44)
