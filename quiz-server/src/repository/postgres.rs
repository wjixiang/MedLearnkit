use crate::db::schema::*;
use crate::error::AppError;
use crate::repository::{FilterMeta, QuizRepository};
use crate::services::quiz_service::QuizFilter;
use sqlx::types::chrono;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use ::chrono::TimeDelta;

pub struct PostgresRepository {
    pool: PgPool,
}

impl PostgresRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

const DETAIL_SQL: &str = r#"
SELECT id, type, class, unit,
  COALESCE(question, questions->0->>'questionText') as question,
  "mainQuestion", answer, source,
  "extractedYear", "processedAt", "createdAt",
  options, questions, "analysis_point", "analysis_discuss"
FROM "Quiz"
"#;

#[async_trait::async_trait]
impl QuizRepository for PostgresRepository {
    async fn get_quizzes(&self, filter: &QuizFilter) -> Result<(Vec<Quiz>, u32), AppError> {
        let page = filter.page.unwrap_or(1).max(1);
        let limit = filter.limit.unwrap_or(20).min(100);
        let offset = (page - 1) * limit;

        let (conditions, params): (Vec<String>, Vec<String>) = build_conditions(filter);
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM \"Quiz\" {}", where_clause);
        let total = count_with_params(&self.pool, &count_sql, &params).await? as u32;

        let order_clause = build_order_clause(filter);
        let query_sql = format!(
            "SELECT id, type, class, unit, COALESCE(question, questions->0->>'questionText') as question, answer, source, \"extractedYear\", \"processedAt\", \"createdAt\"
             FROM \"Quiz\" {}
             {} {} {}",
            where_clause,
            if where_clause.is_empty() { "ORDER BY \"createdAt\" DESC".to_string() } else { order_clause },
            format!("LIMIT {}", limit),
            format!("OFFSET {}", offset)
        );

        let rows = query_with_params(&self.pool, &query_sql, &params).await?;
        let quizzes: Vec<Quiz> = rows.iter().map(|row| row_to_quiz(row)).collect();

