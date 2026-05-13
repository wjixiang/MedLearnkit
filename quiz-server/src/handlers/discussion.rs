use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::db::schema::{DiscussionCommentWithAuthor, DiscussionCommentWithReplies};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct GetCommentsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCommentRequest {
    pub content: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CommentResponse {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub parent_id: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<DiscussionCommentWithAuthor> for CommentResponse {
    fn from(c: DiscussionCommentWithAuthor) -> Self {
        Self {
            id: c.id,
            quiz_id: c.quiz_id,
            user_id: c.user_id,
            username: c.username,
            avatar_url: c.avatar_url,
            parent_id: c.parent_id,
            content: c.content,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CommentWithRepliesResponse {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub parent_id: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub replies: Vec<CommentResponse>,
}

impl From<DiscussionCommentWithReplies> for CommentWithRepliesResponse {
    fn from(c: DiscussionCommentWithReplies) -> Self {
        Self {
            id: c.comment.id,
            quiz_id: c.comment.quiz_id,
            user_id: c.comment.user_id,
            username: c.comment.username,
            avatar_url: c.comment.avatar_url,
            parent_id: c.comment.parent_id,
            content: c.comment.content,
            created_at: c.comment.created_at,
            updated_at: c.comment.updated_at,
            replies: c
                .replies
                .into_iter()
                .map(CommentResponse::from)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CommentsListResponse {
    pub data: Vec<CommentWithRepliesResponse>,
    pub total: i64,
    pub page: i32,
    pub limit: i32,
}

/// Get comments for a quiz
#[utoipa::path(
    get,
    path = "/api/quizzes/{quiz_id}/comments",
    tag = "discussions",
    params(
        ("quiz_id" = String, Path, description = "Quiz ID"),
        ("page" = Option<i32>, Query, description = "Page number"),
        ("limit" = Option<i32>, Query, description = "Items per page")
    ),
    responses(
        (status = 200, description = "Comments retrieved", body = CommentsListResponse)
    )
)]
pub async fn get_comments(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
    Query(query): Query<GetCommentsQuery>,
) -> Result<Json<CommentsListResponse>, AppError> {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100);
    let (comments, total) = state
        .quiz_repo
        .get_discussion_comments(&quiz_id, page, limit)
        .await?;
    Ok(Json(CommentsListResponse {
        data: comments
            .into_iter()
            .map(CommentWithRepliesResponse::from)
            .collect(),
        total,
        page,
        limit,
    }))
}

/// Create a comment on a quiz
#[utoipa::path(
    post,
    path = "/api/quizzes/{quiz_id}/comments",
    tag = "discussions",
    security(("bearer_auth" = [])),
    params(("quiz_id" = String, Path, description = "Quiz ID")),
    request_body = CreateCommentRequest,
    responses(
        (status = 200, description = "Comment created", body = CommentResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn create_comment(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(quiz_id): Path<String>,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<Json<CommentResponse>, AppError> {
    let content = payload.content.trim();
    if content.is_empty() {
        return Err(AppError::BadRequest("Content cannot be empty".to_string()));
    }
    if content.len() > 2000 {
        return Err(AppError::BadRequest(
            "Content cannot exceed 2000 characters".to_string(),
        ));
    }
    let comment = state
        .quiz_repo
        .create_discussion_comment(
            &quiz_id,
            &user_id,
            payload.parent_id.as_deref(),
            content,
        )
        .await?;
    Ok(Json(CommentResponse::from(comment)))
}

/// Delete a comment
#[utoipa::path(
    delete,
    path = "/api/quizzes/{quiz_id}/comments/{comment_id}",
    tag = "discussions",
    security(("bearer_auth" = [])),
    params(
        ("quiz_id" = String, Path, description = "Quiz ID"),
        ("comment_id" = String, Path, description = "Comment ID")
    ),
    responses(
        (status = 200, description = "Comment deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Comment not found")
    )
)]
pub async fn delete_comment(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path((_quiz_id, comment_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    state
        .quiz_repo
        .delete_discussion_comment(&comment_id, &user_id)
        .await?;
    Ok(Json(serde_json::json!({ "success": true })))
}
