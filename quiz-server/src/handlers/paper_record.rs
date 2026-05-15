use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::db::schema::{PaperAnswer, PaperRecord};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePaperRecordRequest {
    pub paper_id: String,
    pub total_questions: i32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaperRecordResponse {
    pub id: String,
    pub user_id: String,
    pub paper_id: String,
    pub score: Option<f64>,
    pub total_questions: i32,
    pub correct_count: i32,
    pub answered_count: i32,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

impl From<PaperRecord> for PaperRecordResponse {
    fn from(r: PaperRecord) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            paper_id: r.paper_id,
            score: r.score,
            total_questions: r.total_questions,
            correct_count: r.correct_count,
            answered_count: r.answered_count,
            status: r.status,
            started_at: r.started_at,
            completed_at: r.completed_at,
            created_at: r.created_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdatePaperRecordRequest {
    pub correct_count: i32,
    pub score: f64,
    pub status: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePaperAnswerRequest {
    pub paper_record_id: String,
    pub quiz_id: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub order_index: i32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaperAnswerResponse {
    pub id: String,
    pub paper_record_id: String,
    pub quiz_id: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub order_index: i32,
    pub created_at: String,
}

impl From<PaperAnswer> for PaperAnswerResponse {
    fn from(a: PaperAnswer) -> Self {
        Self {
            id: a.id,
            paper_record_id: a.paper_record_id,
            quiz_id: a.quiz_id,
            user_answer: a.user_answer,
            is_correct: a.is_correct,
            time_spent_seconds: a.time_spent_seconds,
            order_index: a.order_index,
            created_at: a.created_at,
        }
    }
}

/// Start a paper practice session
pub async fn create_paper_record(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<CreatePaperRecordRequest>,
) -> Result<Json<PaperRecordResponse>, AppError> {
    let record = state
        .quiz_repo
        .create_paper_record(&user_id, &payload.paper_id, payload.total_questions)
        .await?;
    Ok(Json(PaperRecordResponse::from(record)))
}

/// Get paper records for a specific paper
#[derive(Debug, Deserialize)]
pub struct GetPaperRecordsQuery {
    pub paper_id: String,
}

pub async fn get_paper_records(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<GetPaperRecordsQuery>,
) -> Result<Json<Vec<PaperRecordResponse>>, AppError> {
    let records = state
        .quiz_repo
        .get_paper_records(&user_id, &query.paper_id)
        .await?;
    Ok(Json(records.into_iter().map(PaperRecordResponse::from).collect()))
}

/// Submit an answer for a paper practice session
pub async fn create_paper_answer(
    State(state): State<AppState>,
    Extension(_user_id): Extension<String>,
    Json(payload): Json<CreatePaperAnswerRequest>,
) -> Result<Json<PaperAnswerResponse>, AppError> {
    let answer = state
        .quiz_repo
        .create_paper_answer(
            &payload.paper_record_id,
            &payload.quiz_id,
            payload.user_answer.as_deref(),
            payload.is_correct,
            payload.time_spent_seconds,
            payload.order_index,
        )
        .await?;
    Ok(Json(PaperAnswerResponse::from(answer)))
}

/// Get all answers for a paper record
pub async fn get_paper_answers(
    State(state): State<AppState>,
    Extension(_user_id): Extension<String>,
    Path(record_id): Path<String>,
) -> Result<Json<Vec<PaperAnswerResponse>>, AppError> {
    let answers = state.quiz_repo.get_paper_answers(&record_id).await?;
    Ok(Json(answers.into_iter().map(PaperAnswerResponse::from).collect()))
}

/// Update a paper record (e.g., mark completed)
pub async fn update_paper_record(
    State(state): State<AppState>,
    Extension(_user_id): Extension<String>,
    Path(record_id): Path<String>,
    Json(payload): Json<UpdatePaperRecordRequest>,
) -> Result<Json<PaperRecordResponse>, AppError> {
    let record = state
        .quiz_repo
        .update_paper_record(&record_id, payload.correct_count, payload.score, &payload.status)
        .await?;
    Ok(Json(PaperRecordResponse::from(record)))
}
