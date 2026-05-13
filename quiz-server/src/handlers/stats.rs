use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::Datelike;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::db::schema::{CalendarDayData, DailyPracticeStats, PracticeSummary, SubjectPracticeStats};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct DailyStatsQuery {
    pub days: Option<i32>,
    pub class: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SubjectStatsQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SummaryQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CalendarQuery {
    pub year: Option<i32>,
}

/// Get daily practice statistics
#[utoipa::path(
    get,
    path = "/api/practices/stats/daily",
    tag = "practice-stats",
    security(("bearer_auth" = [])),
    params(
        ("days" = Option<i32>, Query, description = "Number of days (default 30)"),
        ("class" = Option<String>, Query, description = "Filter by quiz class/subject")
    ),
    responses(
        (status = 200, description = "Daily practice stats", body = Vec<DailyPracticeStats>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_daily_stats(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<DailyStatsQuery>,
) -> Result<Json<Vec<DailyPracticeStats>>, AppError> {
    let days = query.days.unwrap_or(30).clamp(1, 365);
    let class = query.class.as_deref();
    let stats = state
        .quiz_repo
        .get_practice_daily_stats(&user_id, days, class)
        .await?;
    Ok(Json(stats))
}

/// Get subject-level practice statistics
#[utoipa::path(
    get,
    path = "/api/practices/stats/subjects",
    tag = "practice-stats",
    security(("bearer_auth" = [])),
    params(
        ("days" = Option<i32>, Query, description = "Number of days (default 30)")
    ),
    responses(
        (status = 200, description = "Subject practice stats", body = Vec<SubjectPracticeStats>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_subject_stats(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<SubjectStatsQuery>,
) -> Result<Json<Vec<SubjectPracticeStats>>, AppError> {
    let days = query.days.unwrap_or(30).clamp(1, 365);
    let stats = state
        .quiz_repo
        .get_practice_subject_stats(&user_id, days)
        .await?;
    Ok(Json(stats))
}

/// Get practice summary
#[utoipa::path(
    get,
    path = "/api/practices/stats/summary",
    tag = "practice-stats",
    security(("bearer_auth" = [])),
    params(
        ("days" = Option<i32>, Query, description = "Number of days (default 30)")
    ),
    responses(
        (status = 200, description = "Practice summary", body = PracticeSummary),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_summary(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<SummaryQuery>,
) -> Result<Json<PracticeSummary>, AppError> {
    let days = query.days.unwrap_or(30).clamp(1, 365);
    let summary = state.quiz_repo.get_practice_summary(&user_id, days).await?;
    Ok(Json(summary))
}

/// Get calendar heatmap data
#[utoipa::path(
    get,
    path = "/api/practices/stats/calendar",
    tag = "practice-stats",
    security(("bearer_auth" = [])),
    params(
        ("year" = Option<i32>, Query, description = "Year (default current year)")
    ),
    responses(
        (status = 200, description = "Calendar heatmap data", body = Vec<CalendarDayData>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_calendar(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<Vec<CalendarDayData>>, AppError> {
    let year = query.year.unwrap_or_else(|| {
        chrono::Local::now().year()
    });
    let data = state
        .quiz_repo
        .get_practice_calendar(&user_id, year)
        .await?;
    Ok(Json(data))
}
