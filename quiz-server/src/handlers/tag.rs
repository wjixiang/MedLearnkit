use axum::{
    extract::{Query, Path, State},
    Json,
};
use crate::db::DbPool;
use crate::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct TagQuery {
    pub q: Option<String>,
    pub limit: Option<u32>,
}

pub async fn get_tags(
    State(pool): State<DbPool>,
    Query(query): Query<TagQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = pool.get()?;
    let limit = query.limit.unwrap_or(10).min(50);

    let tags: Vec<String> = if let Some(ref q) = query.q {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT value FROM QuizTag WHERE value LIKE ? ORDER BY value LIMIT ?"
        )?;
        let pattern = format!("%{}%", q);
        let limit_str = limit.to_string();
        let params: Vec<&dyn rusqlite::ToSql> = vec![&pattern, &limit_str];
        let rows = stmt.query_map(params.as_slice(), |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT value FROM QuizTag ORDER BY value LIMIT ?"
        )?;
        let rows = stmt.query_map([limit.to_string()], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    Ok(Json(serde_json::to_value(tags).unwrap()))
}

#[derive(Debug, Deserialize)]
pub struct AddTagRequest {
    pub quiz_id: String,
    pub value: String,
    pub tag_type: Option<String>,
}

pub async fn add_tag(
    State(pool): State<DbPool>,
    Path(quiz_id): Path<String>,
    Json(req): Json<AddTagRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = pool.get()?;
    let id = Uuid::new_v4().to_string();
    let tag_type = req.tag_type.unwrap_or_else(|| "private".to_string());

    conn.execute(
        "INSERT INTO QuizTag (id, quizId, userId, value, type, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        [&id, &quiz_id, &"anonymous".to_string(), &req.value, &tag_type],
    )?;

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn delete_tag(
    State(pool): State<DbPool>,
    Path((_quiz_id, tag_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = pool.get()?;

    conn.execute("DELETE FROM QuizTag WHERE id = ?", [&tag_id])?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn get_quiz_tags(
    State(pool): State<DbPool>,
    Path(quiz_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let conn = pool.get()?;

    let mut stmt = conn.prepare(
        "SELECT id, quizId, userId, value, type, createdAt FROM QuizTag WHERE quizId = ?"
    )?;

    let tags: Vec<serde_json::Value> = {
        let rows = stmt.query_map([&quiz_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "quizId": row.get::<_, String>(1)?,
                "userId": row.get::<_, String>(2)?,
                "value": row.get::<_, String>(3)?,
                "type": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?;
        rows.filter_map(|r| r.ok()).collect()
    };

    Ok(Json(serde_json::to_value(tags).unwrap()))
}
