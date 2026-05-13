use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    pub id: String,
    #[serde(rename = "type")]
    pub quiz_type: String,
    pub class: String,
    pub unit: String,
    pub question: Option<String>,
    pub main_question: Option<String>,
    pub answer: Option<String>,
    pub source: Option<String>,
    pub extracted_year: Option<i32>,
    pub processed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizOption {
    pub id: String,
    pub quiz_id: String,
    pub oid: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubQuestion {
    pub question_id: i32,
    pub question_text: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizAnalysis {
    pub id: String,
    pub quiz_id: String,
    pub point: String,
    pub discuss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizTag {
    pub id: String,
    pub quiz_id: String,
    pub user_id: String,
    pub value: String,
    #[serde(rename = "type")]
    pub tag_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizWithDetails {
    #[serde(flatten)]
    pub quiz: Quiz,
    pub options: Vec<QuizOption>,
    pub options_map: Option<std::collections::HashMap<String, Vec<QuizOption>>>,
    pub sub_questions: Option<Vec<SubQuestion>>,
    pub analysis: Option<QuizAnalysis>,
    pub tags: Vec<QuizTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizFilterMeta {
    pub types: Vec<String>,
    pub classes: Vec<String>,
    pub units: Vec<String>,
    pub sources: Vec<String>,
    pub years: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub quiz_ids: String,
    pub created_at: String,
}