        Ok((quizzes, total))
    }

    async fn get_quizzes_with_details(
        &self,
        filter: &QuizFilter,
    ) -> Result<(Vec<QuizWithDetails>, u32), AppError> {
        let page = filter.page.unwrap_or(1).max(1);
        let limit = filter.limit.unwrap_or(20).min(100);
        let offset = (page - 1) * limit;

        let (conditions, params): (Vec<String>, Vec<String>) = build_conditions(filter);
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM \"Quiz\" {}", where_clause);
        let total = count_with_params(&self.pool, &count_sql, &params).await? as u32;

        let order_clause = build_order_clause(filter);
        let query_sql = format!(
            "{} {} {} {} {}",
            DETAIL_SQL.trim(),
            where_clause,
            if where_clause.is_empty() {
                "ORDER BY \"createdAt\" DESC".to_string()
            } else {
                order_clause
            },
            format!("LIMIT {}", limit),
            format!("OFFSET {}", offset)
        );

        let rows = query_with_params(&self.pool, &query_sql, &params).await?;
        let mut results = Vec::with_capacity(rows.len());
        for row in &rows {
            let details = row_to_quiz_with_details(row);
            let tags = query_tags(&self.pool, &details.quiz.id).await?;
            results.push(QuizWithDetails { tags, ..details });
        }

        Ok((results, total))
    }

    async fn get_quizzes_by_ids(&self, ids: &[String]) -> Result<Vec<QuizWithDetails>, AppError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let placeholders: Vec<String> = ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("${}", i + 1))
            .collect();
        let query_sql = format!(
            "{} WHERE id IN ({})",
            DETAIL_SQL.trim(),
            placeholders.join(",")
        );

        let mut query = sqlx::query(&query_sql);
        for id in ids {
            query = query.bind(id);
        }
        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut results = Vec::with_capacity(rows.len());
        for row in &rows {
            let details = row_to_quiz_with_details(row);
            let tags = query_tags(&self.pool, &details.quiz.id).await?;
            results.push(QuizWithDetails { tags, ..details });
        }

        Ok(results)
    }

    async fn get_quiz_by_id(&self, id: &str) -> Result<Option<QuizWithDetails>, AppError> {
        let query_sql = format!("{} WHERE id = $1", DETAIL_SQL.trim());
        let row = sqlx::query(&query_sql)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        match row {
            Some(row) => {
                let details = row_to_quiz_with_details(&row);
                let tags = query_tags(&self.pool, &details.quiz.id).await?;
                Ok(Some(QuizWithDetails { tags, ..details }))
            }
            None => Ok(None),
        }
    }

    async fn get_random_quizzes(
        &self,
        filter: &QuizFilter,
        limit: u32,
    ) -> Result<Vec<Quiz>, AppError> {
        let (conditions, params): (Vec<String>, Vec<String>) = build_conditions(filter);
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let query_sql = format!(
            "SELECT id, type, class, unit, COALESCE(question, questions->0->>'questionText') as question, answer, source, \"extractedYear\", \"processedAt\", \"createdAt\"
             FROM \"Quiz\" {}
             ORDER BY RANDOM()
             LIMIT {}",
            where_clause, limit
        );

        let rows = query_with_params(&self.pool, &query_sql, &params).await?;
        let quizzes: Vec<Quiz> = rows.iter().map(|row| row_to_quiz(row)).collect();
        Ok(quizzes)
    }

    async fn get_filter_meta(&self) -> Result<FilterMeta, AppError> {
        let types =
            sqlx::query_scalar::<_, String>("SELECT DISTINCT type FROM \"Quiz\" ORDER BY type")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

        let classes =
            sqlx::query_scalar::<_, String>("SELECT DISTINCT class FROM \"Quiz\" ORDER BY class")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

        let sources = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT source FROM \"Quiz\" WHERE source IS NOT NULL ORDER BY source",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let years = sqlx::query_scalar::<_, i32>("SELECT DISTINCT \"extractedYear\" FROM \"Quiz\" WHERE \"extractedYear\" IS NOT NULL ORDER BY \"extractedYear\" DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let unit_rows = sqlx::query(
            "SELECT DISTINCT class, unit FROM \"Quiz\" ORDER BY class, unit",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut units: std::collections::BTreeMap<String, Vec<String>> =
            classes.iter().map(|c| (c.clone(), Vec::new())).collect();
        for row in &unit_rows {
            let class: String = row.get("class");
            let unit: String = row.get("unit");
            if let Some(list) = units.get_mut(&class) {
                list.push(unit);
            }
        }

        Ok(FilterMeta {
            types,
            classes,
            units,
            sources,
            years,
        })
    }

    async fn get_tags(&self, search: Option<&str>, limit: u32) -> Result<Vec<String>, AppError> {
        let tags = if let Some(q) = search {
            let pattern = format!("%{}%", q);
            sqlx::query_scalar::<_, String>("SELECT DISTINCT value FROM \"QuizTag\" WHERE value LIKE $1 ORDER BY value LIMIT $2")
                .bind(&pattern)
                .bind(limit as i32)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?
        } else {
            sqlx::query_scalar::<_, String>(
                "SELECT DISTINCT value FROM \"QuizTag\" ORDER BY value LIMIT $1",
            )
            .bind(limit as i32)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
        };
        Ok(tags)
    }

    async fn get_quiz_tags(&self, quiz_id: &str) -> Result<Vec<QuizTag>, AppError> {
        let rows = sqlx::query(
            "SELECT id, \"quizId\", \"userId\", value, type, \"createdAt\" FROM \"QuizTag\" WHERE \"quizId\" = $1"
        )
        .bind(quiz_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| QuizTag {
                id: row.get("id"),
                quiz_id: row.get("quizId"),
                user_id: row.get("userId"),
                value: row.get("value"),
                tag_type: row.get("type"),
                created_at: row
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
            })
            .collect())
    }

    async fn add_tag(
        &self,
        quiz_id: &str,
        value: &str,
        tag_type: &str,
    ) -> Result<String, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO \"QuizTag\" (id, \"quizId\", \"userId\", value, type, \"createdAt\") VALUES ($1, $2, $3, $4, $5, NOW())"
        )
        .bind(&id)
        .bind(quiz_id)
        .bind("anonymous")
        .bind(value)
        .bind(tag_type)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(id)
    }

    async fn delete_tag(&self, tag_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM \"QuizTag\" WHERE id = $1")
            .bind(tag_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    async fn create_paper(&self, title: &str, quiz_ids: &[String]) -> Result<Paper, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        let quiz_ids_json = serde_json::to_string(quiz_ids).unwrap_or("[]".to_string());

        sqlx::query(
            "INSERT INTO \"Paper\" (id, title, quizids, createdat) VALUES ($1, $2, $3, NOW()::text)"
        )
        .bind(&id)
        .bind(title)
        .bind(&quiz_ids_json)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let created_at: String =
            sqlx::query_scalar("SELECT createdat FROM \"Paper\" WHERE id = $1")
                .bind(&id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(Paper {
            id,
            title: title.to_string(),
            quiz_ids: quiz_ids_json,
            created_at,
        })
    }

    async fn get_papers(&self) -> Result<Vec<Paper>, AppError> {
        let rows = sqlx::query(
            "SELECT id, title, quizids, createdat FROM \"Paper\" ORDER BY createdat DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| Paper {
                id: row.get("id"),
                title: row.get("title"),
                quiz_ids: row.get("quizids"),
                created_at: row.get("createdat"),
            })
            .collect())
    }

    async fn get_paper_by_id(&self, id: &str) -> Result<Option<Paper>, AppError> {
        let row = sqlx::query("SELECT id, title, quizids, createdat FROM \"Paper\" WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row.map(|r| Paper {
            id: r.get("id"),
            title: r.get("title"),
            quiz_ids: r.get("quizids"),
            created_at: r.get("createdat"),
        }))
    }

    async fn delete_paper(&self, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM \"Paper\" WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    // Public papers
    async fn get_public_papers(&self) -> Result<Vec<PublicPaper>, AppError> {
        let rows = sqlx::query(
            r#"SELECT id, title, description, quiz_ids, quiz_count, source, tags, created_at
               FROM public_papers ORDER BY created_at DESC"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| {
                let quiz_ids_json: serde_json::Value = row.get("quiz_ids");
                let quiz_ids: Vec<String> =
                    serde_json::from_value(quiz_ids_json).unwrap_or_default();
                let tags_json: serde_json::Value = row.get("tags");
                let tags: Vec<String> = serde_json::from_value(tags_json).unwrap_or_default();
                PublicPaper {
                    id: row.get::<uuid::Uuid, _>("id").to_string(),
                    title: row.get("title"),
                    description: row.get("description"),
                    quiz_ids,
                    quiz_count: row.get("quiz_count"),
                    source: row.get("source"),
                    tags,
                    created_at: row
                        .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                        .map(|t| t.to_rfc3339())
                        .unwrap_or_default(),
                }
            })
            .collect())
    }

    async fn get_public_paper_by_id(&self, id: &str) -> Result<Option<PublicPaper>, AppError> {
        let row = sqlx::query(
            r#"SELECT id, title, description, quiz_ids, quiz_count, source, tags, created_at
               FROM public_papers WHERE id = $1::uuid"#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row.map(|r| {
            let quiz_ids_json: serde_json::Value = r.get("quiz_ids");
            let quiz_ids: Vec<String> =
                serde_json::from_value(quiz_ids_json).unwrap_or_default();
            let tags_json: serde_json::Value = r.get("tags");
            let tags: Vec<String> = serde_json::from_value(tags_json).unwrap_or_default();
            PublicPaper {
                id: r.get::<uuid::Uuid, _>("id").to_string(),
                title: r.get("title"),
                description: r.get("description"),
                quiz_ids,
                quiz_count: r.get("quiz_count"),
                source: r.get("source"),
                tags,
                created_at: r
                    .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                    .map(|t| t.to_rfc3339())
                    .unwrap_or_default(),
            }
        }))
    }

    // User papers
    async fn get_user_papers(&self, user_id: &str) -> Result<Vec<UserPaper>, AppError> {
        let rows = sqlx::query(
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, created_at
               FROM user_papers WHERE user_id = $1::uuid ORDER BY created_at DESC"#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| {
                let quiz_ids_json: serde_json::Value = row.get("quiz_ids");
                let quiz_ids: Vec<String> =
                    serde_json::from_value(quiz_ids_json).unwrap_or_default();
                UserPaper {
                    id: row.get::<uuid::Uuid, _>("id").to_string(),
                    user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
                    title: row.get("title"),
                    description: row.get("description"),
                    quiz_ids,
                    quiz_count: row.get("quiz_count"),
                    created_at: row
                        .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                        .map(|t| t.to_rfc3339())
                        .unwrap_or_default(),
                }
            })
            .collect())
    }

    async fn create_user_paper(
        &self,
        user_id: &str,
        title: &str,
        quiz_ids: &[String],
    ) -> Result<UserPaper, AppError> {
        let id = uuid::Uuid::new_v4();
        let quiz_ids_json = serde_json::to_value(quiz_ids).unwrap_or(serde_json::Value::Array(vec![]));
        let quiz_count = quiz_ids.len() as i32;

        sqlx::query(
            r#"INSERT INTO user_papers (id, user_id, title, quiz_ids, quiz_count, created_at)
               VALUES ($1, $2::uuid, $3, $4, $5, NOW())"#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(title)
        .bind(&quiz_ids_json)
        .bind(quiz_count)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let row = sqlx::query(
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, created_at
               FROM user_papers WHERE id = $1"#,
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let quiz_ids_json_out: serde_json::Value = row.get("quiz_ids");
        let quiz_ids_out: Vec<String> =
            serde_json::from_value(quiz_ids_json_out).unwrap_or_default();

        Ok(UserPaper {
            id: row.get::<uuid::Uuid, _>("id").to_string(),
            user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
            title: row.get("title"),
            description: row.get("description"),
            quiz_ids: quiz_ids_out,
            quiz_count: row.get("quiz_count"),
            created_at: row
                .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        })
    }

    async fn update_user_paper(
        &self,
        id: &str,
        user_id: &str,
        title: Option<&str>,
        description: Option<&str>,
        quiz_ids: Option<&[String]>,
    ) -> Result<UserPaper, AppError> {
        // Fetch existing paper first to merge partial updates
        let existing = sqlx::query(
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, created_at
               FROM user_papers WHERE id = $1::uuid AND user_id = $2::uuid"#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Paper not found or access denied".to_string()))?;

        let existing_ids_json: serde_json::Value = existing.get("quiz_ids");
        let existing_ids: Vec<String> = serde_json::from_value(existing_ids_json).unwrap_or_default();

        let final_title = match title {
            Some(t) => t.to_string(),
            None => existing.get::<String, _>("title"),
        };
        let final_description: Option<String> = match description {
            Some(d) => Some(d.to_string()),
            None => existing.get::<Option<String>, _>("description"),
        };
        let final_ids = quiz_ids.map(|ids| ids.to_vec()).unwrap_or(existing_ids);
        let final_count = final_ids.len() as i32;
        let final_ids_json = serde_json::to_value(&final_ids).unwrap_or(serde_json::Value::Array(vec![]));

        sqlx::query(
            r#"UPDATE user_papers
               SET title = $1, description = $2, quiz_ids = $3, quiz_count = $4, updated_at = NOW()
               WHERE id = $5::uuid AND user_id = $6::uuid"#,
        )
        .bind(&final_title)
        .bind(&final_description)
        .bind(&final_ids_json)
        .bind(final_count)
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(UserPaper {
            id: existing.get::<uuid::Uuid, _>("id").to_string(),
            user_id: existing.get::<uuid::Uuid, _>("user_id").to_string(),
            title: final_title.to_string(),
            description: final_description.map(|s| s.to_string()),
            quiz_ids: final_ids,
            quiz_count: final_count,
            created_at: existing
                .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        })
    }

    async fn delete_user_paper(&self, id: &str, user_id: &str) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM user_papers WHERE id = $1::uuid AND user_id = $2::uuid")
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Paper not found or access denied".to_string()));
        }
        Ok(())
    }

    // Paper practice records
    async fn create_paper_record(
        &self,
        user_id: &str,
        paper_id: &str,
        total_questions: i32,
    ) -> Result<PaperRecord, AppError> {
        let id = uuid::Uuid::new_v4();
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let row = sqlx::query(
            r#"INSERT INTO paper_records (id, user_id, paper_id, total_questions, status)
               VALUES ($1, $2, $3, $4, 'in_progress')
               RETURNING id, user_id, paper_id, score, total_questions, correct_count, status, started_at, completed_at, created_at"#,
        )
        .bind(id)
        .bind(user_uuid)
        .bind(paper_id)
        .bind(total_questions)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row_to_paper_record(&row))
    }

    async fn get_paper_records(
        &self,
        user_id: &str,
        paper_id: &str,
    ) -> Result<Vec<PaperRecord>, AppError> {
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;
        let rows = sqlx::query(
            r#"SELECT pr.id, pr.user_id, pr.paper_id, pr.score, pr.total_questions, pr.correct_count, pr.status, pr.started_at, pr.completed_at, pr.created_at,
                      COALESCE(pa.answered_count, 0) AS answered_count
               FROM paper_records pr
               LEFT JOIN (SELECT paper_record_id, COUNT(*) AS answered_count FROM paper_answers GROUP BY paper_record_id) pa
               ON pa.paper_record_id = pr.id
               WHERE pr.user_id = $1 AND pr.paper_id = $2
               ORDER BY pr.created_at DESC"#,
        )
        .bind(user_uuid)
        .bind(paper_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows.iter().map(row_to_paper_record).collect())
    }

    async fn get_paper_record_by_id(
        &self,
        id: &str,
    ) -> Result<Option<PaperRecord>, AppError> {
        let record_uuid = uuid::Uuid::parse_str(id)
            .map_err(|e| AppError::Internal(format!("Invalid record id: {}", e)))?;
        let row = sqlx::query(
            r#"SELECT id, user_id, paper_id, score, total_questions, correct_count, status, started_at, completed_at, created_at
               FROM paper_records WHERE id = $1"#,
        )
        .bind(record_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row.map(|r| row_to_paper_record(&r)))
    }

    async fn update_paper_record(
        &self,
        id: &str,
        correct_count: i32,
        score: f64,
        status: &str,
    ) -> Result<PaperRecord, AppError> {
        let record_uuid = uuid::Uuid::parse_str(id)
            .map_err(|e| AppError::Internal(format!("Invalid record id: {}", e)))?;
        let row = sqlx::query(
            r#"UPDATE paper_records
               SET correct_count = $1, score = $2, status = $3,
                   completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
               WHERE id = $4
               RETURNING id, user_id, paper_id, score, total_questions, correct_count, status, started_at, completed_at, created_at"#,
        )
        .bind(correct_count)
        .bind(score)
        .bind(status)
        .bind(record_uuid)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row_to_paper_record(&row))
    }

    async fn create_paper_answer(
        &self,
        paper_record_id: &str,
        quiz_id: &str,
        user_answer: Option<&str>,
        is_correct: bool,
        time_spent_seconds: i32,
        order_index: i32,
    ) -> Result<PaperAnswer, AppError> {
        let id = uuid::Uuid::new_v4();
        let record_uuid = uuid::Uuid::parse_str(paper_record_id)
            .map_err(|e| AppError::Internal(format!("Invalid paper_record_id: {}", e)))?;

        let row = sqlx::query(
            r#"INSERT INTO paper_answers (id, paper_record_id, quiz_id, user_answer, is_correct, time_spent_seconds, order_index)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, paper_record_id, quiz_id, user_answer, is_correct, time_spent_seconds, order_index, created_at"#,
        )
        .bind(id)
        .bind(record_uuid)
        .bind(quiz_id)
        .bind(user_answer)
        .bind(is_correct)
        .bind(time_spent_seconds)
        .bind(order_index)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row_to_paper_answer(&row))
    }

    async fn get_paper_answers(
        &self,
        paper_record_id: &str,
    ) -> Result<Vec<PaperAnswer>, AppError> {
        let record_uuid = uuid::Uuid::parse_str(paper_record_id)
            .map_err(|e| AppError::Internal(format!("Invalid paper_record_id: {}", e)))?;
        let rows = sqlx::query(
            r#"SELECT id, paper_record_id, quiz_id, user_answer, is_correct, time_spent_seconds, order_index, created_at
               FROM paper_answers WHERE paper_record_id = $1
               ORDER BY order_index"#,
        )
        .bind(record_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows.iter().map(row_to_paper_answer).collect())
    }

    // Practice records
    async fn create_practice_record(
        &self,
        user_id: &str,
        quiz_id: &str,
        quiz_type: &str,
        quiz_class: &str,
        user_answer: Option<&str>,
        is_correct: bool,
        time_spent_seconds: i32,
    ) -> Result<PracticeRecord, AppError> {
        let id = uuid::Uuid::new_v4();
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        sqlx::query(
            r#"INSERT INTO practice_records (id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(id)
        .bind(user_uuid)
        .bind(quiz_id)
        .bind(user_answer)
        .bind(is_correct)
        .bind(time_spent_seconds)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let row = sqlx::query(
            r#"SELECT id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds, created_at
               FROM practice_records WHERE id = $1"#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(PracticeRecord {
            id: row.get::<uuid::Uuid, _>("id").to_string(),
            user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
            quiz_id: row.get("quiz_id"),
            quiz_type: quiz_type.to_string(),
            quiz_class: quiz_class.to_string(),
            user_answer: row.get("user_answer"),
            is_correct: row.get("is_correct"),
            time_spent_seconds: row.get("time_spent_seconds"),
            created_at: row
                .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        })
    }

    // Practice statistics
    async fn get_practice_daily_stats(
        &self,
        user_id: &str,
        days: i32,
        quiz_class: Option<&str>,
    ) -> Result<Vec<DailyPracticeStats>, AppError> {
        let days = days.clamp(1, 365);
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        // Fetch daily aggregates
        let rows = sqlx::query(
            r#"SELECT
                DATE(pr.created_at)::text AS date,
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE pr.is_correct) AS correct_count,
                ROUND(COUNT(*) FILTER (WHERE pr.is_correct)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::double precision AS accuracy,
                ROUND(AVG(pr.time_spent_seconds)::numeric, 1)::double precision AS avg_time_seconds
            FROM practice_records pr
            JOIN "Quiz" q ON pr.quiz_id = q.id
            WHERE pr.user_id = $1
              AND pr.created_at >= NOW() - ($2 || ' days')::INTERVAL
              AND ($3::text IS NULL OR q.class = $3)
            GROUP BY DATE(pr.created_at)
            ORDER BY date ASC"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .bind(quiz_class)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // Fetch per-class breakdown for each date
        let class_rows = sqlx::query(
            r#"SELECT
                DATE(pr.created_at)::text AS date,
                q.class AS quiz_class,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE pr.is_correct) AS correct_count
            FROM practice_records pr
            JOIN "Quiz" q ON pr.quiz_id = q.id
            WHERE pr.user_id = $1
              AND pr.created_at >= NOW() - ($2 || ' days')::INTERVAL
              AND ($3::text IS NULL OR q.class = $3)
            GROUP BY DATE(pr.created_at), q.class
            ORDER BY date ASC, quiz_class"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .bind(quiz_class)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut class_map: HashMap<String, Vec<ClassBreakdown>> = HashMap::new();
        for row in &class_rows {
            let date: String = row.get("date");
            class_map.entry(date).or_default().push(ClassBreakdown {
                quiz_class: row.get("quiz_class"),
                count: row.get("count"),
                correct_count: row.get("correct_count"),
            });
        }

        Ok(rows
            .iter()
            .map(|row| {
                let date: String = row.get("date");
                DailyPracticeStats {
                    by_class: class_map.remove(&date).unwrap_or_default(),
                    date,
                    total_count: row.get("total_count"),
                    correct_count: row.get("correct_count"),
                    accuracy: row.get::<Option<f64>, _>("accuracy").unwrap_or(0.0),
                    avg_time_seconds: row.get::<Option<f64>, _>("avg_time_seconds").unwrap_or(0.0),
                }
            })
            .collect())
    }

    async fn get_practice_subject_stats(
        &self,
        user_id: &str,
        days: i32,
    ) -> Result<Vec<SubjectPracticeStats>, AppError> {
        let days = days.clamp(1, 365);
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let rows = sqlx::query(
            r#"SELECT
                q.class AS quiz_class,
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE pr.is_correct) AS correct_count,
                ROUND(COUNT(*) FILTER (WHERE pr.is_correct)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::double precision AS accuracy,
                ROUND(AVG(pr.time_spent_seconds)::numeric, 1)::double precision AS avg_time_seconds
            FROM practice_records pr
            JOIN "Quiz" q ON pr.quiz_id = q.id
            WHERE pr.user_id = $1
              AND pr.created_at >= NOW() - ($2 || ' days')::INTERVAL
            GROUP BY q.class
            ORDER BY total_count DESC"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let classes: Vec<String> = rows.iter().map(|r| r.get::<String, _>("quiz_class")).collect();
        if classes.is_empty() {
            return Ok(Vec::new());
        }

        // Fetch per-type breakdown
        let type_rows = sqlx::query(
            r#"SELECT
                q.class,
                q.type AS quiz_type,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE pr.is_correct) AS correct_count
            FROM practice_records pr
            JOIN "Quiz" q ON pr.quiz_id = q.id
            WHERE pr.user_id = $1
              AND pr.created_at >= NOW() - ($2 || ' days')::INTERVAL
            GROUP BY q.class, q.type"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut type_map: HashMap<String, Vec<TypeBreakdown>> = HashMap::new();
        for row in &type_rows {
            let class: String = row.get("class");
            type_map.entry(class).or_default().push(TypeBreakdown {
                quiz_type: row.get("quiz_type"),
                count: row.get("count"),
                correct_count: row.get("correct_count"),
            });
        }

        // Fetch per-source breakdown
        let source_rows = sqlx::query(
            r#"SELECT
                q.class,
                COALESCE(q.source, '未知') AS source,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE pr.is_correct) AS correct_count
            FROM practice_records pr
            JOIN "Quiz" q ON pr.quiz_id = q.id
            WHERE pr.user_id = $1
              AND pr.created_at >= NOW() - ($2 || ' days')::INTERVAL
            GROUP BY q.class, q.source"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut source_map: HashMap<String, Vec<SourceBreakdown>> = HashMap::new();
        for row in &source_rows {
            let class: String = row.get("class");
            source_map.entry(class).or_default().push(SourceBreakdown {
                source: row.get("source"),
                count: row.get("count"),
                correct_count: row.get("correct_count"),
            });
        }

        Ok(rows
            .iter()
            .map(|row| {
                let class: String = row.get("quiz_class");
                SubjectPracticeStats {
                    by_type: type_map.remove(&class).unwrap_or_default(),
                    by_source: source_map.remove(&class).unwrap_or_default(),
                    quiz_class: class,
                    total_count: row.get("total_count"),
                    correct_count: row.get("correct_count"),
                    accuracy: row.get::<Option<f64>, _>("accuracy").unwrap_or(0.0),
                    avg_time_seconds: row.get::<Option<f64>, _>("avg_time_seconds").unwrap_or(0.0),
                }
            })
            .collect())
    }

    async fn get_practice_summary(
        &self,
        user_id: &str,
        days: i32,
    ) -> Result<PracticeSummary, AppError> {
        let days = days.clamp(1, 365);
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let row = sqlx::query(
            r#"SELECT
                COUNT(*) AS total_practiced,
                COUNT(*) FILTER (WHERE is_correct) AS total_correct,
                ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::double precision AS overall_accuracy,
                ROUND(AVG(time_spent_seconds)::numeric, 1)::double precision AS avg_time_seconds,
                COUNT(DISTINCT DATE(created_at)) AS total_days_practiced
            FROM practice_records
            WHERE user_id = $1
              AND created_at >= NOW() - ($2 || ' days')::INTERVAL"#,
        )
        .bind(user_uuid)
        .bind(days.to_string())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let total_practiced: i64 = row.get("total_practiced");
        let total_correct: i64 = row.get("total_correct");

        // Calculate streaks
        let (current_streak, longest_streak) = if total_practiced == 0 {
            (0, 0)
        } else {
            self.calculate_streaks(user_id).await?
        };

        Ok(PracticeSummary {
            total_practiced,
            total_correct,
            overall_accuracy: row.get::<Option<f64>, _>("overall_accuracy").unwrap_or(0.0),
            avg_time_seconds: row.get::<Option<f64>, _>("avg_time_seconds").unwrap_or(0.0),
            current_streak,
            longest_streak,
            total_days_practiced: row.get("total_days_practiced"),
        })
    }

    async fn get_practice_calendar(
        &self,
        user_id: &str,
        year: i32,
    ) -> Result<Vec<CalendarDayData>, AppError> {
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let rows = sqlx::query(
            r#"SELECT
                DATE(created_at)::text AS date,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE is_correct) AS correct_count
            FROM practice_records
            WHERE user_id = $1
              AND EXTRACT(YEAR FROM created_at) = $2
            GROUP BY DATE(created_at)
            ORDER BY date"#,
        )
        .bind(user_uuid)
        .bind(year)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|row| CalendarDayData {
                date: row.get("date"),
                count: row.get("count"),
                correct_count: row.get("correct_count"),
            })
            .collect())
    }

    async fn get_practice_records(
        &self,
        user_id: &str,
        limit: i32,
    ) -> Result<Vec<PracticeRecord>, AppError> {
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let rows = sqlx::query(
            r#"SELECT id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds, created_at
               FROM practice_records WHERE user_id = $1
               ORDER BY created_at DESC LIMIT $2"#,
        )
        .bind(user_uuid)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let quiz_ids: Vec<String> = rows.iter().map(|r| r.get("quiz_id")).collect();
        let quiz_type_map = self.get_quiz_types_map(&quiz_ids).await?;

        Ok(rows
            .iter()
            .map(|row| {
                let quiz_id: String = row.get("quiz_id");
                let (quiz_type, quiz_class) = quiz_type_map.get(&quiz_id)
                    .cloned()
                    .unwrap_or_else(|| ("unknown".to_string(), "unknown".to_string()));
                PracticeRecord {
                    id: row.get::<uuid::Uuid, _>("id").to_string(),
                    user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
                    quiz_id,
                    quiz_type,
                    quiz_class,
                    user_answer: row.get("user_answer"),
                    is_correct: row.get("is_correct"),
                    time_spent_seconds: row.get("time_spent_seconds"),
                    created_at: row
                        .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                        .map(|t| t.to_rfc3339())
                        .unwrap_or_default(),
                }
            })
            .collect())
    }

    async fn get_discussion_comments(
        &self,
        quiz_id: &str,
        page: i32,
        limit: i32,
    ) -> Result<(Vec<DiscussionCommentWithReplies>, i64), AppError> {
        let offset = (page - 1).max(0) * limit;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM discussion_comments WHERE quiz_id = $1 AND parent_id IS NULL",
        )
        .bind(quiz_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = sqlx::query(
            r#"SELECT dc.id, dc.quiz_id, dc.user_id, u.username, u.avatar_url,
                      dc.parent_id, dc.content, dc.created_at, dc.updated_at
               FROM discussion_comments dc
               JOIN users u ON dc.user_id::text = u.id::text
               WHERE dc.quiz_id = $1 AND dc.parent_id IS NULL
               ORDER BY dc.created_at DESC
               LIMIT $2 OFFSET $3"#,
        )
        .bind(quiz_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let top_level_ids: Vec<String> = rows.iter().map(|r| r.get::<uuid::Uuid, _>("id").to_string()).collect();

        let mut replies_map: std::collections::HashMap<String, Vec<DiscussionCommentWithAuthor>> =
            std::collections::HashMap::new();

        if !top_level_ids.is_empty() {
            let placeholders: Vec<String> = top_level_ids
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            let query_sql = format!(
                r#"SELECT dc.id, dc.quiz_id, dc.user_id, u.username, u.avatar_url,
                          dc.parent_id, dc.content, dc.created_at, dc.updated_at
                   FROM discussion_comments dc
                   JOIN users u ON dc.user_id::text = u.id::text
                   WHERE dc.parent_id::text IN ({})
                   ORDER BY dc.created_at ASC"#,
                placeholders.join(",")
            );
            let mut query = sqlx::query(&query_sql);
            for id in &top_level_ids {
                query = query.bind(id);
            }
            let reply_rows = query
                .fetch_all(&self.pool)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

            for row in &reply_rows {
                let parent_id: String = row.get::<uuid::Uuid, _>("parent_id").to_string();
                let author = row_to_comment_with_author(row);
                replies_map.entry(parent_id).or_default().push(author);
            }
        }

        let results = rows
            .iter()
            .map(|row| {
                let id: String = row.get::<uuid::Uuid, _>("id").to_string();
                let comment = row_to_comment_with_author(row);
                let comment_replies = replies_map.remove(&id).unwrap_or_default();
                DiscussionCommentWithReplies {
                    comment,
                    replies: comment_replies,
                }
            })
            .collect();

        Ok((results, total))
    }

    async fn create_discussion_comment(
        &self,
        quiz_id: &str,
        user_id: &str,
        parent_id: Option<&str>,
        content: &str,
    ) -> Result<DiscussionCommentWithAuthor, AppError> {
        let id = uuid::Uuid::new_v4();

        let parent_uuid: Option<uuid::Uuid> = parent_id
            .map(|p| uuid::Uuid::parse_str(p))
            .transpose()
            .map_err(|e| AppError::BadRequest(format!("Invalid parent_id: {}", e)))?;

        sqlx::query(
            r#"INSERT INTO discussion_comments (id, quiz_id, user_id, parent_id, content)
               VALUES ($1, $2, $3::uuid, $4, $5)"#,
        )
        .bind(&id)
        .bind(quiz_id)
        .bind(user_id)
        .bind(parent_uuid)
        .bind(content)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let row = sqlx::query(
            r#"SELECT dc.id, dc.quiz_id, dc.user_id, u.username, u.avatar_url,
                      dc.parent_id, dc.content, dc.created_at, dc.updated_at
               FROM discussion_comments dc
               JOIN users u ON dc.user_id::text = u.id::text
               WHERE dc.id = $1"#,
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(row_to_comment_with_author(&row))
    }

    async fn delete_discussion_comment(
        &self,
        comment_id: &str,
        user_id: &str,
    ) -> Result<(), AppError> {
        let comment_uuid = uuid::Uuid::parse_str(comment_id)
            .map_err(|e| AppError::BadRequest(format!("Invalid comment_id: {}", e)))?;
        let result = sqlx::query(
            "DELETE FROM discussion_comments WHERE id = $1 AND user_id = $2::uuid",
        )
        .bind(&comment_uuid)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(
                "Comment not found or access denied".to_string(),
            ));
        }
        Ok(())
    }
}

