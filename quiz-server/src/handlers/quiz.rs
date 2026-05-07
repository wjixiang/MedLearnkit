use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::db::DbPool;
use crate::error::AppError;
use crate::services::quiz_service::{QuizFilter, QuizService};

pub async fn get_quizzes(
    State(pool): State<DbPool>,
    Query(filter): Query<QuizFilter>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = QuizService::get_quizzes(&pool, &filter)?;
    Ok(Json(serde_json::to_value(result).unwrap()))
}

pub async fn get_filter_meta(
    State(pool): State<DbPool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let meta = QuizService::get_filter_meta(&pool)?;
    Ok(Json(serde_json::to_value(meta).unwrap()))
}

pub async fn search_quizzes(
    State(pool): State<DbPool>,
    Query(filter): Query<QuizFilter>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = QuizService::search_quizzes(&pool, &filter)?;
    Ok(Json(serde_json::to_value(result).unwrap()))
}

pub async fn get_quiz_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let quiz = QuizService::get_quiz_by_id(&pool, &id)?;
    Ok(Json(serde_json::to_value(quiz).unwrap()))
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
    State(pool): State<DbPool>,
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
    };
    let limit = query.limit.unwrap_or(10).min(50);
    let quizzes = QuizService::get_random_quizzes(&pool, &filter, limit)?;
    Ok(Json(serde_json::to_value(quizzes).unwrap()))
}
