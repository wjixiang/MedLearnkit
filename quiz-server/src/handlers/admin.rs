use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use utoipa::{IntoParams, ToSchema};

use crate::error::AppError;
use crate::state::AppState;

// === Response types ===

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminDashboardResponse {
    pub system: SystemHealthSnapshot,
    pub realtime: RealtimeMetrics,
    pub user_stats: UserStatsSnapshot,
    pub content_stats: ContentStatsSnapshot,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SystemHealthSnapshot {
    pub uptime_seconds: i64,
    pub started_at: String,
    pub total_requests: u64,
    pub total_errors: u64,
    pub avg_response_ms_today: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RealtimeMetrics {
    pub requests_per_minute: f64,
    pub error_rate_percent: f64,
    pub endpoints: Vec<EndpointMetricEntry>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EndpointMetricEntry {
    pub endpoint: String,
    pub method: String,
    pub request_count: u64,
    pub avg_duration_ms: f64,
    pub error_count: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserStatsSnapshot {
    pub total_users: i64,
    pub new_users_today: i64,
    pub new_users_this_week: i64,
    pub new_users_this_month: i64,
    pub dau: i64,
    pub wau: i64,
    pub mau: i64,
    pub user_growth: Vec<DailyCount>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ContentStatsSnapshot {
    pub total_quizzes: i64,
    pub quizzes_practiced_today: i64,
    pub quizzes_practiced_this_week: i64,
    pub total_papers: i64,
    pub papers_created_today: i64,
    pub total_public_papers: i64,
    pub total_discussions: i64,
    pub discussions_today: i64,
    pub practice_trend: Vec<DailyCount>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DailyCount {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct RequestMetricsQuery {
    pub days: Option<i32>,
    pub endpoint: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RequestMetricsResponse {
    pub metrics: Vec<RequestMetricBucket>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RequestMetricBucket {
    pub bucket_time: String,
    pub endpoint: String,
    pub method: String,
    pub request_count: i64,
    pub avg_duration_ms: f64,
    pub error_count: i64,
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct AdminUsersQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminUsersResponse {
    pub users: Vec<AdminUserItem>,
    pub total: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminUserItem {
    pub id: String,
    pub email: String,
    pub username: Option<String>,
    pub is_admin: bool,
    pub created_at: String,
    pub last_active_at: Option<String>,
    pub total_practices: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SystemHealthResponse {
    pub status: String,
    pub uptime_seconds: i64,
    pub version: String,
    pub database_connected: bool,
    pub started_at: String,
}

// === Handlers ===

#[utoipa::path(
    get,
    path = "/api/admin/dashboard",
    tag = "admin",
    security(("jwt_auth" = [])),
    responses((status = 200, description = "Dashboard data", body = AdminDashboardResponse))
)]
pub async fn get_dashboard(
    State(state): State<AppState>,
) -> Result<Json<AdminDashboardResponse>, AppError> {
    let pool = &state.pool;

    // System health
    let uptime = (chrono::Utc::now() - state.started_at).num_seconds();
    let total_requests = state.metrics.total_requests.load(std::sync::atomic::Ordering::Relaxed);
    let total_errors = state.metrics.total_errors.load(std::sync::atomic::Ordering::Relaxed);

    let today_metrics: Option<f64> = sqlx::query_scalar(
        r#"SELECT AVG(total_duration_ms / request_count) FROM request_metrics WHERE bucket_time::date = CURRENT_DATE AND request_count > 0"#,
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let system = SystemHealthSnapshot {
        uptime_seconds: uptime,
        started_at: state.started_at.to_rfc3339(),
        total_requests,
        total_errors,
        avg_response_ms_today: today_metrics.unwrap_or(0.0),
    };

    // Realtime
    let elapsed = state.metrics.elapsed_secs();
    let endpoint_metrics = state.metrics.snapshot();
    let requests_per_minute = if elapsed > 0.0 {
        total_requests as f64 / (elapsed / 60.0)
    } else {
        0.0
    };
    let error_rate_percent = if total_requests > 0 {
        (total_errors as f64 / total_requests as f64) * 100.0
    } else {
        0.0
    };
    let realtime = RealtimeMetrics {
        requests_per_minute: (requests_per_minute * 100.0).round() / 100.0,
        error_rate_percent: (error_rate_percent * 100.0).round() / 100.0,
        endpoints: endpoint_metrics
            .into_iter()
            .map(|m| EndpointMetricEntry {
                endpoint: m.endpoint,
                method: m.method,
                request_count: m.request_count,
                avg_duration_ms: (m.avg_duration_ms * 100.0).round() / 100.0,
                error_count: m.error_count,
            })
            .collect(),
    };

    // User stats
    let user_stats = fetch_user_stats(pool).await?;

    // Content stats
    let content_stats = fetch_content_stats(pool).await?;

    Ok(Json(AdminDashboardResponse {
        system,
        realtime,
        user_stats,
        content_stats,
    }))
}

#[utoipa::path(
    get,
    path = "/api/admin/metrics/realtime",
    tag = "admin",
    security(("jwt_auth" = [])),
    responses((status = 200, description = "Realtime metrics", body = RealtimeMetrics))
)]
pub async fn get_realtime_metrics(
    State(state): State<AppState>,
) -> Result<Json<RealtimeMetrics>, AppError> {
    let total_requests = state.metrics.total_requests.load(std::sync::atomic::Ordering::Relaxed);
    let total_errors = state.metrics.total_errors.load(std::sync::atomic::Ordering::Relaxed);
    let elapsed = state.metrics.elapsed_secs();

    let requests_per_minute = if elapsed > 0.0 {
        total_requests as f64 / (elapsed / 60.0)
    } else {
        0.0
    };
    let error_rate_percent = if total_requests > 0 {
        (total_errors as f64 / total_requests as f64) * 100.0
    } else {
        0.0
    };

    let endpoints = state
        .metrics
        .snapshot()
        .into_iter()
        .map(|m| EndpointMetricEntry {
            endpoint: m.endpoint,
            method: m.method,
            request_count: m.request_count,
            avg_duration_ms: (m.avg_duration_ms * 100.0).round() / 100.0,
            error_count: m.error_count,
        })
        .collect();

    Ok(Json(RealtimeMetrics {
        requests_per_minute: (requests_per_minute * 100.0).round() / 100.0,
        error_rate_percent: (error_rate_percent * 100.0).round() / 100.0,
        endpoints,
    }))
}

#[utoipa::path(
    get,
    path = "/api/admin/metrics/requests",
    tag = "admin",
    security(("jwt_auth" = [])),
    params(RequestMetricsQuery),
    responses((status = 200, description = "Request metrics", body = RequestMetricsResponse))
)]
pub async fn get_request_metrics(
    State(state): State<AppState>,
    Query(query): Query<RequestMetricsQuery>,
) -> Result<Json<RequestMetricsResponse>, AppError> {
    let days = query.days.unwrap_or(7).clamp(1, 90);
    let pool = &state.pool;

    let rows = sqlx::query(
        r#"
        SELECT
            date_trunc('hour', bucket_time)::text AS bucket_time,
            endpoint,
            method,
            SUM(request_count) AS request_count,
            CASE WHEN SUM(request_count) > 0
                THEN SUM(total_duration_ms) / SUM(request_count)::float
                ELSE 0 END AS avg_duration_ms,
            SUM(request_count) FILTER (WHERE status_code >= 400) AS error_count
        FROM request_metrics
        WHERE bucket_time >= NOW() - ($1 || ' days')::INTERVAL
            AND ($2::text IS NULL OR endpoint = $2)
        GROUP BY date_trunc('hour', bucket_time), endpoint, method
        ORDER BY bucket_time DESC
        LIMIT 1000
        "#,
    )
    .bind(days.to_string())
    .bind(&query.endpoint)
    .fetch_all(pool)
    .await?;

    let metrics = rows
        .into_iter()
        .map(|r| RequestMetricBucket {
            bucket_time: r.get("bucket_time"),
            endpoint: r.get("endpoint"),
            method: r.get("method"),
            request_count: r.get("request_count"),
            avg_duration_ms: (r.get::<f64, _>("avg_duration_ms") * 100.0).round() / 100.0,
            error_count: r.get("error_count"),
        })
        .collect();

    Ok(Json(RequestMetricsResponse { metrics }))
}

#[utoipa::path(
    get,
    path = "/api/admin/users/stats",
    tag = "admin",
    security(("jwt_auth" = [])),
    responses((status = 200, description = "User statistics", body = UserStatsSnapshot))
)]
pub async fn get_user_stats(
    State(state): State<AppState>,
) -> Result<Json<UserStatsSnapshot>, AppError> {
    let stats = fetch_user_stats(&state.pool).await?;
    Ok(Json(stats))
}

#[utoipa::path(
    get,
    path = "/api/admin/users",
    tag = "admin",
    security(("jwt_auth" = [])),
    params(AdminUsersQuery),
    responses((status = 200, description = "User list", body = AdminUsersResponse))
)]
pub async fn get_users(
    State(state): State<AppState>,
    Query(query): Query<AdminUsersQuery>,
) -> Result<Json<AdminUsersResponse>, AppError> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;
    let search_pattern = query.search.as_deref().map(|s| format!("%{}%", s));
    let pool = &state.pool;

    let count_row = sqlx::query(
        r#"SELECT COUNT(*) as total FROM users
           WHERE $1::text IS NULL OR email ILIKE $1 OR username ILIKE $1"#,
    )
    .bind(&search_pattern)
    .fetch_one(pool)
    .await?;

    let total: i64 = count_row.get("total");

    let rows = sqlx::query(
        r#"
        SELECT
            u.id, u.email, u.username, u.is_admin, u.created_at,
            MAX(pr.created_at) AS last_active_at,
            COUNT(pr.id) AS total_practices
        FROM users u
        LEFT JOIN practice_records pr ON pr.user_id = u.id
        WHERE ($1::text IS NULL OR u.email ILIKE $1 OR u.username ILIKE $1)
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search_pattern)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let users = rows
        .into_iter()
        .map(|r| AdminUserItem {
            id: r.get::<uuid::Uuid, _>("id").to_string(),
            email: r.get("email"),
            username: r.get("username"),
            is_admin: r.get("is_admin"),
            created_at: r
                .get::<Option<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>>, _>(
                    "created_at",
                )
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            last_active_at: r
                .get::<Option<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>>, _>(
                    "last_active_at",
                )
                .map(|dt| dt.to_rfc3339()),
            total_practices: r.get("total_practices"),
        })
        .collect();

    Ok(Json(AdminUsersResponse { users, total }))
}

#[utoipa::path(
    get,
    path = "/api/admin/content/stats",
    tag = "admin",
    security(("jwt_auth" = [])),
    responses((status = 200, description = "Content statistics", body = ContentStatsSnapshot))
)]
pub async fn get_content_stats(
    State(state): State<AppState>,
) -> Result<Json<ContentStatsSnapshot>, AppError> {
    let stats = fetch_content_stats(&state.pool).await?;
    Ok(Json(stats))
}