impl PostgresRepository {
    async fn get_quiz_types_map(
        &self,
        quiz_ids: &[String],
    ) -> Result<std::collections::HashMap<String, (String, String)>, AppError> {
        if quiz_ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        let placeholders: Vec<String> = quiz_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("${}", i + 1))
            .collect();
        let query_sql = format!(
            "SELECT id, type, class FROM \"Quiz\" WHERE id IN ({})",
            placeholders.join(",")
        );

        let mut query = sqlx::query(&query_sql);
        for id in quiz_ids {
            query = query.bind(id);
        }
        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            let id: String = row.get("id");
            let quiz_type: String = row.get("type");
            let quiz_class: String = row.get("class");
            map.insert(id, (quiz_type, quiz_class));
        }
        Ok(map)
    }

    async fn calculate_streaks(&self, user_id: &str) -> Result<(i32, i32), AppError> {
        let user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| AppError::Internal(format!("Invalid user_id: {}", e)))?;

        let rows = sqlx::query(
            r#"SELECT DISTINCT DATE(created_at)::text AS practice_date
            FROM practice_records
            WHERE user_id = $1
            ORDER BY practice_date DESC"#,
        )
        .bind(user_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        if rows.is_empty() {
            return Ok((0, 0));
        }

        let dates: Vec<chrono::NaiveDate> = rows
            .iter()
            .filter_map(|r| {
                let s: Option<String> = r.get("practice_date");
                s.and_then(|v| chrono::NaiveDate::parse_from_str(&v, "%Y-%m-%d").ok())
            })
            .collect();

        if dates.is_empty() {
            return Ok((0, 0));
        }

        let today = chrono::Local::now().date_naive();
        let yesterday = today - TimeDelta::days(1);

        // Calculate current streak
        let mut current_streak;
        if dates[0] == today || dates[0] == yesterday {
            dates[0]
        } else {
            // Most recent practice is older than yesterday — no active streak
            let mut longest = 0i32;
            let mut streak = 1i32;
            for i in 1..dates.len() {
                if dates[i - 1] - dates[i] == TimeDelta::days(1) {
                    streak += 1;
                } else {
                    longest = longest.max(streak);
                    streak = 1;
                }
            }
            longest = longest.max(streak);
            return Ok((0, longest));
        };

        current_streak = 1;
        for i in 1..dates.len() {
            if dates[i - 1] - dates[i] == TimeDelta::days(1) {
                current_streak += 1;
            } else {
                break;
            }
        }

        // Calculate longest streak
        let mut longest_streak = current_streak;
        let mut streak = 1i32;
        for i in 1..dates.len() {
            if dates[i - 1] - dates[i] == TimeDelta::days(1) {
                streak += 1;
                longest_streak = longest_streak.max(streak);
            } else {
                streak = 1;
            }
        }

        Ok((current_streak, longest_streak))
    }
}

