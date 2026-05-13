use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::db::schema::Paper;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreatePaperRequest {
    pub title: String,
    pub quiz_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
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

pub async fn get_papers(
    State(state): State<AppState>,
) -> Result<Json<Vec<PaperResponse>>, AppError> {
    let papers = state.quiz_repo.get_papers().await?;
    let responses: Vec<PaperResponse> = papers.into_iter().map(PaperResponse::from).collect();
    Ok(Json(responses))
}

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

pub async fn delete_paper(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    state.quiz_repo.delete_paper(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}