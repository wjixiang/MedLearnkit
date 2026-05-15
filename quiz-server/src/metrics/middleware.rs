use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
    extract::State,
};

use crate::state::AppState;

fn normalize_path(path: &str) -> String {
    let segments: Vec<&str> = path.split('/').collect();
    let mut normalized = Vec::with_capacity(segments.len());
    for seg in &segments {
        if seg.is_empty() {
            normalized.push(*seg);
        } else if is_uuid_like(seg) {
            normalized.push("{id}");
        } else {
            normalized.push(*seg);
        }
    }
    normalized.join("/")
}

fn is_uuid_like(s: &str) -> bool {
    s.len() >= 8
        && s.chars().filter(|&c| c == '-').count() >= 3
        && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

pub async fn metrics_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let path = req.uri().path().to_string();
    let method = req.method().to_string();

    let response = next.run(req).await;

    let duration = start.elapsed();
    let status_code = response.status().as_u16();
    let normalized = normalize_path(&path);

    state
        .metrics
        .record(&normalized, &method, status_code, duration.as_micros() as u64);

    response
}