fn row_to_comment_with_author(row: &sqlx::postgres::PgRow) -> DiscussionCommentWithAuthor {
    DiscussionCommentWithAuthor {
        id: row.get::<uuid::Uuid, _>("id").to_string(),
        quiz_id: row.get("quiz_id"),
        user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
        username: row.get("username"),
        avatar_url: row.get("avatar_url"),
        parent_id: row.get::<Option<uuid::Uuid>, _>("parent_id").map(|u| u.to_string()),
        content: row.get("content"),
        created_at: row
            .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .map(|t| t.to_rfc3339())
            .unwrap_or_default(),
        updated_at: row
            .try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at")
            .map(|t| t.to_rfc3339())
            .unwrap_or_default(),
    }
}

fn row_to_paper_record(row: &sqlx::postgres::PgRow) -> PaperRecord {
    PaperRecord {
        id: row.get::<uuid::Uuid, _>("id").to_string(),
        user_id: row.get::<uuid::Uuid, _>("user_id").to_string(),
        paper_id: row.get("paper_id"),
        score: row.get("score"),
        total_questions: row.get("total_questions"),
        correct_count: row.get("correct_count"),
        answered_count: row.try_get("answered_count").unwrap_or(0),
        status: row.get("status"),
        started_at: row.try_get::<chrono::NaiveDateTime, _>("started_at").ok().map(|t| t.to_string()),
        completed_at: row.try_get::<chrono::NaiveDateTime, _>("completed_at").ok().map(|t| t.to_string()),
        created_at: row.try_get::<chrono::NaiveDateTime, _>("created_at").map(|t| t.to_string()).unwrap_or_default(),
    }
}

