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
            return Ok((StatusCode::UNAUTHORIZED, "Unauthorized").into_response());
        }
    };

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret".to_string());
    let claims = match validate_token(token, &jwt_secret) {
        Ok(claims) => claims,
        Err(_) => {
            return Ok((StatusCode::UNAUTHORIZED, "Invalid token").into_response());
        }
    };

    req.extensions_mut().insert(claims.sub);

    Ok(next.run(req).await)
}
