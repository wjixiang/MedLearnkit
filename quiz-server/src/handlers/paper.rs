use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::db::schema::{Paper, PublicPaper, UserPaper};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePaperRequest {
    pub title: String,
    pub quiz_ids: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateUserPaperRequest {
    pub title: String,
    pub quiz_ids: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserPaperRequest {
    pub title: String,
    pub quiz_ids: Vec<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaperResponse {
    pub id: String,
    pub title: String,
    pub quiz_ids: Vec<String>,
    pub created_at: String,
}

impl From<Paper> for PaperResponse {
    fn from(paper: Paper) -> Self {
        let quiz_ids: Vec<String> = serde_json::from_str(&paper.quiz_ids).unwrap_or_default();
        Self {
            id: paper.id,
            title: paper.title,
            quiz_ids,
            created_at: paper.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PublicPaperResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub quiz_ids: Vec<String>,
    pub quiz_count: i32,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
}

impl From<PublicPaper> for PublicPaperResponse {
    fn from(paper: PublicPaper) -> Self {
        Self {
            id: paper.id,
            title: paper.title,
            description: paper.description,
            quiz_ids: paper.quiz_ids,
            quiz_count: paper.quiz_count,
            source: paper.source,
            tags: paper.tags,
            created_at: paper.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserPaperResponse {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub quiz_ids: Vec<String>,
    pub quiz_count: i32,
    pub created_at: String,
}

impl From<UserPaper> for UserPaperResponse {
    fn from(paper: UserPaper) -> Self {
        Self {
            id: paper.id,
            user_id: paper.user_id,
            title: paper.title,
            description: paper.description,
            quiz_ids: paper.quiz_ids,
            quiz_count: paper.quiz_count,
            created_at: paper.created_at,
        }
    }
}

// Legacy paper endpoints (backward compatibility)

#[utoipa::path(
    post,
    path = "/api/papers",
    tag = "papers",
    request_body = CreatePaperRequest,
    responses(
        (status = 200, description = "Paper created", body = PaperResponse)
    )
)]
pub async fn create_paper(
    State(state): State<AppState>,
    Json(payload): Json<CreatePaperRequest>,
) -> Result<Json<PaperResponse>, AppError> {
    let paper = state
        .quiz_repo
        .create_paper(&payload.title, &payload.quiz_ids)
        .await?;
    Ok(Json(PaperResponse::from(paper)))
}

#[utoipa::path(
    get,
    path = "/api/papers",
    tag = "papers",
    responses(
        (status = 200, description = "Papers retrieved", body = Vec<PaperResponse>)
    )
)]
pub async fn get_papers(
    State(state): State<AppState>,
) -> Result<Json<Vec<PaperResponse>>, AppError> {
    let papers = state.quiz_repo.get_papers().await?;
    let responses: Vec<PaperResponse> = papers.into_iter().map(PaperResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/api/papers/{id}",
    tag = "papers",
    params(
        ("id" = String, Path, description = "Paper ID")
    ),
    responses(
        (status = 200, description = "Paper retrieved", body = PaperResponse),
        (status = 404, description = "Paper not found")
    )
)]
pub async fn get_paper_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PaperResponse>, AppError> {
    let paper = state.quiz_repo.get_paper_by_id(&id).await?;
    match paper {
        Some(p) => Ok(Json(PaperResponse::from(p))),
        None => Err(AppError::NotFound(format!("Paper not found: {}", id))),
    }
}

#[utoipa::path(
    delete,
    path = "/api/papers/{id}",
    tag = "papers",
    params(
        ("id" = String, Path, description = "Paper ID")
    ),
    responses(
        (status = 204, description = "Paper deleted")
    )
)]
pub async fn delete_paper(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    state.quiz_repo.delete_paper(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// Public papers endpoints

#[utoipa::path(
    get,
    path = "/api/papers/public",
    tag = "papers",
    responses(
        (status = 200, description = "Public papers retrieved", body = Vec<PublicPaperResponse>)
    )
)]
pub async fn get_public_papers(
    State(state): State<AppState>,
) -> Result<Json<Vec<PublicPaperResponse>>, AppError> {
    let papers = state.quiz_repo.get_public_papers().await?;
    let responses: Vec<PublicPaperResponse> = papers
        .into_iter()
        .map(PublicPaperResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/api/papers/public/{id}",
    tag = "papers",
    params(
        ("id" = String, Path, description = "Public Paper ID")
    ),
    responses(
        (status = 200, description = "Public paper retrieved", body = PublicPaperResponse),
        (status = 404, description = "Paper not found")
    )
)]
pub async fn get_public_paper_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PublicPaperResponse>, AppError> {
    let paper = state.quiz_repo.get_public_paper_by_id(&id).await?;
    match paper {
        Some(p) => Ok(Json(PublicPaperResponse::from(p))),
        None => Err(AppError::NotFound(format!("Public paper not found: {}", id))),
    }
}

// User papers endpoints (require authentication)

#[utoipa::path(
    get,
    path = "/api/papers/my",
    tag = "papers",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "User papers retrieved", body = Vec<UserPaperResponse>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_my_papers(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<Vec<UserPaperResponse>>, AppError> {
    let papers = state.quiz_repo.get_user_papers(&user_id).await?;
    let responses: Vec<UserPaperResponse> = papers
        .into_iter()
        .map(UserPaperResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/api/papers/my",
    tag = "papers",
    security(("bearer_auth" = [])),
    request_body = CreateUserPaperRequest,
    responses(
        (status = 200, description = "User paper created", body = UserPaperResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn create_my_paper(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<CreateUserPaperRequest>,
) -> Result<Json<UserPaperResponse>, AppError> {
    let paper = state
        .quiz_repo
        .create_user_paper(&user_id, &payload.title, &payload.quiz_ids)
        .await?;
    Ok(Json(UserPaperResponse::from(paper)))
}

#[utoipa::path(
    put,
    path = "/api/papers/my/{id}",
    tag = "papers",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "User Paper ID")
    ),
    request_body = UpdateUserPaperRequest,
    responses(
        (status = 200, description = "User paper updated", body = UserPaperResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Paper not found")
    )
)]
pub async fn update_my_paper(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateUserPaperRequest>,
) -> Result<Json<UserPaperResponse>, AppError> {
    let paper = state
        .quiz_repo
        .update_user_paper(&id, &user_id, &payload.title, &payload.quiz_ids)
        .await?;
    Ok(Json(UserPaperResponse::from(paper)))
}

#[utoipa::path(
    delete,
    path = "/api/papers/my/{id}",
    tag = "papers",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "User Paper ID")
    ),
    responses(
        (status = 204, description = "User paper deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Paper not found")
    )
)]
pub async fn delete_my_paper(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    state.quiz_repo.delete_user_paper(&id, &user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