#[utoipa::path(
    get,
    path = "/api/admin/system/health",
    tag = "admin",
    security(("jwt_auth" = [])),
    responses((status = 200, description = "System health", body = SystemHealthResponse))
)]
pub async fn get_system_health(
    State(state): State<AppState>,
) -> Result<Json<SystemHealthResponse>, AppError> {
    let db_connected = sqlx::query("SELECT 1")
        .execute(&state.pool)
        .await
        .is_ok();

    let uptime = (chrono::Utc::now() - state.started_at).num_seconds();

    Ok(Json(SystemHealthResponse {
        status: if db_connected {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        uptime_seconds: uptime,
        version: env!("CARGO_PKG_VERSION").to_string(),
        database_connected: db_connected,
        started_at: state.started_at.to_rfc3339(),
    }))
}

// === Helper functions ===

async fn fetch_user_stats(pool: &sqlx::PgPool) -> Result<UserStatsSnapshot, AppError> {
    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE) AS new_today,
            (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '6 days') AS new_week,
            (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '29 days') AS new_month
        "#,
    )
    .fetch_one(pool)
    .await?;

    let total_users: i64 = row.get("total_users");
    let new_users_today: i64 = row.get("new_today");
    let new_users_this_week: i64 = row.get("new_week");
    let new_users_this_month: i64 = row.get("new_month");

    // DAU/WAU/MAU from user_daily_activity (fallback to practice_records if no activity data)
    let activity_row = sqlx::query(
        r#"
        SELECT
            COUNT(DISTINCT user_id) FILTER (WHERE activity_date = CURRENT_DATE) AS dau,
            COUNT(DISTINCT user_id) FILTER (WHERE activity_date >= CURRENT_DATE - INTERVAL '6 days') AS wau,
            COUNT(DISTINCT user_id) FILTER (WHERE activity_date >= CURRENT_DATE - INTERVAL '29 days') AS mau
        FROM user_daily_activity
        WHERE activity_date >= CURRENT_DATE - INTERVAL '29 days'
        "#,
    )
    .fetch_one(pool)
    .await?;

    let dau: i64 = activity_row.get("dau");
    let wau: i64 = activity_row.get("wau");
    let mau: i64 = activity_row.get("mau");

    // User growth (last 30 days)
    let growth_rows = sqlx::query(
        r#"
        SELECT DATE(created_at)::text AS date, COUNT(*)::bigint AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
        "#,
    )
    .fetch_all(pool)
    .await?;

    let user_growth = growth_rows
        .into_iter()
        .map(|r| DailyCount {
            date: r.get("date"),
            count: r.get("count"),
        })
        .collect();

    Ok(UserStatsSnapshot {
        total_users,
        new_users_today,
        new_users_this_week,
        new_users_this_month,
        dau,
        wau,
        mau,
        user_growth,
    })
}

