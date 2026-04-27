create or replace function public.dashboard_kpis(
  start_date date,
  end_date date,
  p_client_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_spend numeric := 0;
  v_total_leads bigint := 0;
  v_meetings_booked bigint := 0;
  v_showed_up bigint := 0;
  v_active_opportunities bigint := 0;
  v_closed_won bigint := 0;
  v_closed_lost bigint := 0;
  v_no_shows bigint := 0;
  v_disqualified bigint := 0;
  v_not_interested bigint := 0;
  v_wrong_numbers bigint := 0;
  v_closed_revenue numeric := 0;
  v_pipeline_value numeric := 0;
begin
  select coalesce(sum(adm.spend), 0)
  into v_total_spend
  from ad_daily_metrics adm
  join ads a on a.id = adm.ad_id
  where adm.date between start_date and end_date
    and (p_client_id is null or a.client_id = p_client_id);

  with filtered_contacts as (
    select
      c.id,
      coalesce(c.ghl_created_at, c.created_at)::date as contact_date,
      coalesce(ccs.current_stage, ccs.mainflow_stage) as stage,
      ccs.deal_value
    from contacts c
    join contact_current_status ccs on ccs.contact_id = c.id
    where coalesce(c.is_test, false) = false
      and coalesce(c.ghl_created_at, c.created_at)::date between start_date and end_date
      and (p_client_id is null or c.client_id = p_client_id)
  )
  select
    count(*)::bigint,
    count(*) filter (where stage in ('meeting_booked', 'showed', 'no_show', 'active', 'closed_won', 'closed_lost'))::bigint,
    count(*) filter (where stage in ('showed', 'active', 'closed_won', 'closed_lost'))::bigint,
    count(*) filter (where stage = 'active')::bigint,
    count(*) filter (where stage = 'closed_won')::bigint,
    count(*) filter (where stage = 'closed_lost')::bigint,
    count(*) filter (where stage = 'no_show')::bigint,
    count(*) filter (where stage = 'disqualified')::bigint,
    count(*) filter (where stage = 'not_interested')::bigint,
    count(*) filter (where stage = 'wrong_number')::bigint,
    coalesce(sum(deal_value) filter (where stage = 'closed_won'), 0),
    coalesce(sum(deal_value) filter (where stage = 'active'), 0)
  into
    v_total_leads,
    v_meetings_booked,
    v_showed_up,
    v_active_opportunities,
    v_closed_won,
    v_closed_lost,
    v_no_shows,
    v_disqualified,
    v_not_interested,
    v_wrong_numbers,
    v_closed_revenue,
    v_pipeline_value
  from filtered_contacts;

  return jsonb_build_object(
    'total_spend', v_total_spend,
    'total_leads', v_total_leads,
    'meetings_booked', v_meetings_booked,
    'showed_up', v_showed_up,
    'active_opportunities', v_active_opportunities,
    'closed_won', v_closed_won,
    'closed_lost', v_closed_lost,
    'no_shows', v_no_shows,
    'disqualified', v_disqualified,
    'not_interested', v_not_interested,
    'wrong_numbers', v_wrong_numbers,
    'closed_revenue', v_closed_revenue,
    'pipeline_value', v_pipeline_value,
    'cost_per_lead', case when v_total_leads > 0 then v_total_spend / v_total_leads else 0 end,
    'cost_per_meeting', case when v_meetings_booked > 0 then v_total_spend / v_meetings_booked else 0 end,
    'cost_per_active', case when v_active_opportunities > 0 then v_total_spend / v_active_opportunities else 0 end,
    'show_rate', case when v_meetings_booked > 0 then (v_showed_up::numeric / v_meetings_booked::numeric) * 100 else 0 end,
    'meeting_rate', case when v_total_leads > 0 then (v_meetings_booked::numeric / v_total_leads::numeric) * 100 else 0 end,
    'roas', case when v_total_spend > 0 then v_closed_revenue / v_total_spend else 0 end
  );
end;
$$;

grant execute on function public.dashboard_kpis(date, date, uuid) to anon, authenticated, service_role;

create or replace function public.sarah_stage_summary(
  start_date date default null,
  end_date date default null,
  p_client_id uuid default null
)
returns table(stage text, count bigint, label text)
language sql
stable
security definer
set search_path = public
as $$
  with filtered_contacts as (
    select
      coalesce(ccs.current_stage, ccs.mainflow_stage) as current_stage
    from contacts c
    join contact_current_status ccs on ccs.contact_id = c.id
    where coalesce(c.is_test, false) = false
      and (p_client_id is null or c.client_id = p_client_id)
      and (
        start_date is null
        or end_date is null
        or coalesce(c.ghl_created_at, c.created_at)::date between start_date and end_date
      )
  ),
  stage_counts as (
    select
      current_stage as stage,
      count(*)::bigint as count,
      case current_stage
        when 'follow_up' then 'Follow Up'
        when 'contacted' then 'Contacted'
        when 'callback' then 'Callback'
        when 'qualified_no_meeting' then 'Qualified No Meeting'
        when 'meeting_booked' then 'Meeting Booked'
        when 'no_show' then 'No Show'
        when 'not_interested' then 'Not Interested'
        when 'disqualified' then 'Disqualified'
        when 'wrong_number' then 'Wrong Number'
        else initcap(replace(current_stage, '_', ' '))
      end as label,
      case current_stage
        when 'follow_up' then 1
        when 'contacted' then 2
        when 'callback' then 3
        when 'qualified_no_meeting' then 4
        when 'meeting_booked' then 5
        when 'no_show' then 6
        when 'not_interested' then 7
        when 'disqualified' then 8
        when 'wrong_number' then 9
        else 99
      end as sort_order
    from filtered_contacts
    where current_stage in (
      'follow_up', 'contacted', 'callback', 'qualified_no_meeting', 'meeting_booked',
      'no_show', 'not_interested', 'disqualified', 'wrong_number'
    )
    group by current_stage
  ),
  funnel_rows as (
    select '_funnel_meetings_booked'::text as stage, count(*)::bigint as count, 'Total Meetings Booked'::text as label, 100 as sort_order
    from filtered_contacts
    where current_stage in ('meeting_booked', 'showed', 'no_show', 'active', 'closed_won', 'closed_lost')

    union all

    select '_funnel_conversations'::text as stage, count(*)::bigint as count, 'Total Conversations'::text as label, 101 as sort_order
    from filtered_contacts
    where current_stage not in ('new', 'follow_up', 'wrong_number')
  )
  select combined.stage, combined.count, combined.label
  from (
    select stage, count, label, sort_order from stage_counts
    union all
    select stage, count, label, sort_order from funnel_rows
  ) combined
  order by combined.sort_order;
$$;

grant execute on function public.sarah_stage_summary(date, date, uuid) to anon, authenticated, service_role;