fn row_to_paper_answer(row: &sqlx::postgres::PgRow) -> PaperAnswer {
    PaperAnswer {
        id: row.get::<uuid::Uuid, _>("id").to_string(),
        paper_record_id: row.get::<uuid::Uuid, _>("paper_record_id").to_string(),
        quiz_id: row.get("quiz_id"),
        user_answer: row.get("user_answer"),
        is_correct: row.get("is_correct"),
        time_spent_seconds: row.get("time_spent_seconds"),
        order_index: row.get("order_index"),
        created_at: row.try_get::<chrono::NaiveDateTime, _>("created_at").map(|t| t.to_string()).unwrap_or_default(),
    }
}

fn row_to_quiz(row: &sqlx::postgres::PgRow) -> Quiz {
    Quiz {
        id: row.get("id"),
        quiz_type: row.get("type"),
        class: row.get("class"),
        unit: row.get("unit"),
        question: row.get("question"),
        main_question: None,
        answer: row.get("answer"),
        source: row.get("source"),
        extracted_year: row.get("extractedYear"),
        processed_at: row
            .get::<Option<chrono::NaiveDateTime>, _>("processedAt")
            .map(|t| t.and_utc().to_rfc3339()),
        created_at: row
            .try_get::<chrono::NaiveDateTime, _>("createdAt")
            .map(|t| t.and_utc().to_rfc3339())
            .unwrap_or_default(),
    }
}

