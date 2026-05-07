use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    pub id: String,
    #[serde(rename = "type")]
    pub quiz_type: String,
    pub class: String,
    pub unit: String,
    pub question: String,
    pub answer: String,
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
    pub analysis: Option<QuizAnalysis>,
    pub tags: Vec<QuizTag>,
}
