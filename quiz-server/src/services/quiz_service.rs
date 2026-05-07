use crate::db::schema::*;
use crate::db::DbPool;
use crate::error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Default, Clone)]
pub struct QuizFilter {
    // Single or multiple values (comma-separated)
    pub types: Option<String>,
    pub classes: Option<String>,
    pub units: Option<String>,
    pub sources: Option<String>,
    pub years: Option<String>,

    // Search
    pub search: Option<String>,

    // Pagination
    pub page: Option<u32>,
    pub limit: Option<u32>,

    // Sorting
    pub sort_by: Option<String>,
    pub order: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: u32,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

#[derive(Debug, Serialize)]
pub struct QuizFilterMeta {
    pub types: Vec<String>,
    pub classes: Vec<String>,
    pub units: Vec<String>,
    pub sources: Vec<String>,
    pub years: Vec<i32>,
}

#[derive(Debug, Serialize)]
pub struct QuizFilterResponse {
    pub meta: QuizFilterMeta,
    pub data: Vec<Quiz>,
}

pub struct QuizService;

impl QuizService {
    pub fn get_quizzes(
        pool: &DbPool,
        filter: &QuizFilter,
    ) -> Result<PaginatedResponse<Quiz>, AppError> {
        let conn = pool.get()?;

        let page = filter.page.unwrap_or(1).max(1);
        let limit = filter.limit.unwrap_or(20).min(100);
        let offset = (page - 1) * limit;

        let (conditions, params) = Self::build_conditions(filter);

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM Quiz {}", where_clause);
        let total = Self::count_with_params(&conn, &count_sql, &params)?;

        let order_clause = Self::build_order_clause(filter);
        let query_sql = format!(
            "SELECT id, type, class, unit, question, answer, source, extractedYear, processedAt, createdAt
             FROM Quiz {}
             {} {} {}",
            where_clause,
            if where_clause.is_empty() { "ORDER BY createdAt DESC".to_string() } else { order_clause },
            format!("LIMIT {}", limit),
            format!("OFFSET {}", offset)
        );

        let quizzes = Self::query_quizzes(&conn, &query_sql, &params)?;

        Ok(PaginatedResponse {
            data: quizzes,
            total,
            page,
            limit,
            total_pages: (total + limit - 1) / limit,
        })
    }

    pub fn get_filter_meta(pool: &DbPool) -> Result<QuizFilterMeta, AppError> {
        let conn = pool.get()?;

        let types = Self::query_string_list(&conn, "SELECT DISTINCT type FROM Quiz ORDER BY type")?;
        let classes = Self::query_string_list(&conn, "SELECT DISTINCT class FROM Quiz ORDER BY class")?;
        let sources = Self::query_string_list(&conn, "SELECT DISTINCT source FROM Quiz WHERE source IS NOT NULL ORDER BY source")?;
        let years: Vec<i32> = Self::query_i32_list(&conn, "SELECT DISTINCT extractedYear FROM Quiz WHERE extractedYear IS NOT NULL ORDER BY extractedYear DESC")?;
        let units = Self::query_string_list(&conn, "SELECT DISTINCT unit FROM Quiz ORDER BY unit LIMIT 50")?;

        Ok(QuizFilterMeta {
            types,
            classes,
            units,
            sources,
            years,
        })
    }

    fn query_string_list(conn: &r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>, sql: &str) -> Result<Vec<String>, AppError> {
        let mut stmt = conn.prepare(sql)?;
        let result: Vec<String> = stmt.query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(result)
    }

    fn query_i32_list(conn: &r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>, sql: &str) -> Result<Vec<i32>, AppError> {
        let mut stmt = conn.prepare(sql)?;
        let result: Vec<i32> = stmt.query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(result)
    }

    pub fn search_quizzes(
        pool: &DbPool,
        filter: &QuizFilter,
    ) -> Result<PaginatedResponse<Quiz>, AppError> {
        Self::get_quizzes(pool, filter)
    }

