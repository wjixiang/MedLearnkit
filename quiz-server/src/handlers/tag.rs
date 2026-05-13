use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::error::AppError;
use crate::state::AppState;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TagQuery {
    pub q: Option<String>,
    pub limit: Option<u32>,
}

pub async fn get_tags(
    State(state): State<AppState>,
    Query(query): Query<TagQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = query.limit.unwrap_or(10).min(50);
    let tags = state.quiz_repo.get_tags(query.q.as_deref(), limit).await?;
    Ok(Json(serde_json::to_value(tags).unwrap()))
}

#[derive(Debug, Deserialize)]
pub struct AddTagRequest {
    pub quiz_id: String,
    pub value: String,
    pub tag_type: Option<String>,
}

pub async fn add_tag(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
    Json(req): Json<AddTagRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tag_type = req.tag_type.unwrap_or_else(|| "private".to_string());
    let id = state.quiz_repo.add_tag(&quiz_id, &req.value, &tag_type).await?;
    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn delete_tag(
    State(state): State<AppState>,
    Path((_quiz_id, tag_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.quiz_repo.delete_tag(&tag_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_quiz_tags(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tags = state.quiz_repo.get_quiz_tags(&quiz_id).await?;
    Ok(Json(serde_json::to_value(tags).unwrap()))
}