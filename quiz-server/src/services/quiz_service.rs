use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, Default, Clone, ToSchema)]
pub struct QuizFilter {
    pub types: Option<String>,
    pub classes: Option<String>,
    pub units: Option<String>,
    pub sources: Option<String>,
    pub years: Option<String>,
    pub search: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort_by: Option<String>,
    pub order: Option<String>,
    pub include_details: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchIdsRequest {
    pub quiz_ids: Vec<String>,
}
