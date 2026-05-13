use axum::{
    extract::{Extension, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::db::schema::PracticeRecord;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePracticeRecordRequest {
    pub quiz_id: String,
    pub quiz_type: String,
    pub quiz_class: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PracticeRecordResponse {
    pub id: String,
    pub user_id: String,
    pub quiz_id: String,
    pub quiz_type: String,
    pub quiz_class: String,
    pub user_answer: Option<String>,
    pub is_correct: bool,
    pub time_spent_seconds: i32,
    pub created_at: String,
}

impl From<PracticeRecord> for PracticeRecordResponse {
    fn from(record: PracticeRecord) -> Self {
        Self {
            id: record.id,
            user_id: record.user_id,
            quiz_id: record.quiz_id,
            quiz_type: record.quiz_type,
            quiz_class: record.quiz_class,
            user_answer: record.user_answer,
            is_correct: record.is_correct,
            time_spent_seconds: record.time_spent_seconds,
            created_at: record.created_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GetPracticeRecordsQuery {
    pub limit: Option<i32>,
}

/// Create a new practice record
#[utoipa::path(
    post,
    path = "/api/practices",
    tag = "practices",
    security(("bearer_auth" = [])),
    request_body = CreatePracticeRecordRequest,
    responses(
        (status = 200, description = "Practice record created", body = PracticeRecordResponse),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn create_practice_record(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<CreatePracticeRecordRequest>,
) -> Result<Json<PracticeRecordResponse>, AppError> {
    let record = state
        .quiz_repo
        .create_practice_record(
            &user_id,
            &payload.quiz_id,
            &payload.quiz_type,
            &payload.quiz_class,
            payload.user_answer.as_deref(),
            payload.is_correct,
            payload.time_spent_seconds,
        )
        .await?;
    Ok(Json(PracticeRecordResponse::from(record)))
}

/// Get practice records for current user
#[utoipa::path(
    get,
    path = "/api/practices",
    tag = "practices",
    security(("bearer_auth" = [])),
    params(
        ("limit" = Option<i32>, Query, description = "Maximum number of records to return")
    ),
    responses(
        (status = 200, description = "Practice records retrieved", body = Vec<PracticeRecordResponse>),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn get_practice_records(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<GetPracticeRecordsQuery>,
) -> Result<Json<Vec<PracticeRecordResponse>>, AppError> {
    let limit = query.limit.unwrap_or(50).min(200);
    let records = state.quiz_repo.get_practice_records(&user_id, limit).await?;
    let responses: Vec<PracticeRecordResponse> = records
        .into_iter()
        .map(PracticeRecordResponse::from)
        .collect();
    Ok(Json(responses))
}
