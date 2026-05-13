use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::error::AppError;
use crate::services::quiz_service::QuizFilter;
use crate::state::AppState;

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

pub async fn get_filter_meta(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let meta = state.quiz_repo.get_filter_meta().await?;
    Ok(Json(serde_json::to_value(meta).unwrap()))
}

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

pub async fn get_quiz_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    match state.quiz_repo.get_quiz_by_id(&id).await? {
        Some(quiz) => Ok(Json(serde_json::to_value(quiz).unwrap())),
        None => Err(AppError::NotFound(format!("Quiz not found: {}", id))),
    }
}

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