    pub fn get_quiz_by_id(pool: &DbPool, id: &str) -> Result<QuizWithDetails, AppError> {
        let conn = pool.get()?;

        let quiz: Quiz = conn.query_row(
            "SELECT id, type, class, unit, question, answer, source, extractedYear, processedAt, createdAt
             FROM Quiz WHERE id = ?",
            [id],
            |row| {
                Ok(Quiz {
                    id: row.get(0)?,
                    quiz_type: row.get(1)?,
                    class: row.get(2)?,
                    unit: row.get(3)?,
                    question: row.get(4)?,
                    answer: row.get(5)?,
                    source: row.get(6)?,
                    extracted_year: row.get(7)?,
                    processed_at: row.get(8)?,
                    created_at: row.get(9)?,
                })
            },
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Quiz not found: {}", id)),
            _ => AppError::Database(e),
        })?;

        let options: Vec<QuizOption> = {
            let mut stmt = conn.prepare(
                "SELECT id, quizId, oid, text FROM QuizOption WHERE quizId = ?"
            )?;
            let rows = stmt.query_map([id], |row| {
                Ok(QuizOption {
                    id: row.get(0)?,
                    quiz_id: row.get(1)?,
                    oid: row.get(2)?,
                    text: row.get(3)?,
                })
            })?;
            rows.filter_map(|r| r.ok()).collect()
        };

        let analysis: Option<QuizAnalysis> = {
            let result: Result<QuizAnalysis, _> = conn.query_row(
                "SELECT id, quizId, point, discuss FROM QuizAnalysis WHERE quizId = ?",
                [id],
                |row| {
                    Ok(QuizAnalysis {
                        id: row.get(0)?,
                        quiz_id: row.get(1)?,
                        point: row.get(2)?,
                        discuss: row.get(3)?,
                    })
                },
            );
            result.ok()
        };

