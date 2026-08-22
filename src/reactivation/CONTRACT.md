# Reactivation dashboard — build contract

Read this before touching any tab. The design is
`/Users/ina/Documents/reactivation-dashboard.html` (markup + CSS, mocked data)
and `/Users/ina/Documents/dashboard-walkthrough.md` (the spec, section by section).

## Non-negotiables

1. **Never compute a figure two components both need.** It goes in a database
   function and comes through `useCampaign()`. Three pages of this app once gave
   three different answers for "meetings booked". A component may format, colour
   and lay out; it may not derive.
2. **A missing measurement is an em-dash, never a zero.** Use `num`, `pct`,
   `money` from `../format`. Never `?? 0`. "0% show rate" on zero meetings is a
   claim nobody measured, and the reader acts on it.
3. **No hardcoded hex.** Use the CSS variables (`var(--pink)`, `var(--good)`…)
   or `TONE_VAR` from `../format`. The design is dark; a colour picked against a
   white card is invisible here and nothing catches it.
4. **Use the design's own class names.** `campaign.css` is the CTO's stylesheet
   ported verbatim and scoped under `.rx`. Read it for the class you need before
   writing an inline style. Inline styles are fine for one-offs it does not
   cover; re-implementing a class it already has is not.
5. **Three states, always.** loading ≠ failed ≠ empty. Use `<Feed>` from
   `../bits`, which handles all three. The campaign rests in `draft` by design,
   so most tabs are legitimately empty on day one — and an empty grid is
   indistinguishable from a broken one unless something says which.
6. **No date-range picker.** Campaign lifetime or today. Nothing accepts a range.
7. **Plain English on screen.** No "enrolled", "released", "in flight",
   "cadence", "kill criteria". Those words live in the database and stay there.

## What you get

```js
import { useCampaign } from '../useCampaign'   // tabs: '../useCampaign', globals: './useCampaign'
const c = useCampaign()
```

Each feed is `{ data, error, loading }`:

| feed | RPC | shape |
|---|---|---|
| `c.overview` | `cf_campaign_overview` | `{ name, status, region, started_at, halted_reason, timezone, campaign_id, cadence_id, daily_dial_cap, dial_cap_steady, ramp_days, pilot_size, gate_connect_pct, dial_spacing_seconds, headroom_today, scheduled_today, last_event{at,kind,detail}, gate{passed,pilot_size,pilot_dials,pilot_complete,connect_pct,required_pct}, kill{connect,booking,show}{pct,after,armed,floor,sample}, stats{…}, ladder[{step,label,window,voicemail,dials}] }` |
| `c.funnel` | `cf_campaign_funnel` | `{ rows[{metric, actual, conservative, target, stretch, sort_order}], stats{…} }` |
| `c.pipeline` | `cf_campaign_pipeline` | `{ members, sarah_total, ron_total, columns[{col, label, owner, hint, count, cards[]}] }` |
| `c.ladder` | `cf_campaign_ladder` | `{ cadence, rungs[{step,label,window,voicemail,waiting,due_now,dials,reached,booked,pickup_pct,booking_pct,note}], overdue[{lead_id,name,phone,step,due,late_minutes,reason}], overdue_count, checks[{rule,ok,detail}] }` |
| `c.shifts` | `cf_shifts` | `{ today{date,from,to,cap,calls,reached,talks,booked,voicemails,failed,connect_pct,closed,ended_how}, days[…same + note] }` |
| `c.scores` | `cf_score_summary` | `{ calls_scored, awaiting_scoring, rules[{rule,label,scored,passed,not_applicable,pct}] }` |
| `c.findings` | `cf_score_findings` | `{ finding_count, findings[{rule,label,failures,of_applicable,pct_failing,guidance,examples[{evidence,note,call}],calls[]}] }` |
| `c.pool` | `cf_campaign_pool` | `{ total, eligible, breakdown{reason: count} }` |
| `c.events` | `cf_campaign_events` | `{ rows[{at,kind,detail}] }` — the pacer's decision log |
| `c.daily` | `cf_campaign_daily` | `{ rows[{day, dials, connects, meetings, …}] }` |
| `c.brief` | `cf_manager_brief_facts` | `{ generated_at, campaign, numbers, pacing, gate, kill, pipeline, handoff, today_so_far, yesterday, scorecard, worst_rules, recent_failures, needs_a_person }` |

`c.derived` — computed once, read by name:
`eligible · worked · remaining · dayOf · perDay · daysLeft · dialingNow · status · halted · isLive · sarahTotal · ronTotal`

`c.refresh(key)` reloads one feed. `c.refreshAll()` reloads everything.

Non-shared reads (paged or on demand, from `useCampaign`):
`fetchMembers(args)` · `fetchCall(vapiCallId)` · `fetchExport(args)` · `fetchLead(leadId)` · `campaignControl(action)`

## Props every tab receives

```js
{ goTo, openLead, openExport, control, busy, search }
```

- `goTo('targets')` — switch tab. The Overview traffic-light strip uses this.
- `openLead(leadId)` — opens the lead drawer from anywhere.
- `control('start'|'pause'|'resume'|'clear_halt', 'toast text')` — the only write.
- `busy` — a control call is in flight; disable buttons.
- `search` — the top-bar search text, for tabs that filter on it.

## Helpers

From `../format`: `num · pct · money · gap · toneFor · TONE_VAR · widthPct ·
fmtTime · fmtDay · fmtDow · fmtWhen · dur · ago · humanise · DUBAI`

From `../bits`: `Feed · Loading · Failed · Empty · SectionHead · Eyebrow · Dot ·
Bar · Big · Chip · OutcomePill · Handoff · LiveDot`

## Reality check

The campaign is in **`draft`**. Nothing has dialled. On a real load today:
`stats.dials = 0`, `funnel.rows[].actual = 0`, `pipeline` has 3 members,
`shifts.days = []`, `ladder.rungs[].pickup_pct = null`, `scores` has 25 real
calls scored from historical traffic, `findings` has 2.

**Build for that, not for the mock's 3,184 calls.** A tab that only looks right
with full data is a tab that looks broken on launch day.

## Committing

Commit your own files as soon as they build. An uncommitted working tree is the
only copy, and this repo has lost a day's frontend to exactly that once already.