async fn fetch_content_stats(pool: &sqlx::PgPool) -> Result<ContentStatsSnapshot, AppError> {
    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM "Quiz") AS total_quizzes,
            (SELECT COUNT(*) FROM practice_records WHERE created_at::date = CURRENT_DATE) AS practiced_today,
            (SELECT COUNT(*) FROM practice_records WHERE created_at >= CURRENT_DATE - INTERVAL '6 days') AS practiced_week,
            (SELECT COUNT(*) FROM user_papers) AS total_papers,
            (SELECT COUNT(*) FROM user_papers WHERE created_at::date = CURRENT_DATE) AS papers_today,
            (SELECT COUNT(*) FROM public_papers) AS total_public_papers,
            (SELECT COUNT(*) FROM discussion_comments) AS total_discussions,
            (SELECT COUNT(*) FROM discussion_comments WHERE created_at::date = CURRENT_DATE) AS discussions_today
        "#,
    )
    .fetch_one(pool)
    .await?;

    let practice_rows = sqlx::query(
        r#"
        SELECT DATE(created_at)::text AS date, COUNT(*)::bigint AS count
        FROM practice_records
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
        "#,
    )
    .fetch_all(pool)
    .await?;

    let practice_trend = practice_rows
        .into_iter()
        .map(|r| DailyCount {
            date: r.get("date"),
            count: r.get("count"),
        })
        .collect();

    Ok(ContentStatsSnapshot {
        total_quizzes: row.get("total_quizzes"),
        quizzes_practiced_today: row.get("practiced_today"),
        quizzes_practiced_this_week: row.get("practiced_week"),
        total_papers: row.get("total_papers"),
        papers_created_today: row.get("papers_today"),
        total_public_papers: row.get("total_public_papers"),
        total_discussions: row.get("total_discussions"),
        discussions_today: row.get("discussions_today"),
        practice_trend,
    })
}
