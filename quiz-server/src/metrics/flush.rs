use sqlx::PgPool;
use chrono::Timelike;

use crate::state::AppState;

pub fn spawn_metrics_flush(state: AppState, pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = flush_metrics(&state, &pool).await {
                tracing::error!(error = %e, "Failed to flush metrics");
            }
        }
    });
}

async fn flush_metrics(state: &AppState, pool: &PgPool) -> Result<(), sqlx::Error> {
    let snapshot = state.metrics.drain();
    if snapshot.is_empty() {
        return Ok(());
    }

    let now = chrono::Utc::now();
    let bucket_time = now
        .with_second(0)
        .unwrap_or(now)
        .with_nanosecond(0)
        .unwrap_or(now);

    for (key, (count, total_duration_us)) in &snapshot {
        let total_duration_ms = *total_duration_us as f64 / 1000.0;

        sqlx::query(
            r#"INSERT INTO request_metrics (bucket_time, endpoint, method, status_code, request_count, total_duration_ms)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(bucket_time)
        .bind(&key.endpoint)
        .bind(&key.method)
        .bind(key.status_code as i16)
        .bind(*count as i32)
        .bind(total_duration_ms)
        .execute(pool)
        .await?;
    }

    tracing::debug!("Flushed {} metric entries", snapshot.len());
    Ok(())
}

pub fn spawn_daily_aggregation(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            if let Err(e) = aggregate_daily(&pool).await {
                tracing::error!(error = %e, "Failed to aggregate daily metrics");
            }
        }
    });
}

async fn aggregate_daily(pool: &PgPool) -> Result<(), sqlx::Error> {
    let today = chrono::Utc::now().date_naive();

    sqlx::query(
        r#"
        INSERT INTO daily_platform_metrics (metric_date, total_requests, total_errors, avg_response_ms, dau, new_registrations, quizzes_practiced, papers_created, discussions_created)
        SELECT
            $1::date,
            COALESCE(r.total_requests, 0),
            COALESCE(r.total_errors, 0),
            COALESCE(r.avg_response_ms, 0),
            COALESCE(u.dau, 0),
            COALESCE(u.new_regs, 0),
            COALESCE(p.practiced, 0),
            COALESCE(pp.created, 0),
            COALESCE(d.created, 0)
        FROM (SELECT
                SUM(request_count) as total_requests,
                SUM(request_count) FILTER (WHERE status_code >= 400) as total_errors,
                CASE WHEN SUM(request_count) > 0
                    THEN SUM(total_duration_ms) / SUM(request_count)::float
                    ELSE 0 END as avg_response_ms
              FROM request_metrics WHERE bucket_time::date = $1) r,
             (SELECT
                COUNT(*) FILTER (WHERE created_at::date = $1) as new_regs
              FROM users) u,
             (SELECT COUNT(DISTINCT user_id) as dau FROM practice_records WHERE created_at::date = $1) p,
             (SELECT COUNT(*) as created FROM user_papers WHERE created_at::date = $1) pp,
             (SELECT COUNT(*) as created FROM discussion_comments WHERE created_at::date = $1) d
        ON CONFLICT (metric_date) DO UPDATE SET
            total_requests = EXCLUDED.total_requests,
            total_errors = EXCLUDED.total_errors,
            avg_response_ms = EXCLUDED.avg_response_ms,
            dau = EXCLUDED.dau,
            new_registrations = EXCLUDED.new_registrations,
            quizzes_practiced = EXCLUDED.quizzes_practiced,
            papers_created = EXCLUDED.papers_created,
            discussions_created = EXCLUDED.discussions_created
        "#,
    )
    .bind(today)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO user_daily_activity (user_id, activity_date, practice_count, login_count)
        SELECT user_id, $1::date, COUNT(*), 0
        FROM practice_records
        WHERE created_at::date = $1
        GROUP BY user_id
        ON CONFLICT (user_id, activity_date) DO UPDATE SET
            practice_count = EXCLUDED.practice_count
        "#,
    )
    .bind(today)
    .execute(pool)
    .await?;

    Ok(())
}

pub fn spawn_metrics_cleanup(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(86400));
        loop {
            interval.tick().await;
            if let Err(e) = cleanup_old_metrics(&pool).await {
                tracing::error!(error = %e, "Failed to clean up old metrics");
            }
        }
    });
}

async fn cleanup_old_metrics(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM request_metrics WHERE created_at < NOW() - INTERVAL '90 days'")
        .execute(pool)
        .await?;
    Ok(())
}
