// Count order cohorts in Eastern time, including payments recorded after the cohort week.
export async function campaignConversions(pool, { start, end }) {
  const { rows } = await pool.query(`
    SELECT campaign_attribution->>'utm_source' AS source,
           campaign_attribution->>'utm_medium' AS medium,
           campaign_attribution->>'utm_campaign' AS campaign,
           campaign_attribution->>'utm_content' AS ad,
           count(*)::int AS preview_requests,
           count(*) FILTER (WHERE paid_at IS NOT NULL AND paypal_capture_id IS NOT NULL
                            AND price_amount > 0)::int AS paid_orders,
           count(*) FILTER (WHERE promo_completed_at IS NOT NULL
                            AND price_amount = 0)::int AS complimentary_orders
    FROM orders
    WHERE is_test = false
      AND created_at >= ($1::date::timestamp AT TIME ZONE 'America/New_York')
      AND created_at < (($2::date + 1)::timestamp AT TIME ZONE 'America/New_York')
    GROUP BY 1, 2, 3, 4
    ORDER BY 1 NULLS LAST, 2, 3, 4`, [start, end]);
  return rows;
}
