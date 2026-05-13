use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::error::AppError;
use crate::services::quiz_service::QuizFilter;
use crate::state::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct RandomQuery {
    pub limit: Option<u32>,
    pub types: Option<String>,
    pub classes: Option<String>,
    pub units: Option<String>,
    pub sources: Option<String>,
    pub years: Option<String>,
    pub search: Option<String>,
}

/// Get paginated list of quizzes
#[utoipa::path(
    get,
    path = "/api/quizzes",
    tag = "quizzes",
    params(
        ("filter" = QuizFilter, Query, description = "Quiz filter parameters")
    ),
    responses(
        (status = 200, description = "List of quizzes")
    )
)]
pub async fn get_quizzes(
    State(state): State<AppState>,
    Query(filter): Query<QuizFilter>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(20).min(100);

    if filter.include_details.unwrap_or(false) {
        let (quizzes, total) = state.quiz_repo.get_quizzes_with_details(&filter).await?;
        let total_pages = if total == 0 { 0 } else { (total + limit - 1) / limit };
        let result = serde_json::json!({
            "data": quizzes,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        });
        Ok(Json(result))
    } else {
        let (quizzes, total) = state.quiz_repo.get_quizzes(&filter).await?;
        let total_pages = if total == 0 { 0 } else { (total + limit - 1) / limit };
        let result = serde_json::json!({
            "data": quizzes,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        });
        Ok(Json(result))
    }
}

/// Get quizzes by IDs (batch)
#[utoipa::path(
    post,
    path = "/api/quizzes/batch",
    tag = "quizzes",
    request_body = crate::services::quiz_service::BatchIdsRequest,
    responses(
        (status = 200, description = "Quizzes retrieved")
    )
)]
pub async fn batch_get_quizzes(
    State(state): State<AppState>,
    Json(body): Json<crate::services::quiz_service::BatchIdsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.quiz_ids.is_empty() {
        return Ok(Json(serde_json::json!([])));
    }
    let quizzes = state.quiz_repo.get_quizzes_by_ids(&body.quiz_ids).await?;
    Ok(Json(serde_json::to_value(quizzes).unwrap()))
}

/// Get filter metadata for quizzes
#[utoipa::path(
    get,
    path = "/api/quizzes/filter-meta",
    tag = "quizzes",
    responses(
        (status = 200, description = "Filter metadata")
    )
)]
pub async fn get_filter_meta(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let meta = state.quiz_repo.get_filter_meta().await?;
    Ok(Json(serde_json::to_value(meta).unwrap()))
}

/// Search quizzes
#[utoipa::path(
    get,
    path = "/api/quizzes/search",
    tag = "quizzes",
    params(
        ("filter" = QuizFilter, Query, description = "Quiz filter parameters")
    ),
    responses(
        (status = 200, description = "Search results")
    )
)]
pub async fn search_quizzes(
    State(state): State<AppState>,
    Query(filter): Query<QuizFilter>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(20).min(100);

    let (quizzes, total) = state.quiz_repo.get_quizzes(&filter).await?;

    let total_pages = if total == 0 { 0 } else { (total + limit - 1) / limit };

    let result = serde_json::json!({
        "data": quizzes,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    });

    Ok(Json(result))
}

/// Get a quiz by ID
#[utoipa::path(
    get,
    path = "/api/quizzes/{id}",
    tag = "quizzes",
    params(
        ("id" = String, Path, description = "Quiz ID")
    ),
    responses(
        (status = 200, description = "Quiz retrieved"),
        (status = 404, description = "Quiz not found")
    )
)]
pub async fn get_quiz_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    match state.quiz_repo.get_quiz_by_id(&id).await? {
        Some(quiz) => Ok(Json(serde_json::to_value(quiz).unwrap())),
        None => Err(AppError::NotFound(format!("Quiz not found: {}", id))),
    }
}

/// Get random quizzes
#[utoipa::path(
    get,
    path = "/api/quizzes/random",
    tag = "quizzes",
    responses(
        (status = 200, description = "Random quizzes")
    )
)]
pub async fn get_random_quizzes(
    State(state): State<AppState>,
    Query(query): Query<RandomQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let filter = QuizFilter {
        types: query.types,
        classes: query.classes,
        units: query.units,
        sources: query.sources,
        years: query.years,
        search: query.search,
        page: None,
        limit: None,
        sort_by: None,
        order: None,
        include_details: None,
    };
    let limit = query.limit.unwrap_or(10).min(50);
    let quizzes = state.quiz_repo.get_random_quizzes(&filter, limit).await?;
    Ok(Json(serde_json::to_value(quizzes).unwrap()))
}