fn row_to_quiz_with_details(row: &sqlx::postgres::PgRow) -> QuizWithDetails {
    let quiz_type: String = row.get("type");
    let quiz_id: String = row.get("id");

    let quiz = Quiz {
        id: quiz_id.clone(),
        quiz_type: quiz_type.clone(),
        class: row.get("class"),
        unit: row.get("unit"),
        question: row.get("question"),
        main_question: row
            .try_get::<Option<String>, _>("mainQuestion")
            .ok()
            .flatten(),
        answer: row.get("answer"),
        source: row.get("source"),
        extracted_year: row.get("extractedYear"),
        processed_at: row
            .get::<Option<chrono::NaiveDateTime>, _>("processedAt")
            .map(|t| t.and_utc().to_rfc3339()),
        created_at: row
            .try_get::<chrono::NaiveDateTime, _>("createdAt")
            .map(|t| t.and_utc().to_rfc3339())
            .unwrap_or_default(),
    };

    let options_json: Option<serde_json::Value> = row.get("options");
    let questions_json: Option<serde_json::Value> = row.try_get("questions").ok().flatten();

    let (options, options_map, sub_questions) = match quiz_type.as_str() {
        "A3" => {
            let mut flat_options = Vec::new();
            let mut map: HashMap<String, Vec<QuizOption>> = HashMap::new();

            if let Some(serde_json::Value::Object(obj)) = &options_json {
                for (key, val) in obj {
                    if let serde_json::Value::Array(arr) = val {
                        let opts: Vec<QuizOption> = arr
                            .iter()
                            .filter_map(|item| {
                                Some(QuizOption {
                                    id: String::new(),
                                    quiz_id: quiz_id.clone(),
                                    oid: item.get("oid")?.as_str()?.to_string(),
                                    text: item.get("text")?.as_str()?.to_string(),
                                })
                            })
                            .collect();
                        flat_options.extend(opts.iter().cloned());
                        map.insert(key.clone(), opts);
                    }
                }
            }

            let subs = extract_sub_questions(&questions_json);
            (flat_options, Some(map), Some(subs))
        }
        "B" => {
            let flat_options = extract_flat_options(&options_json, &quiz_id);
            let subs = extract_sub_questions(&questions_json);
            (flat_options, None, Some(subs))
        }
        _ => {
            let flat_options = extract_flat_options(&options_json, &quiz_id);
            (flat_options, None, None)
        }
    };

    let point: Option<String> = row.get("analysis_point");
    let discuss: Option<String> = row.get("analysis_discuss");
    let analysis = match (point, discuss) {
        (Some(p), Some(d)) if !p.is_empty() || !d.is_empty() => Some(QuizAnalysis {
            id: quiz_id.clone(),
            quiz_id: quiz_id.clone(),
            point: p,
            discuss: d,
        }),
        _ => None,
    };

    QuizWithDetails {
        quiz,
        options,
        options_map: if options_map.is_some() {
            Some(options_map.unwrap())
        } else {
            None
        },
        sub_questions,
        analysis,
        tags: Vec::new(),
    }
}