        let tags: Vec<QuizTag> = {
            let mut stmt = conn.prepare(
                "SELECT id, quizId, userId, value, type, createdAt FROM QuizTag WHERE quizId = ?"
            )?;
            let rows = stmt.query_map([id], |row| {
                Ok(QuizTag {
                    id: row.get(0)?,
                    quiz_id: row.get(1)?,
                    user_id: row.get(2)?,
                    value: row.get(3)?,
                    tag_type: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?;
            rows.filter_map(|r| r.ok()).collect()
        };

        Ok(QuizWithDetails { quiz, options, analysis, tags })
    }

    pub fn get_random_quizzes(
        pool: &DbPool,
        filter: &QuizFilter,
        limit: u32,
    ) -> Result<Vec<Quiz>, AppError> {
        let conn = pool.get()?;

        let (conditions, params) = Self::build_conditions(filter);

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let query_sql = format!(
            "SELECT id, type, class, unit, question, answer, source, extractedYear, processedAt, createdAt
             FROM Quiz {}
             ORDER BY RANDOM()
             LIMIT {}",
            where_clause, limit
        );

        let quizzes = Self::query_quizzes(&conn, &query_sql, &params)?;

        Ok(quizzes)
    }

    fn build_conditions(filter: &QuizFilter) -> (Vec<String>, Vec<String>) {
        let mut conditions = Vec::new();
        let mut params: Vec<String> = Vec::new();

        // Handle multiple types (comma-separated)
        if let Some(ref types) = filter.types {
            let type_list: Vec<&str> = types.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if !type_list.is_empty() {
                let placeholders: Vec<String> = type_list.iter().map(|_| "?".to_string()).collect();
                conditions.push(format!("type IN ({})", placeholders.join(",")));
                for t in type_list {
                    params.push(t.to_string());
                }
            }
        }

        // Handle multiple classes (comma-separated)
        if let Some(ref classes) = filter.classes {
            let class_list: Vec<&str> = classes.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if !class_list.is_empty() {
                let placeholders: Vec<String> = class_list.iter().map(|_| "?".to_string()).collect();
                conditions.push(format!("class IN ({})", placeholders.join(",")));
                for c in class_list {
                    params.push(c.to_string());
                }
            }
        }

        // Handle multiple units (comma-separated or partial match)
        if let Some(ref units) = filter.units {
            let unit_list: Vec<&str> = units.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if !unit_list.is_empty() {
                // Use OR for multiple units within same column
                let unit_conditions: Vec<String> = unit_list.iter()
                    .map(|u| {
                        params.push(u.to_string());
                        format!("unit LIKE ?")
                    })
                    .collect();
                conditions.push(format!("({})", unit_conditions.join(" OR ")));
                // Update params to add % for LIKE
                let params_len = params.len();
                for i in (params_len - unit_list.len())..params_len {
                    let val = params[i].clone();
                    params[i] = format!("%{}%", val);
                }
            }
        }

        // Handle multiple sources (comma-separated)
        if let Some(ref sources) = filter.sources {
            let source_list: Vec<&str> = sources.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if !source_list.is_empty() {
                let placeholders: Vec<String> = source_list.iter().map(|_| "?".to_string()).collect();
                conditions.push(format!("source IN ({})", placeholders.join(",")));
                for s in source_list {
                    params.push(s.to_string());
                }
            }
        }

        // Handle multiple years (comma-separated)
        if let Some(ref years) = filter.years {
            let year_list: Vec<&str> = years.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if !year_list.is_empty() {
                let placeholders: Vec<String> = year_list.iter().map(|_| "?".to_string()).collect();
                conditions.push(format!("extractedYear IN ({})", placeholders.join(",")));
                for y in year_list {
                    params.push(y.to_string());
                }
            }
        }

        // Full-text search on question
        if let Some(ref search) = filter.search {
            if !search.trim().is_empty() {
                conditions.push("question LIKE ?".to_string());
                params.push(format!("%{}%", search.trim()));
            }
        }

        (conditions, params)
    }

    fn build_order_clause(filter: &QuizFilter) -> String {
        let sort_by = filter.sort_by.as_deref().unwrap_or("createdAt");
        let order = filter.order.as_deref().unwrap_or("DESC");

        let valid_sorts = ["createdAt", "type", "class", "unit", "source", "extractedYear"];
        let sort_col = if valid_sorts.contains(&sort_by) {
            sort_by
        } else {
            "createdAt"
        };

        let valid_orders = ["ASC", "DESC"];
        let order_dir = if valid_orders.contains(&order.to_uppercase().as_str()) {
            order.to_uppercase()
        } else {
            "DESC".to_string()
        };

        format!("ORDER BY {} {}", sort_col, order_dir)
    }

    fn query_quizzes(
        conn: &r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>,
        query_sql: &str,
        params: &[String],
    ) -> Result<Vec<Quiz>, AppError> {
        if params.is_empty() {
            let mut stmt = conn.prepare(query_sql)?;
            let rows = stmt.query_map([], |row| {
                Ok(Quiz {
                    id: row.get(0)?,
                    quiz_type: row.get(1)?,
                    class: row.get(2)?,
                    unit: row.get(3)?,
                    question: row.get(4)?,
                    answer: row.get(5)?,
                    source: row.get(6)?,
                    extracted_year: row.get(7)?,
                    processed_at: row.get(8)?,
                    created_at: row.get(9)?,
                })
            })?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        } else {
            let mut stmt = conn.prepare(query_sql)?;
            let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter()
                .map(|p| p as &dyn rusqlite::ToSql)
                .collect();
            let rows = stmt.query_map(params_refs.as_slice(), |row| {
                Ok(Quiz {
                    id: row.get(0)?,
                    quiz_type: row.get(1)?,
                    class: row.get(2)?,
                    unit: row.get(3)?,
                    question: row.get(4)?,
                    answer: row.get(5)?,
                    source: row.get(6)?,
                    extracted_year: row.get(7)?,
                    processed_at: row.get(8)?,
                    created_at: row.get(9)?,
                })
            })?;
            Ok(rows.filter_map(|r| r.ok()).collect())
        }
    }

    fn count_with_params(conn: &r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>, sql: &str, params: &[String]) -> Result<u32, AppError> {
        if params.is_empty() {
            let count: u32 = conn.query_row(sql, [], |row| row.get(0))?;
            Ok(count)
        } else {
            let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
            let count: u32 = conn.query_row(sql, params_refs.as_slice(), |row| row.get(0))?;
            Ok(count)
        }
    }
}
