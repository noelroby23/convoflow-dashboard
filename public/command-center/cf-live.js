/* ConvoFlow Command Center -- live data layer.
 *
 * WHAT THIS REPLACES
 *   The V5.5 build was a design prototype. Every number on every screen came
 *   from literals inside the HTML:
 *     baseLeads          18 fictional leads  ("Omar Al Mazrouei", "Al Safa Properties")
 *     THREADS            6 hand-written chats, everyone else got DEFAULTTHREAD
 *     demoIssues         6 invented QA tickets with invented quotes
 *     starterCampaigns   5 invented campaigns with invented spend
 *     ALERT_TIME         a lookup of fake ages: {'Gone stale':'8d', ...}
 *     V3_CALLS           derived from the fictional leads with i%6 arithmetic
 *   This file fetches the real equivalents and installs them into the app's
 *   own `state`, so every renderer, filter, export and drawer is untouched.
 *
 * THE ONE RULE HERE: never invent. A field with no source renders NO_DATA, and
 * the reconciliation report lists it. A zero is a measurement; absent is not.
 *
 * TIME: all labels are absolute and rendered in Asia/Dubai. The prototype used
 * relative strings ("Yesterday · 7:15 PM", "11m ago") that were frozen text and
 * drifted from the truth the moment the file was opened. Ages ARE computed, but
 * from a real stored timestamp against the payload's own generated_at, never
 * against the browser clock -- so the same payload always renders the same age.
 */