fn extract_flat_options(
    options_json: &Option<serde_json::Value>,
    quiz_id: &str,
) -> Vec<QuizOption> {
    match options_json {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|item| {
                Some(QuizOption {
                    id: String::new(),
                    quiz_id: quiz_id.to_string(),
                    oid: item.get("oid")?.as_str()?.to_string(),
                    text: item.get("text")?.as_str()?.to_string(),
                })
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn extract_sub_questions(questions_json: &Option<serde_json::Value>) -> Vec<SubQuestion> {
    match questions_json {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|item| {
                Some(SubQuestion {
                    question_id: item.get("questionId")?.as_i64()? as i32,
                    question_text: item.get("questionText")?.as_str()?.to_string(),
                    answer: item.get("answer")?.as_str()?.to_string(),
                })
            })
            .collect(),
        _ => Vec::new(),
    }
}

async fn query_with_params(
    pool: &PgPool,
    query_sql: &str,
    params: &[String],
) -> Result<Vec<sqlx::postgres::PgRow>, AppError> {
    let mut query = sqlx::query(query_sql);
    for param in params {
        query = query.bind(param);
    }
    query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))
}

async fn count_with_params(pool: &PgPool, sql: &str, params: &[String]) -> Result<i64, AppError> {
    let mut query = sqlx::query_scalar::<_, i64>(sql);
    for param in params {
        query = query.bind(param);
    }
    query
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))
}

