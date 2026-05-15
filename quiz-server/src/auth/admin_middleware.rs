use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Extension,
};
use std::convert::Infallible;

use crate::state::AppState;

pub async fn admin_auth(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    req: Request,
    next: Next,
) -> Result<Response, Infallible> {
    match state.auth_repo.is_user_admin(&user_id).await {
        Ok(true) => Ok(next.run(req).await),
        Ok(false) => {
            tracing::warn!(user_id = %user_id, "Non-admin attempted admin access");
            Ok(StatusCode::FORBIDDEN.into_response())
        }
        Err(e) => {
            tracing::error!(error = %e, "Error checking admin status");
            Ok(StatusCode::INTERNAL_SERVER_ERROR.into_response())
        }
    }
}