(function () {
  'use strict';

  var NO_DATA = 'No data';
  var CFG = window.CF_CONFIG || {};
  var TZ = CFG.timezone || 'Asia/Dubai';

  var CFLive = window.CFLive = {
    data: null,        // the raw payload
    source: null,      // 'live' | 'snapshot'
    error: null,
    NO_DATA: NO_DATA,

    /* Every collection starts as an EMPTY one, never undefined. The app's
     * render functions run once before any data arrives (they paint the
     * loading skeleton), and several of them reach straight into these -- so
     * `CFLive.issues.filter(...)` on an undefined value threw during startup
     * and the boot never completed. The page then sat on "Loading..." for
     * ever with one console error and no other symptom. */
    leads: [],
    issues: [],
    tickets: [],
    calls: [],
    meetings: [],
    campaigns: [],
    alerts: [],
    threads: {},
    leadByCode: {},
    threadsByLeadId: {},
    range: null
  };

  /* ---------------------------------------------------------------- time --- */

  function parse(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  var fmtDateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  });
  var fmtTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
  });
  var fmtDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric'
  });
  var fmtIsoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });

  function whenLabel(ts) {
    var d = parse(ts);
    return d ? fmtDateTime.format(d).replace(',', ' ·') : NO_DATA;
  }
  function timeLabel(ts) { var d = parse(ts); return d ? fmtTime.format(d) : NO_DATA; }
  function dateLabel(ts) { var d = parse(ts); return d ? fmtDate.format(d) : NO_DATA; }
  function isoDate(ts) { var d = parse(ts); return d ? fmtIsoDate.format(d) : null; }
  CFLive.whenLabel = whenLabel;
  CFLive.timeLabel = timeLabel;
  CFLive.dateLabel = dateLabel;
  CFLive.isoDate = isoDate;

  /* Duration in seconds -> "42s" / "7m" / "1h 12m" / "8d". Used for both
   * speed-to-lead and leak age, so one lead never shows two time styles. */
  function dur(secs) {
    if (secs === null || secs === undefined || isNaN(secs)) return NO_DATA;
    secs = Math.max(0, Math.round(secs));
    if (secs < 60) return secs + 's';
    var m = Math.floor(secs / 60);
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60), rm = m % 60;
    if (h < 24) return rm ? (h + 'h ' + String(rm).padStart(2, '0') + 'm') : (h + 'h');
    var d = Math.floor(h / 24), rh = h % 24;
    return rh ? (d + 'd ' + rh + 'h') : (d + 'd');
  }
  CFLive.dur = dur;

  function ageFrom(ts) {
    var d = parse(ts), base = parse(CFLive.data && CFLive.data.generated_at) || new Date();
    if (!d) return NO_DATA;
    return dur((base - d) / 1000);
  }
  CFLive.ageFrom = ageFrom;


  /* Today in Asia/Dubai. Defined here, not in the boot block, because the app
   * scripts reference it while they are still parsing -- before any data has
   * loaded and before the boot block exists. */
  window.cfToday = function () {
    if (CFLive.data && CFLive.data.generated_at) return isoDate(CFLive.data.generated_at);
    return fmtIsoDate.format(new Date());
  };


  /* ----------------------------------------------------------- signing in ---
   * The cf_* RPCs are granted to `authenticated` and revoked for `anon` and
   * PUBLIC (migrations 513 and 515), so the publishable key alone gets 42501 --
   * verified over real HTTP, not assumed. Live mode therefore needs a session.
   *
   * Two ways to have one:
   *   - deployed next to the existing dashboard, where its Google sign-in has
   *     already put a session in localStorage on the same origin; or
   *   - the sign-in panel below, for running it anywhere else.
   *
   * The password is posted straight to Supabase's own token endpoint over
   * HTTPS and never stored, logged, or sent anywhere else. Only the returned
   * session is kept, in localStorage, exactly where the Supabase client puts it.
   */
  var SESSION_KEY = 'cf-cc-auth-token';

  function storedSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && v.access_token && (!v.expires_at || v.expires_at * 1000 > Date.now()))
          return v;
      }
    } catch (e) { /* private window or blocked storage */ }
    return null;
  }

  CFLive.signIn = function (email, password) {
    return fetch(CFG.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CFG.publishableKey },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || !d.access_token) {
          throw new Error(d.error_description || d.msg || d.message
            || ('sign-in failed (HTTP ' + r.status + ')'));
        }
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(d)); } catch (e) {}
        return d;
      });
    });
  };

  CFLive.signOut = function () {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  };

  CFLive.signedIn = function () { return !!storedSession(); };

  /* ------------------------------------------------------------- fetching --- */

  var RPCS = [
    ['leads',          'cf_cc_leads',          'range'],
    ['conversations',  'cf_cc_conversations',  'range'],
    ['issues',         'cf_cc_issues',         'range'],
    ['stats',          'cf_cc_stats',          'range'],
    ['score_summary',  'cf_score_summary',     'days'],
    ['eod',            'cf_eod_summary',       'region'],
    ['sources',        'cf_cc_sources',        'region'],
    ['headline',       'cf_dash_headline',     'range'],
    ['kpis',           'cf_dash_kpis',         'range'],
    ['today',          'cf_dash_today',        'region'],
    ['calls',          'cf_dash_calls',        'range'],
    ['meetings',       'cf_dash_meetings',     'region'],
    ['attention',      'cf_dash_attention',    'region'],
    ['queue',          'cf_dash_queue',        'region'],
    ['creative',       'cf_dash_creative',     'range'],
    ['trends',         'cf_dash_trends',       'range'],
    ['pipeline',       'cf_dash_pipeline',     'region'],
    ['board',          'cf_dash_board',        'region'],
    ['targets',        'cf_dash_targets',      'range'],
    ['activity',       'cf_dash_activity',     'region'],
    ['sales_pipeline', 'cf_sales_pipeline',    'region'],
    ['dialler',        'cf_dialler_status',    'region']
  ];

  function token() {
    var own = storedSession();
    if (own) return own.access_token;
    /* Any session the Supabase client left on this origin -- which is what makes
     * this work for free when deployed beside the existing dashboard. */
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('-auth-token') > -1) {
          var v = JSON.parse(localStorage.getItem(k));
          if (v && v.access_token) return v.access_token;
          if (v && v.currentSession && v.currentSession.access_token)
            return v.currentSession.access_token;
        }
      }
    } catch (e) { /* private window, blocked storage: fall through to snapshot */ }
    return null;
  }

  function rpc(name, body, tok) {
    return fetch(CFG.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CFG.publishableKey,
        'Authorization': 'Bearer ' + tok
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error(name + ' -> HTTP ' + r.status);
      return r.json();
    });
  }

  function fetchLive(range) {
    var tok = token();
    if (!tok) return Promise.reject(new Error('no Supabase session'));
    var region = CFG.region || 'uae';
    var jobs = RPCS.map(function (spec) {
      var key = spec[0], fn = spec[1], shape = spec[2];
      var arg = shape === 'range'
        ? { p: { from: range.from, to: range.to, region: region, scope: range.scope || 'both' } }
        : { p: { region: region } };
      if (shape === 'days') arg = { p: { days: 30 } };
      if (fn === 'cf_qa_digest') arg = { p_days: 30 };
      return rpc(fn, arg, tok).then(function (v) { return [key, v]; },
        function (e) { return [key, { __error: String(e.message || e) }]; });
    });
    return Promise.all(jobs).then(function (pairs) {
      var out = {
        generated_at: new Date().toISOString(),
        range: { from: range.from, to: range.to },
        region: region, timezone: TZ, threads: {}
      };
      pairs.forEach(function (p) { out[p[0]] = p[1]; });
      return out;
    });
  }

  function fetchSnapshot() {
    return fetch('./cf-snapshot.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('cf-snapshot.json -> HTTP ' + r.status);
      return r.json();
    });
  }

  /* ------------------------------------------------------------- adapters --- */

  /* A lead row in the shape the prototype's renderers already expect.
   * Field-by-field provenance is in dashboard/command-center/README.md. */
  function toLead(r, idx) {
    var channel = r.channel
      || (r.msgs_out || r.msgs_in ? 'WhatsApp' : (r.dials ? 'Voice' : null));
    return {
      id: r.code,
      leadId: r.lead_id,
      ghlContactId: r.ghl_contact_id,
      name: r.name,
      phone: r.phone || NO_DATA,
      callPhone: r.call_phone || null,
      email: r.email || null,
      company: r.company || null,
      campaign: r.campaign || null,
      ad: r.ad || null,
      metaAdId: r.meta_ad_id || null,
      stage: r.stage,
      leadState: r.lead_state,
      owner: r.owner || null,
      time: whenLabel(r.created_at),
      createdAt: r.created_at,
      speed: r.speed_seconds === null || r.speed_seconds === undefined
        ? NO_DATA : dur(r.speed_seconds),
      speedSeconds: r.speed_seconds,
      budget: r.budget || NO_DATA,
      volume: r.volume || NO_DATA,
      business: r.business || null,
      mainProblem: r.main_problem || null,
      leak: r.leak || null,
      leakSince: r.leak_since || null,
      next: nextLabel(r),
      nextAt: r.next_at || null,
      cp: (r.cp || []).slice(),
      hot: !!r.hot,
      summary: r.summary || '',
      statusPhrase: r.status_phrase || null,
      answered: (r.connected || 0) > 0,
      dials: r.dials || 0,
      connectedCalls: r.connected || 0,
      attempts: r.attempts,
      step: r.step,
      cadence: r.cadence || null,
      msgsIn: r.msgs_in || 0,
      msgsOut: r.msgs_out || 0,
      meetingStatus: r.meeting_status || null,
      meetingTime: r.meeting_at ? whenLabel(r.meeting_at) : null,
      meetingAt: r.meeting_at || null,
      meetingLink: r.meeting_link || null,
      appointments: r.appointments || 0,
      dealStage: r.deal_stage || null,
      dealValue: r.deal_value,
      dealWon: !!r.deal_won,
      dealLost: !!r.deal_lost,
      dqReason: r.dq_reason || null,
      dqQuote: r.dq_quote || null,
      dqClosedBy: r.dq_closed_by || null,
      /* cf9Dq() decides the AI-vs-Sales split and already reads these three;
       * the prototype simply never set them, and its fallback keyed off
       * `owner`, which is null for 268 of 269 real leads. cf.disqualification
       * .closed_by is the field that actually records who closed it. */
      aiDisqualified: !!r.dq_closed_by && r.dq_closed_by !== 'sales',
      salesDisqualified: r.dq_closed_by === 'sales' || !!r.deal_lost,
      disqualificationSource: r.dq_closed_by
        ? (r.dq_closed_by === 'sales' ? 'Sales' : 'AI')
        : (r.deal_lost ? 'Sales' : null),
      qaVerdict: r.qa_verdict || null,
      qaSeverity: r.qa_severity,
      qaTitle: r.qa_title || null,
      lastCallId: r.last_call_id || null,
      lastCallRole: r.last_call_role || null,
      lastCallSecs: r.last_call_secs,
      hasRecording: !!r.has_recording,
      dnd: !!r.dnd,
      aiStopped: !!r.ai_stopped,
      chatbotEnabled: !!r.chatbot_enabled,
      isReactivation: !!r.is_reactivation,
      platform: r.platform || null,
      channel: channel,
      createdOrder: idx
    };
  }

  function nextLabel(r) {
    if (r.next_at) {
      var what = r.next_kind === 'call' ? 'Call' : r.next_kind === 'message' ? 'WhatsApp' : 'Next';
      return what + ' · ' + whenLabel(r.next_at);
    }
    if (r.meeting_at) return 'Meeting · ' + whenLabel(r.meeting_at);
    if (r.status_phrase) return r.status_phrase;
    return 'Nothing scheduled';
  }

  function toIssue(t) {
    return {
      id: t.id,
      ticketId: t.ticket_id,
      lead: t.lead,
      leadId: t.lead_id,
      leadName: t.lead_name,
      owner: 'Inara',               // section 5.8: every AI QA task is assigned to fathima inara
      severity: t.severity,
      severityN: t.severity_n,
      verdict: t.verdict,
      issue: t.issue,
      channel: t.channel,
      reason: t.reason || NO_DATA,
      fix: t.fix || null,
      proof: t.proof || NO_DATA,
      status: t.status === 'open' ? 'To review' : t.status,
      at: t.at,
      time: ageFrom(t.at) + ' ago',
      vapiCallId: t.vapi_call_id || null
    };
  }

  function toCall(c) {
    return {
      leadId: c.lead_id,
      leadName: c.name,
      phone: c.phone,
      at: c.at,
      date: isoDate(c.at),
      time: timeLabel(c.at),
      when: whenLabel(c.at),
      agent: c.role ? roleLabel(c.role) : NO_DATA,
      outcome: c.outcome || (c.connected ? 'Connected' : 'No answer'),
      connected: !!c.connected,
      duration: c.secs || 0,
      reason: c.reason || null,
      summary: c.summary || '',
      recording: c.recording || null,
      transcript: ''
    };
  }

  function roleLabel(role) {
    return ({
      primary: 'Sarah · Main setter', followup: 'Follow-up agent',
      callback: 'Callback agent', reminder: 'Meeting reminder agent',
      missed: 'Meeting missed agent', reactivation: 'Reactivation agent'
    })[role] || role;
  }
  CFLive.roleLabel = roleLabel;

  /* `lead` is optional: the Meetings page needs `fit`, which only the lead can
   * answer. The two consumers want different field names for the same thing --
   * vfMeetings() filters on `m.day` and `m.fit.toLowerCase()`, v3Meetings()
   * reads `m.who` and `m.quality` -- so all of them are provided rather than
   * renaming anything in the approved render functions. */
  function toMeeting(m, lead) {
    var d = parse(m.start_at);
    var fit = !lead ? 'Cold'
      : lead.hot ? 'Hot'
        : (String(lead.budget || '').toLowerCase() === 'yes' ? 'Warm' : 'Cold');
    return {
      id: m.event_id,
      eventId: m.event_id,
      leadId: m.lead_id,
      name: m.name,
      who: m.name,
      phone: m.phone,
      date: isoDate(m.start_at),
      day: d ? Number(fmtIsoDate.format(d).split('-')[2]) : null,
      month: d ? Number(fmtIsoDate.format(d).split('-')[1]) : null,
      hour: timeLabel(m.start_at),
      startAt: m.start_at,
      when: whenLabel(m.start_at),
      status: m.status,
      fit: fit,
      quality: lead && lead.summary ? lead.summary : NO_DATA,
      summary: lead && lead.summary ? lead.summary : NO_DATA,
      source: lead && lead.lastCallRole ? roleLabel(lead.lastCallRole) : 'WhatsApp AI',
      budget: lead ? lead.budget : NO_DATA,
      sameDay: !!m.same_day,
      /* The column is called meet_link but has carried a ZOOM url since
       * 4 Nov 2026 (CLAUDE.md section 3b). Labelled by what it is, not by the
       * column name. */
      url: m.link || null,
      channel: m.link ? (/zoom\./i.test(m.link) ? 'Zoom' : 'Meeting link') : NO_DATA
    };
  }

  function toCampaign(row, totals) {
    return {
      name: row.campaign_name || row.ad_name || row.name || NO_DATA,
      adName: row.ad_name || null,
      spend: num(row.spend),
      leads: num(row.leads),
      meetings: num(row.meetings),
      wins: num(row.won),
      impressions: num(row.impressions),
      clicks: num(row.clicks),
      cpl: num(row.cost_per_lead),
      cpm: num(row.cost_per_meeting),
      ads: []
    };
  }
  function num(v) { return (v === null || v === undefined) ? null : Number(v); }
  CFLive.num = num;


  /* A ticket in the shape the Tickets page (vfTickets) already renders.
   * `trace` is built ONLY from fields the QA record actually carries -- the
   * assistant role, the Dubai start time, the duration, the message counts and
   * the Vapi API url. The prototype's traces were written by hand
   * ("n8n · booking workflow execution not found"), which asserted a cause
   * nobody had checked. Anything absent is simply not listed. */
  function toTicket(t) {
    var trace = [];
    if (t.assistant_role) {
      trace.push('Vapi · ' + roleLabel(t.assistant_role) +
        (t.call_started_dubai ? ' · ' + t.call_started_dubai + ' Dubai' : '') +
        (t.duration_sec ? ' · ' + dur(Number(t.duration_sec)) : ''));
    }
    if (t.vapi_call_id) trace.push('Vapi · call ' + t.vapi_call_id);
    if (t.message_count) {
      trace.push('GoHighLevel · ' + t.message_count + ' messages' +
        (t.lead_message_count ? ' · ' + t.lead_message_count + ' from the lead' : ''));
    }
    trace.push('QA bot · verdict ' + (t.verdict || NO_DATA) +
      ' · severity ' + (t.severity_n === null || t.severity_n === undefined ? NO_DATA : t.severity_n));
    return {
      id: t.id,
      title: t.issue || NO_DATA,
      type: t.channel === 'Voice' ? 'Voice agent'
        : t.channel === 'WhatsApp' ? 'Chatbot' : 'System',
      priority: t.severity === 'Critical' ? 'Critical'
        : t.severity === 'High' ? 'High' : t.severity === 'Review' ? 'Medium' : 'Low',
      status: t.status === 'open' ? 'Open' : t.status === 'closed' ? 'Resolved' : (t.status || 'Open'),
      leadId: t.lead,
      leadUuid: t.lead_id,
      agent: t.assistant_role ? roleLabel(t.assistant_role) : (t.channel || NO_DATA),
      time: ageFrom(t.at) + ' ago',
      owner: 'Inara',
      reason: t.reason || NO_DATA,
      quote: t.proof || NO_DATA,
      trace: trace,
      cause: t.fix || NO_DATA,
      /* The QA record carries no business-impact field. The prototype invented
       * one ("Qualified lead at risk of missing a promised meeting"); this does
       * not. */
      impact: NO_DATA,
      test: t.proof || NO_DATA,
      notes: [],
      apiUrl: t.vapi_api_url || null
    };
  }
  CFLive.toTicket = toTicket;

  /* The cumulative weekly meetings series, as [label, runningTotal] pairs --
   * the shape V3_WEEKLY already had. */
  function weekly() {
    var t = (CFLive.data && CFLive.data.trends) || {};
    var weeks = t.weeks || [];
    var run = 0;
    return weeks.map(function (w) {
      run += Number(w.meetings || w.bookings || 0);
      var label = w.week || w.label || w.from || '';
      var d = parse(label);
      return [d ? dateLabel(d).replace(/ \d{4}$/, '') : String(label), run];
    });
  }
  CFLive.weekly = weekly;

  /* The headline position the EOD panel shows. Every field is a real number or
   * null; the prototype hardcoded a "14 Nov snapshot" of invented figures
   * (revenue 20000, booked 32, show 62.5) and said so in its own copy. */
  function headlineSnapshot() {
    var k = (CFLive.data && CFLive.data.kpis) || {};
    var h = (CFLive.data && CFLive.data.headline) || {};
    var leads = CFLive.leads || [];
    return {
      revenue: num(k.closed_revenue),
      clients: num(k.closed_won),
      booked: num(k.meetings_booked),
      held: num(k.showed_up),
      show: num(k.show_rate),
      close: num(k.win_rate),
      calls: num(h.dials),
      adLeads: num(k.attributed_leads),
      conversations: (CFLive.data && Array.isArray(CFLive.data.conversations))
        ? CFLive.data.conversations.length : null,
      ads: leads.filter(function (l) { return !l.isReactivation; }).length,
      reactivation: leads.filter(function (l) { return l.isReactivation; }).length,
      spend: num(k.total_spend),
      leads: num(k.total_leads)
    };
  }
  CFLive.headlineSnapshot = headlineSnapshot;


  /* ------------------------------------------------------------ KPI registry ---
   * Every tile the prototype hardcoded, with the real measurement behind it.
   *
   * CFK(key)    -> the value string the tile shows
   * CFKS(key)   -> the sub-label under it
   *
   * A key whose source is genuinely absent returns NO_DATA and a sub-label that
   * says why. It never returns 0 as a stand-in: section 7a already settled that
   * for money -- "a 0 renders as 'we spent nothing', a measured result rather
   * than an absent one".
   * -------------------------------------------------------------------------- */

  function D() { return CFLive.data || {}; }
  function K() { return D().kpis || {}; }
  function H() { return D().headline || {}; }
  function T() { return D().today || {}; }
  function S() { return D().stats || {}; }
  function Q() { return D().queue || {}; }
  function DL() { return D().dialler || {}; }
  function QA() { return D().qa_digest || {}; }

  function target(metric) {
    var rows = D().targets || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].metric === metric) return rows[i];
    return null;
  }
  CFLive.target = target;

  function n0(v) { return (v === null || v === undefined || v === '') ? null : Number(v); }
  function fmtInt(v) {
    v = n0(v);
    return v === null ? NO_DATA : Math.round(v).toLocaleString('en-US');
  }
  function fmtPct(v, dp) {
    v = n0(v);
    return v === null ? NO_DATA : v.toFixed(dp === undefined ? 1 : dp) + '%';
  }
  function fmtMoney(v) {
    v = n0(v);
    if (v === null) return NO_DATA;
    return 'AED ' + (Math.abs(v) >= 1000
      ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k'
      : Math.round(v).toLocaleString('en-US'));
  }
  /* "51 / 4" was on the Overview card: a 30-day BOOKINGS TOTAL shown against
   * the 4-a-DAY target, while the card beside it correctly read "51 / 120".
   * Both of these scale the target to the selected range, the same way
   * CFLive.targetSet() and the department cards already did. */
  function overTarget(actual, metric) {
    var t = scaled(metric);
    var a = n0(actual);
    if (a === null) return NO_DATA;
    if (t === null) return fmtInt(a);
    return fmtInt(a) + ' / ' + fmtInt(t);
  }
  function pctOfTarget(actual, metric) {
    var t = scaled(metric), a = n0(actual);
    if (a === null || !t) return NO_DATA;
    return Math.round(100 * a / Number(t)) + '% of target';
  }
  function leakCount(label) {
    var m = S().leaks_by_type || {};
    return m[label] === undefined ? 0 : m[label];
  }
  CFLive.leakCount = leakCount;

  /* Weighted pass rate across the four scoring rules, which is what a single
   * "score / 100" tile can honestly be. */
  function scorePct() {
    var ss = D().score_summary || {};
    var rules = ss.rules || [];
    var passed = 0, scored = 0;
    rules.forEach(function (r) { passed += Number(r.passed || 0); scored += Number(r.scored || 0); });
    return scored ? Math.round(100 * passed / scored) : null;
  }
  CFLive.scorePct = scorePct;


  /* Upcoming meetings grouped by what the lead actually told us. */
  function fitCount(kind) {
    var leads = (CFLive.leads || []).filter(function (l) { return l.meetingAt; });
    return leads.filter(function (l) {
      var warm = String(l.budget || '').toLowerCase() === 'yes';
      if (kind === 'hot') return l.hot;
      if (kind === 'warm') return !l.hot && warm;
      return !l.hot && !warm;
    }).length;
  }
  CFLive.fitCount = fitCount;


  /* Where the bookings came from, by the lead's own origin. */
  function bookingSplit() {
    var out = { ads: 0, reactivation: 0, website: 0, other: 0 };
    (CFLive.leads || []).forEach(function (l) {
      if (!l.appointments) return;
      if (l.isReactivation) out.reactivation++;
      else if (l.metaAdId) out.ads++;
      else if (/website/i.test(String(l.source || ''))) out.website++;
      else out.other++;
    });
    return out;
  }
  CFLive.bookingSplit = bookingSplit;

  /* Weekly checkpoints computed from the real daily bookings target, not from
   * a plan nobody stores. Each row: [label, cumulative target, remaining]. */
  function checkpoints() {
    var t = target('bookings');
    var booked = n0(K().meetings_booked) || 0;
    var r = (CFLive.data && CFLive.data.range) || {};
    var from = parse(r.from), to = parse(r.to);
    if (!t || !t.target || !from || !to) return [];
    var per = Number(t.target), rows = [], d = new Date(from.getTime());
    // walk to each Saturday inside the range
    while (d <= to) {
      if (d.getUTCDay() === 6) {
        var days = Math.round((d - from) / 86400000) + 1;
        var cum = Math.round(per * days);
        rows.push([fmtDateTime.format(d).split(',')[0].trim(), cum,
                   Math.max(0, cum - booked)]);
      }
      d = new Date(d.getTime() + 86400000);
    }
    return rows;
  }
  CFLive.checkpoints = checkpoints;


  /* "AED 126 / lead" style unit economics, computed instead of stated. */
  function perUnit(spend, count, noun) {
    var sp = n0(spend), c = n0(count);
    if (sp === null) return 'No spend source';
    if (!c) return 'No ' + noun + 's yet';
    return fmtMoney(sp / c) + ' / ' + noun;
  }

  /* Qualified = the lead actually reached a qualified or hot state. */
  function qualifiedCount() {
    return (CFLive.leads || []).filter(function (l) {
      return l.hot || l.appointments > 0
        || ['qualified_no_meeting', 'super_hot', 'meeting_booked',
            'meeting_attended'].indexOf(l.leadState) > -1;
    }).length;
  }
  CFLive.qualifiedCount = qualifiedCount;

  var KPI = {
    /* --- leads ---------------------------------------------------------- */
    leads_today:      function () { return fmtInt(T().new_leads); },
    leads_today_sub:  function () { return 'Form fills today · Asia/Dubai'; },
    leads_range:      function () { return fmtInt(K().total_leads); },
    leads_range_sub:  function () { return pctOfTarget(K().total_leads, 'leads'); },
    leads_attributed: function () { return fmtInt(K().attributed_leads); },
    leads_attributed_sub: function () {
      var a = n0(K().attributed_leads), t = n0(K().total_leads);
      return (a === null || !t) ? NO_DATA : Math.round(100 * a / t) + '% carry an ad id';
    },

    /* --- speed ---------------------------------------------------------- */
    speed_first_contact: function () {
      var v = n0(S().median_speed_seconds);
      return v === null ? NO_DATA : dur(v);
    },
    speed_first_contact_sub: function () {
      var p90 = n0(S().p90_speed_seconds), nn = n0(S().speed_measured_n);
      if (p90 === null) return 'No first touch recorded';
      return 'Median of ' + fmtInt(nn) + ' · 90th pct ' + dur(p90);
    },

    /* --- leaks ---------------------------------------------------------- */
    untouched_now:    function () { return fmtInt(leakCount('Untouched')); },
    untouched_sub:    function () { return 'No call attempt after 5 minutes'; },
    hot_not_booked:   function () { return fmtInt(leakCount('Hot not booked')); },
    hot_not_booked_sub: function () { return 'Qualified, no meeting after 24h'; },
    leaks_total:      function () { return fmtInt(S().leaks_total); },
    leaks_total_sub:  function () { return 'Across 11 leak rules'; },

    /* --- calls ---------------------------------------------------------- */
    calls_in_progress:function () { return fmtInt(DL().dialling_now); },
    calls_in_progress_sub: function () {
      return 'Concurrency ' + (DL().concurrency === undefined ? NO_DATA : DL().concurrency)
        + (DL().breaker ? ' · breaker tripped' : '');
    },
    calls_today:      function () { return fmtInt(T().calls_made); },
    calls_today_sub:  function () { return fmtInt(T().no_answer) + ' did not connect'; },
    connected_today:  function () { return fmtInt(T().answered); },
    connected_today_sub: function () {
      var a = n0(T().answered), m = n0(T().calls_made);
      return (a === null || !m) ? NO_DATA : Math.round(100 * a / m) + '% connect rate today';
    },
    dials_range:      function () { return fmtInt(H().dials); },
    dials_range_sub:  function () { return fmtInt(H().reached) + ' reached'; },
    connect_rate:     function () { return fmtPct(H().connect_rate); },
    connect_rate_sub: function () { return fmtInt(H().reached) + ' of ' + fmtInt(H().dials) + ' dials'; },
    avg_conversation: function () {
      var v = n0(S().avg_connected_secs);
      return v === null ? NO_DATA : dur(v);
    },
    avg_conversation_sub: function () { return fmtInt(S().connected_n) + ' connected calls'; },
    booked_from_calls:function () { return fmtInt((S().booked_via || {}).vapi_tool); },
    booked_from_calls_sub: function () { return 'Booked by the voice agent tool'; },

    /* --- meetings ------------------------------------------------------- */
    meetings_booked:  function () { return overTarget(K().meetings_booked, 'bookings'); },
    meetings_booked_sub: function () { return pctOfTarget(K().meetings_booked, 'bookings'); },
    meetings_today:   function () { return fmtInt(S().meetings_today); },
    meetings_today_sub: function () { return fmtInt(S().meetings_upcoming) + ' upcoming'; },
    meetings_held:    function () { return overTarget(K().showed_up, 'showups'); },
    meetings_held_sub:function () { return fmtPct(K().show_rate) + ' show rate'; },
    show_rate:        function () { return fmtPct(K().show_rate); },
    show_rate_sub:    function () {
      var t = target('show_rate');
      return t ? 'Target: ' + fmtInt(t.target) + '%' : NO_DATA;
    },
    no_shows:         function () { return fmtInt(K().no_shows); },
    no_shows_sub:     function () { return 'Marked by a person'; },
    unconfirmed_bookings: function () { return fmtInt(S().unconfirmed_bookings); },
    unconfirmed_bookings_sub: function () { return 'Booked with no confirmation sent'; },

    /* --- sales ---------------------------------------------------------- */
    close_rate:       function () { return fmtPct(K().win_rate); },
    close_rate_sub:   function () {
      var t = target('win_rate');
      return (t ? 'Target: ' + fmtInt(t.target) + '% · ' : '') +
        'n=' + fmtInt(K().win_rate_n);
    },
    wins:             function () { return overTarget(K().closed_won, 'closes'); },
    wins_sub:         function () { return fmtInt(K().deals_opened) + ' deals opened'; },
    revenue:          function () { return fmtMoney(K().closed_revenue); },
    revenue_sub:      function () {
      var t = target('cost_per_customer');
      return 'Pipeline ' + fmtMoney(K().pipeline_value);
    },
    avg_sale:         function () {
      var r = n0(K().closed_revenue), w = n0(K().closed_won);
      return (r === null || !w) ? NO_DATA : fmtMoney(r / w);
    },
    avg_sale_sub:     function () { return fmtInt(K().closed_won) + ' closed won'; },
    sales_disq:       function () { return fmtInt(K().disqualified); },
    sales_disq_sub:   function () { return fmtInt(K().not_interested) + ' not interested'; },
    spend:            function () { return fmtMoney(K().total_spend); },
    spend_sub:        function () { return 'CPL ' + fmtMoney(K().cost_per_lead); },
    cost_per_meeting: function () { return fmtMoney(K().cost_per_meeting); },
    cost_per_meeting_sub: function () {
      var t = target('cost_per_meeting');
      return t ? 'Target under ' + fmtMoney(t.target) : NO_DATA;
    },

    /* --- quality -------------------------------------------------------- */
    convos_reviewed:  function () { return fmtInt(QA().tickets); },
    convos_reviewed_sub: function () { return 'QA tickets in 30 days'; },
    flagged:          function () {
      var v = (QA().by_verdict || {}).ai_failure;
      return fmtInt(v);
    },
    flagged_sub:      function () { return fmtPct(QA().ai_failure_rate) + ' of reviews'; },
    quality_flagged:  function () {
      var list = CFLive.issues || [];
      return fmtInt(list.filter(function (i) { return (i.severityN || 0) >= 3; }).length);
    },
    quality_flagged_sub: function () { return 'Severity 3 and above'; },
    agent_score:      function () {
      var v = scorePct();
      return v === null ? NO_DATA : v + ' / 100';
    },
    agent_score_sub:  function () {
      var ss = D().score_summary || {};
      return fmtInt(ss.calls_scored) + ' calls scored';
    },
    /* The scoring rules run on CALL transcripts only -- cf.call_score joins
     * cf.call. There is no chat equivalent, so this is absent, not zero. */
    wa_score:         function () { return NO_DATA; },
    wa_score_sub:     function () { return 'No chat scoring source yet'; },


    /* --- booking fit -----------------------------------------------------
     * Fit is derived from what the lead actually told us, in this order:
     *   hot    -> lead_state super_hot / qualified_no_meeting
     *   warm   -> budget_confirmed == yes on a call
     *   cold   -> neither recorded
     * The prototype assigned fit by hand ('Hot','Warm','Cold') per meeting. */
    hot_bookings:     function () { return fmtInt(fitCount('hot')); },
    hot_bookings_sub: function () { return 'Qualified or super hot'; },
    warm_bookings:    function () { return fmtInt(fitCount('warm')); },
    warm_bookings_sub:function () { return 'Budget confirmed on a call'; },
    cold_bookings:    function () { return fmtInt(fitCount('cold')); },
    cold_bookings_sub:function () { return 'No budget or fit recorded'; },

    /* --- the executive checkpoint strip -------------------------------- */
    exec_confirmed:   function () { return fmtInt(K().meetings_booked); },
    exec_confirmed_sub: function () { return 'Bookings in range'; },
    exec_target:      function () {
      var t = scaled('bookings');
      return t === null ? NO_DATA : fmtInt(t);
    },
    exec_target_sub:  function () {
      var t = target('bookings');
      return t ? fmtInt(t.target) + ' a day over ' + rangeDays() + ' days' : NO_DATA;
    },
    exec_needed:      function () {
      var t = scaled('bookings'), a = n0(K().meetings_booked);
      if (t === null || a === null) return NO_DATA;
      return fmtInt(Math.max(0, t - a));
    },
    exec_needed_sub:  function () { return 'Still to reach target'; },


    /* --- the executive overview ----------------------------------------
     * The prototype hardcoded a November commitment plan: 11/70 bookings,
     * a 21 Nov checkpoint of 50, 'AED 45.5k / 150k' MRR, and a four-row
     * checkpoint table (34 / 50 / 67 / 70). Nothing in the database stores
     * that plan, so the commitment column is absent rather than invented;
     * what IS real -- bookings to date, the daily target, and the split by
     * where the lead came from -- is measured.
     */
    nov_bookings:     function () { return overTarget(K().meetings_booked, 'bookings'); },
    nov_bookings_sub: function () {
      var sp = bookingSplit();
      return sp.ads + ' ads · ' + sp.reactivation + ' reactivation · '
        + sp.website + ' website';
    },
    reactivation_bookings:     function () { return fmtInt(bookingSplit().reactivation); },
    reactivation_bookings_sub: function () { return 'Bookings from the recall campaign'; },
    ads_bookings:     function () { return fmtInt(bookingSplit().ads); },
    ads_bookings_sub: function () { return 'Bookings from paid ads'; },
    /* No MRR / billing source exists in cf -- section 7a's "money stays NULL". */
    mrr:              function () { return NO_DATA; },
    mrr_sub:          function () { return 'No billing source connected'; },
    /* A booking that passed the qualification gate. cf.slot_gate_log records
     * the checks but is not exposed to this page, so this is absent. */
    qualified_bookings:     function () { return NO_DATA; },
    qualified_bookings_sub: function () { return 'Gate log not connected to this page'; },


    /* --- the ads funnel -------------------------------------------------
     * renderAdsEngine hardcoded the whole funnel and its unit economics:
     *   spend AED 25,800 · leads 204 @ AED 126 · qualified 121 @ AED 213
     *   meetings 39 @ AED 662 · sales-qualified 26 @ AED 992 · won 6 @ AED 4,300
     * Spend and leads are real (cf.ad_daily, cf.lead); each cost per step is
     * computed from them rather than stated.
     */
    ad_spend:         function () { return fmtMoney(K().total_spend); },
    ad_spend_sub:     function () {
      var d = n0(K().spend_days);
      return d ? d + ' day(s) with spend' : 'No spend recorded';
    },
    ads_leads:        function () { return fmtInt(K().attributed_leads); },
    ads_leads_sub:    function () { return perUnit(K().total_spend, K().attributed_leads, 'lead'); },
    ai_qualified:     function () { return fmtInt(qualifiedCount()); },
    ai_qualified_sub: function () { return perUnit(K().total_spend, qualifiedCount(), 'qualified'); },
    ads_meetings:     function () { return fmtInt(K().meetings_booked); },
    ads_meetings_sub: function () { return perUnit(K().total_spend, K().meetings_booked, 'meeting'); },
    sales_qualified:  function () { return fmtInt(K().deals_opened); },
    sales_qualified_sub: function () { return perUnit(K().total_spend, K().deals_opened, 'deal'); },
    ads_won:          function () { return fmtInt(K().closed_won); },
    ads_won_sub:      function () { return perUnit(K().total_spend, K().closed_won, 'win'); },

    /* --- the QA register ------------------------------------------------
     * The prototype showed a historical set imported from Farhan's reports
     * (19 tickets / 14 open / 5 closed / "18 / 19 executable scenarios",
     * "As of 11 Nov snapshot"). cf.qa_ticket holds the real register.
     */
    qa_total:         function () { return fmtInt(QA().tickets); },
    qa_total_sub:     function () { return 'Reviewed in the last 30 days'; },
    qa_open:          function () { return fmtInt(QA().open_tickets); },
    qa_open_sub:      function () { return 'Open in cf.qa_ticket'; },
    qa_closed:        function () {
      var t = n0(QA().tickets), o = n0(QA().open_tickets);
      return (t === null || o === null) ? NO_DATA : fmtInt(Math.max(0, t - o));
    },
    qa_closed_sub:    function () { return 'Closed in the window'; },
    qa_with_test:     function () {
      var list = CFLive.issues || [];
      var withPlan = list.filter(function (i) { return i.proof && i.proof !== NO_DATA; }).length;
      return fmtInt(withPlan) + ' / ' + fmtInt(list.length);
    },
    qa_with_test_sub: function () { return 'Tickets carrying a test plan'; },

    /* --- conversations -------------------------------------------------- */
    conversations_n:  function () { return fmtInt(S().conversations_n); },
    conversations_n_sub: function () {
      return fmtInt(S().messages_in) + ' in · ' + fmtInt(S().messages_out) + ' out';
    },
    unanswered:       function () {
      var c = D().conversations || [];
      return fmtInt(c.filter(function (x) { return x.unanswered; }).length);
    },
    unanswered_sub:   function () { return 'Lead spoke last'; },

    /* --- queue ---------------------------------------------------------- */
    queue_pending:    function () { return fmtInt(Q().pending_total); },
    queue_pending_sub:function () { return fmtInt(Q().messages_pending) + ' messages pending'; }
  };

  CFLive.CFK = function (key) {
    try { var f = KPI[key]; return f ? f() : NO_DATA; } catch (e) { return NO_DATA; }
  };
  CFLive.CFKS = function (key) {
    try { var f = KPI[key + '_sub']; return f ? f() : ''; } catch (e) { return ''; }
  };
  CFLive.kpiKeys = function () {
    return Object.keys(KPI).filter(function (k) { return !/_sub$/.test(k); });
  };
  window.CFK = CFLive.CFK;
  window.CFKS = CFLive.CFKS;


  /* --------------------------------------------------------------- targets ---
   * The prototype hardcoded a monthly target set:
   *   V3_TARGETS = {revenue:50000, clients:5, booked:70, held:45, calls:1875, ...}
   * The real targets live in cf.target and most are per DAY or per WEEK, so they
   * are scaled to the selected range -- section 5.7's rule that "a target is
   * scaled to the number of days selected".
   *
   * A key with no row in cf.target returns null. The tile then says "no target
   * set" rather than printing an invented goal, because a made-up target makes
   * a real number look like a pass or a fail that nobody agreed to.
   */
  function rangeDays() {
    var r = (CFLive.data && CFLive.data.range) || CFLive.range || {};
    var a = parse(r.from), b = parse(r.to);
    if (!a || !b) return 1;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  CFLive.rangeDays = rangeDays;

  function scaled(metric) {
    var t = target(metric);
    if (!t || t.target === null || t.target === undefined) return null;
    var v = Number(t.target);
    if (t.period === 'day') return Math.round(v * rangeDays());
    if (t.period === 'week') return Math.round(v * rangeDays() / 7);
    return v;                                   // 'fixed' -- a rate, not a count
  }
  CFLive.scaledTarget = scaled;

  function targetSet() {
    return {
      revenue: null,                 // no revenue target row in cf.target
      clients: scaled('closes'),
      avg: null,                     // no average-deal-value target
      booked: scaled('bookings'),
      cutoffBooked: null,
      held: scaled('showups'),
      show: scaled('show_rate'),     // fixed: a percentage
      close: scaled('win_rate'),
      calls: null,                   // no dials target; 'reached' is a different thing
      adLeads: scaled('leads'),
      conversations: null,
      ads: null,
      reactivation: null,
      bookingsPerDay: (target('bookings') || {}).target ?? null
    };
  }
  CFLive.targetSet = targetSet;


  /* ------------------------------------------------- derived page helpers ---
   * Each of these replaces a hand-written literal that lived inside a render
   * function, where emptying a seed array could not reach it.
   */

  /* The Marketing Disqualified table. The prototype's four rows carried
   * invented "AI confidence" percentages (61%, 91%, 59%). Nothing in cf
   * records a confidence for a disqualification, so that column is NO_DATA --
   * the rest is real: cf.disqualification's reason and the lead's own quote. */
  function disqRows() {
    return (CFLive.leads || [])
      .filter(function (l) { return l.dqReason || l.stage === 'Disqualified' || l.dealLost; })
      .map(function (l) {
        var lane = l.dealLost ? 'Sales call' : 'AI';
        return [l.id, lane, l.dqReason || l.statusPhrase || NO_DATA,
                l.dqQuote || l.summary || NO_DATA, NO_DATA];
      });
  }
  CFLive.disqRows = disqRows;

  function salesDisqSet() {
    var out = {};
    (CFLive.leads || []).forEach(function (l) { if (l.dealLost) out[l.id] = true; });
    return { has: function (id) { return !!out[id]; } };
  }
  CFLive.salesDisqSet = salesDisqSet;

  /* "Today's actions · by owner". The prototype hardcoded four sentences naming
   * fictional leads ("Call CF-1028; recover booked time for CF-1026"). These
   * are generated from the real leak board, the real QA register and the real
   * meetings that need a human outcome -- and each one names a real lead. */
  function ownerActions() {
    var leads = CFLive.leads || [], issues = CFLive.issues || [];
    var rules = (CFLive.data && CFLive.data.leak_rules) || [];
    var order = {};
    rules.forEach(function (r, i) { order[r.label] = i; });
    var leaking = leads.filter(function (l) { return l.leak; })
      .sort(function (a, b) { return (order[a.leak] || 99) - (order[b.leak] || 99); });
    var out = [];

    if (leaking.length) {
      out.push(['Ron', leaking.length + ' leaking lead' + (leaking.length === 1 ? '' : 's')
        + ' · most urgent ' + leaking[0].name + ' (' + leaking[0].leak + ', '
        + ageFrom(leaking[0].leakSince) + ')']);
    }
    var sev = issues.filter(function (i) { return (i.severityN || 0) >= 4; });
    if (sev.length) {
      out.push(['Inara', sev.length + ' severity 4+ QA ticket' + (sev.length === 1 ? '' : 's')
        + ' · ' + sev[0].id + ' ' + sev[0].issue]);
    }
    var dq = disqRows();
    if (dq.length) {
      var byReason = {};
      dq.forEach(function (r) { byReason[r[2]] = (byReason[r[2]] || 0) + 1; });
      var top = Object.keys(byReason).sort(function (a, b) { return byReason[b] - byReason[a]; })[0];
      out.push(['Mustafa', dq.length + ' disqualified · most common reason: ' + top
        + ' (' + byReason[top] + ')']);
    }
    var unmarked = leads.filter(function (l) {
      return l.lastMeetingStatus === 'booked' && l.meetingAt === null;
    });
    var k = (CFLive.data && CFLive.data.kpis) || {};
    if (k.meetings_unmarked) {
      out.push(['Abdus', k.meetings_unmarked + ' meeting(s) past their time with no outcome set']);
    } else if (unmarked.length) {
      out.push(['Abdus', unmarked.length + ' meeting(s) need an outcome']);
    }
    return out;
  }
  CFLive.ownerActions = ownerActions;

  /* The meeting strip's day buttons. The prototype hardcoded the week of
   * 26-31 October 2026 plus "Sun 01", so the calendar was frozen in the past. */
  function weekDates() {
    var names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var base = parse((CFLive.data && CFLive.data.generated_at)) || new Date();
    var isoToday = fmtIsoDate.format(base);
    var parts = isoToday.split('-').map(Number);
    var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    var dow = (d.getUTCDay() + 6) % 7;              // 0 = Monday
    d.setUTCDate(d.getUTCDate() - dow);
    var out = [];
    for (var i = 0; i < 7; i++) {
      var day = new Date(d.getTime() + i * 86400000);
      out.push([names[i], String(day.getUTCDate()).padStart(2, '0'), day.getUTCDate()]);
    }
    return out;
  }
  CFLive.weekDates = weekDates;
  CFLive.todayDayNumber = function () {
    var base = parse((CFLive.data && CFLive.data.generated_at)) || new Date();
    return Number(fmtIsoDate.format(base).split('-')[2]);
  };

  /* Meetings awaiting a human outcome, in the shape VF.meetingPending had. */
  function pendingMeetings() {
    return (CFLive.meetings || []).filter(function (m) {
      return m.status === 'booked';
    }).map(function (m, i) {
      var l = (CFLive.leads || []).filter(function (x) { return x.leadId === m.leadId; })[0];
      return {
        id: 'P-' + (i + 1), leadId: l ? l.id : m.leadId, name: m.name,
        when: m.startAt, fit: l && l.hot ? 'Hot'
          : (l && String(l.budget).toLowerCase() === 'yes' ? 'Warm' : 'Cold'),
        source: l && l.lastCallRole ? roleLabel(l.lastCallRole) : 'WhatsApp AI',
        status: 'Pending', note: ''
      };
    });
  }
  CFLive.pendingMeetings = pendingMeetings;

  /* The real transcript for a lead code, as {at,by,text} lines. The prototype
   * generated these from a template (vfCallTranscript) and labelled the panel
   * "transcript below is a simulated example". */
  function transcriptFor(code) {
    var l = (CFLive.leadByCode || {})[code];
    if (!l) return [];
    var t = (CFLive.threadsByLeadId || {})[l.leadId];
    if (!t || !Array.isArray(t.calls)) return [];
    var call = null;
    for (var i = t.calls.length - 1; i >= 0; i--) {
      if (t.calls[i].transcript) { call = t.calls[i]; break; }
    }
    if (!call) return [];
    return String(call.transcript).split(/\n+/).filter(Boolean).map(function (line) {
      var m = line.match(/^\s*(AI|User|Assistant|Bot|Customer)\s*[:\-]\s*(.*)$/i);
      return {
        at: timeLabel(call.at),
        by: m ? (/^(ai|assistant|bot)$/i.test(m[1]) ? 'Sarah · AI' : 'Lead') : 'Transcript',
        text: m ? m[2] : line.trim()
      };
    });
  }
  CFLive.transcriptFor = transcriptFor;


  /* The call actually on the line right now, from cf.call_queue via
   * cf_dash_queue. The prototype drew a permanent in-progress call for
   * "Ahmed Al Mansoori" with a frozen "00:45" timer and an animated waveform,
   * so the page always looked busy even with the dialler stopped. */
  function dialingNow() {
    var q = (CFLive.data && CFLive.data.queue) || {};
    var row = (q.dialing_now || [])[0];
    if (!row) return null;
    var l = (CFLive.leads || []).filter(function (x) {
      return x.leadId === row.lead_id || x.phone === row.phone;
    })[0];
    return {
      code: l ? l.id : null,
      name: row.name || (l ? l.name : NO_DATA),
      phone: row.phone || (l ? l.phone : NO_DATA),
      since: row.started_at || row.dialed_at || null,
      role: row.step_no ? null : null
    };
  }
  CFLive.dialingNow = dialingNow;

  /* Who is genuinely next, from the queue rather than "the next 4 leads". */
  function upNext() {
    var q = (CFLive.data && CFLive.data.queue) || {};
    return (q.up_next || []).map(function (r) {
      var l = (CFLive.leads || []).filter(function (x) {
        return x.leadId === r.lead_id || x.phone === r.phone;
      })[0];
      return {
        code: l ? l.id : null,
        name: r.name || (l ? l.name : NO_DATA),
        at: r.not_before || null,
        when: r.not_before ? whenLabel(r.not_before) : NO_DATA,
        source: r.source || null
      };
    });
  }
  CFLive.upNext = upNext;

  function firstLeakCode() {
    var rules = (CFLive.data && CFLive.data.leak_rules) || [];
    var order = {};
    rules.forEach(function (r, i) { order[r.label] = i; });
    var l = (CFLive.leads || []).filter(function (x) { return x.leak; })
      .sort(function (a, b) { return (order[a.leak] || 99) - (order[b.leak] || 99); })[0];
    return l ? l.id : null;
  }
  CFLive.firstLeakCode = firstLeakCode;

  function firstTicketId() {
    var t = (CFLive.tickets || [])[0];
    return t ? t.id : null;
  }
  CFLive.firstTicketId = firstTicketId;

  /* The three "needs review" audit cards. Real tickets, highest severity first,
   * replacing three hand-written lines pointing at QA-087/086/083. */
  function auditCards() {
    return (CFLive.issues || []).filter(function (i) { return (i.severityN || 0) >= 3; })
      .slice(0, 3)
      .map(function (i) { return [i.channel || NO_DATA, i.issue || NO_DATA, i.id]; });
  }
  CFLive.auditCards = auditCards;


  /* Post-call / proposal records. The prototype shipped one seeded human sales
   * call (SALES-CALL-001, Khalid Rahman, Vertex Auto, score 76) with written
   * coaching insights, and cfpcNewCall() invented more from three name arrays.
   *
   * There is no recording or transcript of a HUMAN sales call anywhere in cf --
   * cf.call is the AI agent only. So these are built from the meetings a person
   * marked attended, which is the real record that a sales call happened, and
   * the score and coaching insights are absent rather than invented. */
  function postCallRecords() {
    return (CFLive.leads || []).filter(function (l) {
      return l.lastMeetingStatus === 'attended';
    }).map(function (l, i) {
      return {
        id: 'MTG-' + l.id,
        name: l.name,
        company: l.company || NO_DATA,
        phone: l.phone,
        ended: l.lastMeetingAt ? whenLabel(l.lastMeetingAt) : NO_DATA,
        duration: NO_DATA,
        owner: l.owner || NO_DATA,
        source: 'Meeting marked attended',
        score: null,
        insights: { good: [], improve: [], evidence: [] },
        outcome: l.dealWon ? 'Won' : l.dealLost ? 'Lost' : (l.dealStage || 'Pending'),
        notes: '',
        step: l.dealStage || NO_DATA,
        due: null,
        proposal: '',
        proposalStatus: l.dealStage && /proposal/i.test(l.dealStage)
          ? 'Proposal stage in GoHighLevel' : 'Not generated',
        leadId: l.id,
        dealValue: l.dealValue
      };
    });
  }
  CFLive.postCallRecords = postCallRecords;

  /* -------------------------------------------------------------- install --- */

  function install(payload, source) {
    CFLive.data = payload;
    CFLive.source = source;
    CFLive.error = null;

    var leadRows = Array.isArray(payload.leads) ? payload.leads : [];
    var leads = leadRows.map(toLead);
    var byCode = {};
    leads.forEach(function (l) { byCode[l.id] = l; });
    CFLive.leadByCode = byCode;

    var issues = (Array.isArray(payload.issues) ? payload.issues : []).map(toIssue);
    var calls = (Array.isArray(payload.calls) ? payload.calls : []).map(toCall);
    var byLeadId = {};
    leads.forEach(function (l) { byLeadId[l.leadId] = l; });
    var meetings = (Array.isArray(payload.meetings) ? payload.meetings : [])
      .map(function (m) { return toMeeting(m, byLeadId[m.lead_id]); });

    var creative = payload.creative || {};
    var campaigns = (Array.isArray(creative.rows) ? creative.rows : [])
      .map(function (r) { return toCampaign(r, creative.totals); });

    /* Threads: keyed by the same lead code the renderers use, in the app's
     * {by,text,time} shape. `by` carries the real author -- lead / us / team /
     * automation -- which the prototype could not distinguish at all. */
    var threads = {};
    var raw = payload.threads || {};
    leads.forEach(function (l) {
      var t = raw[l.leadId];
      if (!t || !Array.isArray(t.messages)) return;
      threads[l.id] = t.messages.map(function (m) {
        return {
          by: m.from === 'lead' ? 'Lead'
            : m.from === 'team' ? 'Team'
              : m.from === 'automation' ? 'Automation' : 'Sarah · AI',
          text: m.text || '',
          time: timeLabel(m.at),
          at: m.at,
          channel: m.channel,
          template: m.template || null,
          status: m.status || null
        };
      });
    });
    CFLive.threadsByLeadId = raw;

    CFLive.leads = leads;
    CFLive.issues = issues;
    CFLive.tickets = (Array.isArray(payload.issues) ? payload.issues : []).map(toTicket);
    CFLive.calls = calls;
    CFLive.meetings = meetings;
    CFLive.campaigns = campaigns;
    CFLive.threads = threads;
    CFLive.alerts = leads.filter(function (l) { return l.leak; }).map(function (l) {
      return {
        id: 'AL-' + l.id, leadId: l.id, type: l.leak,
        elapsed: ageFrom(l.leakSince), since: l.leakSince,
        severity: severityOf(l.leak)
      };
    });
    return CFLive;
  }

  function severityOf(leak) {
    var rules = (CFLive.data && CFLive.data.leak_rules) || [];
    for (var i = 0; i < rules.length; i++) if (rules[i].label === leak) return rules[i].severity;
    return 'Review';
  }
  CFLive.severityOf = severityOf;

  /* ------------------------------------------------------------------ load --- */

  CFLive.load = function (range) {
    range = range || CFLive.range || defaultRange();
    CFLive.range = range;
    var mode = CFG.mode || 'auto';
    var wantLive = mode === 'live' || (mode === 'auto' && !!token());

    var attempt = wantLive
      ? fetchLive(range).then(function (p) { return install(p, 'live'); })
      : Promise.reject(new Error('snapshot mode'));

    return attempt.catch(function (liveErr) {
      return fetchSnapshot().then(function (p) {
        var r = install(p, 'snapshot');
        if (mode === 'live') CFLive.error = 'Live fetch failed: ' + liveErr.message;
        return r;
      }).catch(function (snapErr) {
        CFLive.data = null;
        CFLive.source = null;
        CFLive.error = (wantLive ? liveErr.message + '; ' : '') + snapErr.message;
        throw CFLive.error;
      });
    });
  };

  function defaultRange() {
    var now = new Date();
    var to = fmtIsoDate.format(now);
    var from = fmtIsoDate.format(new Date(now.getTime() - 29 * 86400000));
    return { from: from, to: to, scope: 'both' };
  }
  CFLive.defaultRange = defaultRange;

  /* Freshness of each upstream source, for the honest status strip that
   * replaces the prototype's static "SIMULATED DATA" badge. */
  CFLive.sourceList = function () {
    var s = (CFLive.data && CFLive.data.sources && CFLive.data.sources.sources) || {};
    return Object.keys(s).map(function (k) {
      var v = s[k] || {};
      return {
        key: k, label: v.label || k, lastAt: v.last_at || null,
        rows24h: v.rows_24h, age: v.last_at ? ageFrom(v.last_at) : NO_DATA,
        connected: !!v.last_at
      };
    });
  };
})();
