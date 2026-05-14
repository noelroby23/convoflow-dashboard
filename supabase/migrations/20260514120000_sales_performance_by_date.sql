create or replace function public.sales_performance_by_date(
  start_date date default null,
  end_date date default null,
  p_client_id uuid default null
)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  with filtered_contacts as (
    select ct.id, ct.client_id, ccs.current_stage, ccs.assigned_to, ccs.deal_value
    from contacts ct
    join contact_current_status ccs on ccs.contact_id = ct.id
    where ct.is_test = false
      and coalesce(ct.is_comment_lead, false) = false
      and (p_client_id is null or ct.client_id = p_client_id)
      and (
        start_date is null or end_date is null
        or (coalesce(ct.ghl_created_at, ct.created_at) at time zone 'Asia/Dubai')::date
           between start_date and end_date
      )
  ),
  team_totals as (
    select
      count(*) filter (where current_stage in ('meeting_booked','showed','no_show','active','closed_won','closed_lost')) as meetings_scheduled,
      count(*) filter (where current_stage in ('showed','active','closed_won','closed_lost')) as shows,
      count(*) filter (where current_stage = 'no_show') as no_shows,
      count(*) filter (where current_stage = 'closed_won') as closes,
      count(*) filter (where current_stage in ('disqualified','wrong_number')) as disqualified,
      count(*) filter (where current_stage in ('closed_lost','not_interested')) as lost_not_interested,
      coalesce(sum(deal_value) filter (where current_stage = 'closed_won'), 0) as revenue_closed
    from filtered_contacts
  ),
  per_rep as (
    select
      coalesce(m.full_name, fc.assigned_to) as sales_rep,
      min(m.email) as sales_rep_email,
      count(*) filter (where current_stage in ('meeting_booked','showed','no_show','active','closed_won','closed_lost')) as meetings_scheduled,
      count(*) filter (where current_stage in ('showed','active','closed_won','closed_lost')) as shows,
      count(*) filter (where current_stage = 'no_show') as no_shows,
      count(*) filter (where current_stage = 'closed_won') as closes,
      coalesce(sum(deal_value) filter (where current_stage = 'closed_won'), 0) as revenue_closed
    from filtered_contacts fc
    left join ghl_user_map m on m.ghl_user_id = fc.assigned_to
    where fc.assigned_to is not null
    group by coalesce(m.full_name, fc.assigned_to)
  )
  select jsonb_build_object(
    'totals', (select to_jsonb(t.*) from team_totals t),
    'per_rep', coalesce((select jsonb_agg(to_jsonb(p.*) order by p.closes desc, p.shows desc) from per_rep p), '[]'::jsonb)
  );
$$;

grant execute on function public.sales_performance_by_date(date, date, uuid) to anon, authenticated;