async fn query_tags(pool: &PgPool, quiz_id: &str) -> Result<Vec<QuizTag>, AppError> {
    let rows = sqlx::query("SELECT id, \"quizId\", \"userId\", value, type, \"createdAt\" FROM \"QuizTag\" WHERE \"quizId\" = $1")
        .bind(quiz_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|row| QuizTag {
            id: row.get("id"),
            quiz_id: row.get("quizId"),
            user_id: row.get("userId"),
            value: row.get("value"),
            tag_type: row.get("type"),
            created_at: row
                .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        })
        .collect())
}

fn build_conditions(filter: &QuizFilter) -> (Vec<String>, Vec<String>) {
    let mut conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(ref types) = filter.types {
        let type_list: Vec<&str> = types
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if !type_list.is_empty() {
            let placeholders: Vec<String> = type_list
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            conditions.push(format!("type IN ({})", placeholders.join(",")));
            for t in type_list {
                params.push(t.to_string());
            }
        }
    }

    if let Some(ref classes) = filter.classes {
        let class_list: Vec<&str> = classes
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if !class_list.is_empty() {
            let params_start = params.len();
            let placeholders: Vec<String> = class_list
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", params_start + i + 1))
                .collect();
            conditions.push(format!("class IN ({})", placeholders.join(",")));
            for c in class_list {
                params.push(c.to_string());
            }
        }
    }

    if let Some(ref units) = filter.units {
        let unit_list: Vec<&str> = units
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if !unit_list.is_empty() {
            let params_start = params.len();
            let unit_conditions: Vec<String> = unit_list
                .iter()
                .enumerate()
                .map(|(i, u)| {
                    params.push(u.to_string());
                    format!("unit LIKE ${}", params_start + i + 1)
                })
                .collect();
            conditions.push(format!("({})", unit_conditions.join(" OR ")));
            let params_len = params.len();
            for i in params_start..params_len {
                let val = params[i].clone();
                params[i] = format!("%{}%", val);
            }
        }
    }

    if let Some(ref sources) = filter.sources {
        let source_list: Vec<&str> = sources
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if !source_list.is_empty() {
            let params_start = params.len();
            let placeholders: Vec<String> = source_list
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", params_start + i + 1))
                .collect();
            conditions.push(format!("source IN ({})", placeholders.join(",")));
            for s in source_list {
                params.push(s.to_string());
            }
        }
    }

    if let Some(ref years) = filter.years {
        let year_list: Vec<&str> = years
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if !year_list.is_empty() {
            let params_start = params.len();
            let placeholders: Vec<String> = year_list
                .iter()
                .enumerate()
                .map(|(i, _)| format!("${}", params_start + i + 1))
                .collect();
            conditions.push(format!("\"extractedYear\" IN ({})", placeholders.join(",")));
            for y in year_list {
                params.push(y.to_string());
            }
        }
    }

    if let Some(ref search) = filter.search {
        if !search.trim().is_empty() {
            let params_start = params.len();
            conditions.push(format!("question LIKE ${}", params_start + 1));
            params.push(format!("%{}%", search.trim()));
        }
    }

    (conditions, params)
}

fn build_order_clause(filter: &QuizFilter) -> String {
    let sort_by = filter.sort_by.as_deref().unwrap_or("createdAt");
    let order = filter.order.as_deref().unwrap_or("DESC");

    let valid_sorts = [
        ("createdAt", "\"createdAt\""),
        ("type", "type"),
        ("class", "class"),
        ("unit", "unit"),
        ("source", "source"),
        ("extractedYear", "\"extractedYear\""),
    ];
    let sort_col = valid_sorts
        .iter()
        .find(|(s, _)| *s == sort_by)
        .map(|(_, col)| *col)
        .unwrap_or("\"createdAt\"");

    let valid_orders = ["ASC", "DESC"];
    let order_dir = if valid_orders.contains(&order.to_uppercase().as_str()) {
        order.to_uppercase()
    } else {
        "DESC".to_string()
    };

    format!("ORDER BY {} {}", sort_col, order_dir)
}
