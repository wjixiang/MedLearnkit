use axum::{
    extract::Request,
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::convert::Infallible;

use crate::auth::jwt::validate_token;

pub async fn jwt_auth(mut req: Request, next: Next) -> Result<Response, Infallible> {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            tracing::warn!(
                path = %req.uri().path(),
                "Auth failed: missing or malformed Authorization header"
            );
            return Ok((StatusCode::UNAUTHORIZED, "Unauthorized").into_response());
        }
    };

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret".to_string());
    let claims = match validate_token(token, &jwt_secret) {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!(
                path = %req.uri().path(),
                error = %e,
                "Auth failed: invalid or expired token"
            );
            return Ok((StatusCode::UNAUTHORIZED, "Invalid token").into_response());
        }
    };

    let user_id = claims.sub.clone();
    req.extensions_mut().insert(claims.sub);

    tracing::debug!(user_id = %user_id, path = %req.uri().path(), "JWT auth succeeded");

    Ok(next.run(req).await)
}
