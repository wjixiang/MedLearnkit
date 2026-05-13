use crate::db::schema::*;
use crate::error::AppError;
use crate::repository::{FilterMeta, QuizRepository};
use crate::services::quiz_service::QuizFilter;
use sqlx::types::chrono;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

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

        let units = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT unit FROM \"Quiz\" ORDER BY unit LIMIT 50",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

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
                    .try_get::<chrono::NaiveDateTime, _>("createdAt")
                    .map(|t| t.to_string())
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
            r#"SELECT id, title, description, quiz_ids, quiz_count, source, tags, "createdAt"
               FROM public_papers ORDER BY "createdAt" DESC"#,
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
                    id: row.get("id"),
                    title: row.get("title"),
                    description: row.get("description"),
                    quiz_ids,
                    quiz_count: row.get("quiz_count"),
                    source: row.get("source"),
                    tags,
                    created_at: row
                        .try_get::<chrono::NaiveDateTime, _>("createdAt")
                        .map(|t| t.to_string())
                        .unwrap_or_default(),
                }
            })
            .collect())
    }

    async fn get_public_paper_by_id(&self, id: &str) -> Result<Option<PublicPaper>, AppError> {
        let row = sqlx::query(
            r#"SELECT id, title, description, quiz_ids, quiz_count, source, tags, "createdAt"
               FROM public_papers WHERE id = $1"#,
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
                id: r.get("id"),
                title: r.get("title"),
                description: r.get("description"),
                quiz_ids,
                quiz_count: r.get("quiz_count"),
                source: r.get("source"),
                tags,
                created_at: r
                    .try_get::<chrono::NaiveDateTime, _>("createdAt")
                    .map(|t| t.to_string())
                    .unwrap_or_default(),
            }
        }))
    }

    // User papers
    async fn get_user_papers(&self, user_id: &str) -> Result<Vec<UserPaper>, AppError> {
        let rows = sqlx::query(
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, "createdAt"
               FROM user_papers WHERE user_id = $1 ORDER BY "createdAt" DESC"#,
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
                    id: row.get("id"),
                    user_id: row.get("user_id"),
                    title: row.get("title"),
                    description: row.get("description"),
                    quiz_ids,
                    quiz_count: row.get("quiz_count"),
                    created_at: row
                        .try_get::<chrono::NaiveDateTime, _>("createdAt")
                        .map(|t| t.to_string())
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
        let id = uuid::Uuid::new_v4().to_string();
        let quiz_ids_json = serde_json::to_value(quiz_ids).unwrap_or(serde_json::Value::Array(vec![]));
        let quiz_count = quiz_ids.len() as i32;

        sqlx::query(
            r#"INSERT INTO user_papers (id, user_id, title, quiz_ids, quiz_count, "createdAt")
               VALUES ($1, $2, $3, $4, $5, NOW())"#,
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
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, "createdAt"
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
            id: row.get("id"),
            user_id: row.get("user_id"),
            title: row.get("title"),
            description: row.get("description"),
            quiz_ids: quiz_ids_out,
            quiz_count: row.get("quiz_count"),
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("createdAt")
                .map(|t| t.to_string())
                .unwrap_or_default(),
        })
    }

    async fn update_user_paper(
        &self,
        id: &str,
        user_id: &str,
        title: &str,
        quiz_ids: &[String],
    ) -> Result<UserPaper, AppError> {
        let quiz_ids_json = serde_json::to_value(quiz_ids).unwrap_or(serde_json::Value::Array(vec![]));
        let quiz_count = quiz_ids.len() as i32;

        let result = sqlx::query(
            r#"UPDATE user_papers
               SET title = $1, quiz_ids = $2, quiz_count = $3, "updatedAt" = NOW()
               WHERE id = $4 AND user_id = $5"#,
        )
        .bind(title)
        .bind(&quiz_ids_json)
        .bind(quiz_count)
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Paper not found or access denied".to_string()));
        }

        let row = sqlx::query(
            r#"SELECT id, user_id, title, description, quiz_ids, quiz_count, "createdAt"
               FROM user_papers WHERE id = $1"#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let quiz_ids_json_out: serde_json::Value = row.get("quiz_ids");
        let quiz_ids_out: Vec<String> =
            serde_json::from_value(quiz_ids_json_out).unwrap_or_default();

        Ok(UserPaper {
            id: row.get("id"),
            user_id: row.get("user_id"),
            title: row.get("title"),
            description: row.get("description"),
            quiz_ids: quiz_ids_out,
            quiz_count: row.get("quiz_count"),
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("createdAt")
                .map(|t| t.to_string())
                .unwrap_or_default(),
        })
    }

    async fn delete_user_paper(&self, id: &str, user_id: &str) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM user_papers WHERE id = $1 AND user_id = $2")
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
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            r#"INSERT INTO practice_records (id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(quiz_id)
        .bind(user_answer)
        .bind(is_correct)
        .bind(time_spent_seconds)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let row = sqlx::query(
            r#"SELECT id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds, "createdAt"
               FROM practice_records WHERE id = $1"#,
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(PracticeRecord {
            id: row.get("id"),
            user_id: row.get("user_id"),
            quiz_id: row.get("quiz_id"),
            quiz_type: quiz_type.to_string(),
            quiz_class: quiz_class.to_string(),
            user_answer: row.get("user_answer"),
            is_correct: row.get("is_correct"),
            time_spent_seconds: row.get("time_spent_seconds"),
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("createdAt")
                .map(|t| t.to_string())
                .unwrap_or_default(),
        })
    }

    async fn get_practice_records(
        &self,
        user_id: &str,
        limit: i32,
    ) -> Result<Vec<PracticeRecord>, AppError> {
        let rows = sqlx::query(
            r#"SELECT id, user_id, quiz_id, user_answer, is_correct, time_spent_seconds, "createdAt"
               FROM practice_records WHERE user_id = $1
               ORDER BY "createdAt" DESC LIMIT $2"#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        // Since practice_records doesn't store quiz_type and quiz_class, we need to join with quiz table
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
                    id: row.get("id"),
                    user_id: row.get("user_id"),
                    quiz_id: quiz_id,
                    quiz_type,
                    quiz_class,
                    user_answer: row.get("user_answer"),
                    is_correct: row.get("is_correct"),
                    time_spent_seconds: row.get("time_spent_seconds"),
                    created_at: row
                        .try_get::<chrono::NaiveDateTime, _>("createdAt")
                        .map(|t| t.to_string())
                        .unwrap_or_default(),
                }
            })
            .collect())
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
            .map(|t| t.to_string()),
        created_at: row
            .try_get::<chrono::NaiveDateTime, _>("createdAt")
            .map(|t| t.to_string())
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
            .map(|t| t.to_string()),
        created_at: row
            .try_get::<chrono::NaiveDateTime, _>("createdAt")
            .map(|t| t.to_string())
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
                .try_get::<chrono::NaiveDateTime, _>("createdAt")
                .map(|t| t.to_string())
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
