use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Forbidden")]
    Forbidden,

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Database(e) => {
                tracing::error!(error = %e, "Database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Database error".to_string(),
                )
            }
            AppError::NotFound(msg) => {
                tracing::debug!(reason = %msg, "Resource not found");
                (StatusCode::NOT_FOUND, msg.clone())
            }
            AppError::BadRequest(msg) => {
                tracing::debug!(reason = %msg, "Bad request");
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            AppError::Unauthorized => {
                tracing::debug!("Unauthorized access attempt");
                (StatusCode::UNAUTHORIZED, "Unauthorized".to_string())
            }
            AppError::InvalidCredentials => {
                tracing::debug!("Invalid credentials");
                (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
            }
            AppError::Conflict(msg) => {
                tracing::debug!(reason = %msg, "Conflict");
                (StatusCode::CONFLICT, msg.clone())
            }
            AppError::Forbidden => {
                tracing::debug!("Forbidden access attempt");
                (StatusCode::FORBIDDEN, "Forbidden".to_string())
            }
            AppError::Internal(msg) => {
                tracing::error!(reason = %msg, "Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        let body = Json(json!({
            "error": message
        }));

        (status, body).into_response()
    }
}
