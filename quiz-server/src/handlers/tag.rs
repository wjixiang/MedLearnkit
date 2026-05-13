use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::error::AppError;
use crate::state::AppState;
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Debug, Deserialize)]
pub struct TagQuery {
    pub q: Option<String>,
    pub limit: Option<u32>,
}

/// Get list of tags
#[utoipa::path(
    get,
    path = "/api/tags",
    tag = "tags",
    params(
        ("q" = Option<String>, Query, description = "Search query", nullable),
        ("limit" = Option<u32>, Query, description = "Max results", nullable)
    ),
    responses(
        (status = 200, description = "List of tags")
    )
)]
pub async fn get_tags(
    State(state): State<AppState>,
    Query(query): Query<TagQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = query.limit.unwrap_or(10).min(50);
    let tags = state.quiz_repo.get_tags(query.q.as_deref(), limit).await?;
    Ok(Json(serde_json::to_value(tags).unwrap()))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddTagRequest {
    pub quiz_id: String,
    pub value: String,
    pub tag_type: Option<String>,
}

/// Add a tag to a quiz
#[utoipa::path(
    post,
    path = "/api/quizzes/{quiz_id}/tags",
    tag = "tags",
    params(
        ("quiz_id" = String, Path, description = "Quiz ID")
    ),
    request_body = AddTagRequest,
    responses(
        (status = 200, description = "Tag added")
    )
)]
pub async fn add_tag(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
    Json(req): Json<AddTagRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tag_type = req.tag_type.unwrap_or_else(|| "private".to_string());
    let id = state.quiz_repo.add_tag(&quiz_id, &req.value, &tag_type).await?;
    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

/// Delete a tag from a quiz
#[utoipa::path(
    delete,
    path = "/api/quizzes/{quiz_id}/tags/{tag_id}",
    tag = "tags",
    params(
        ("quiz_id" = String, Path, description = "Quiz ID"),
        ("tag_id" = String, Path, description = "Tag ID")
    ),
    responses(
        (status = 200, description = "Tag deleted")
    )
)]
pub async fn delete_tag(
    State(state): State<AppState>,
    Path((_quiz_id, tag_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.quiz_repo.delete_tag(&tag_id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Get tags for a quiz
#[utoipa::path(
    get,
    path = "/api/quizzes/{quiz_id}/tags",
    tag = "tags",
    params(
        ("quiz_id" = String, Path, description = "Quiz ID")
    ),
    responses(
        (status = 200, description = "Tags retrieved")
    )
)]
pub async fn get_quiz_tags(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tags = state.quiz_repo.get_quiz_tags(&quiz_id).await?;
    Ok(Json(serde_json::to_value(tags).unwrap()))
}