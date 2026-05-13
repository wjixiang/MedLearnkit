import { MongoClient, ObjectId } from "mongodb";
import { Client } from "pg";

const MONGODB_URI = "mongodb://127.0.0.1:27017";
const DATABASE_NAME = "quizbank";

interface QuizOption {
  oid: string;
  text: string;
}

interface SubQuiz {
  subQuizId: number;
  question: string;
  options: QuizOption[];
  answer: string;
  _id: ObjectId;
}

interface QuizAnalysis {
  point: string;
  discuss: string;
  link: string[];
  _id: ObjectId;
}

interface QuizDocument {
  _id: ObjectId;
  type: string;
  class: string;
  unit: string;
  tags: string[];
  mainQuestion?: string;
  subQuizs?: SubQuiz[];
  question?: string;
  options?: QuizOption[];
  answer: string;
  analysis?: QuizAnalysis;
  source: string;
  extractedYear: number;
  processedAt: Date;
  embedding?: number[];
  __v: number;
  questions?: Array<{
    questionId: number;
    questionText: string;
    answer: string;
  }>;
}

async function main() {
  console.log("Connecting to MongoDB...");
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DATABASE_NAME);

  console.log("Connecting to PostgreSQL...");
  const pgClient = new Client({
    connectionString: "postgres://admin:fl5ox03@localhost:5430/medquiz",
  });
  await pgClient.connect();

  console.log("Clearing existing Quiz data from PostgreSQL...");
  await pgClient.query('DELETE FROM "QuizTag"');
  await pgClient.query('DELETE FROM "Quiz"');

  console.log("Migrating quizzes...");
  const quizCollection = db.collection<QuizDocument>("quiz");
  const quizCount = await quizCollection.countDocuments();
  console.log(`Found ${quizCount} quizzes to migrate`);

  const batchSize = 500;
  let migrated = 0;

  const cursor = quizCollection.find({});
  let batch: QuizDocument[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (doc) {
      batch.push(doc);
    }

    if (batch.length >= batchSize) {
      await migrateBatch(pgClient, batch);
      migrated += batch.length;
      console.log(`Migrated ${migrated}/${quizCount} quizzes`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await migrateBatch(pgClient, batch);
    migrated += batch.length;
    console.log(`Migrated ${migrated}/${quizCount} quizzes`);
  }

  console.log("Migration complete!");

  await mongoClient.close();
  await pgClient.end();
}

async function migrateBatch(pgClient: Client, batch: QuizDocument[]) {
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const quiz of batch) {
    const { quizId, quizType, mainQuestion, questionText, optionsJson, questionsJson, answer, analysisPoint, analysisDiscuss } = transformQuiz(quiz);

    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14})`
    );

    values.push(
      quizId,
      quizType,
      quiz.class,
      quiz.unit,
      questionText,
      mainQuestion,
      answer,
      quiz.source,
      quiz.extractedYear,
      quiz.processedAt,
      new Date(),
      optionsJson,
      questionsJson,
      analysisPoint,
      analysisDiscuss
    );

    paramIndex += 15;
  }

  const query = `INSERT INTO "Quiz" (
    id, type, class, unit, question, "mainQuestion", answer, source,
    "extractedYear", "processedAt", "createdAt", options, questions,
    "analysis_point", "analysis_discuss"
  ) VALUES ${placeholders.join(", ")}`;

  try {
    await pgClient.query(query, values);
  } catch (error) {
    console.error("Batch insert failed, falling back to individual inserts...");
    for (const quiz of batch) {
      try {
        await migrateQuizIndividual(pgClient, quiz);
      } catch (e) {
        console.error(`Failed to migrate quiz ${quiz._id}:`, e);
      }
    }
  }
}

function transformQuiz(quiz: QuizDocument) {
  const quizId = quiz._id.toString();
  const quizType = quiz.type;

  let mainQuestion: string | null = null;
  let questionText: string | null = null;
  let optionsJson: string | null = null;
  let questionsJson: string | null = null;
  let answer: string = quiz.answer;

  if (quizType === "A3") {
    mainQuestion = quiz.mainQuestion || null;
    questionText = null;

    if (quiz.subQuizs && quiz.subQuizs.length > 0) {
      const optionsMap: Record<string, QuizOption[]> = {};
      const subQuestions: Array<{ questionId: number; questionText: string; answer: string }> = [];

      for (const subQuiz of quiz.subQuizs) {
        optionsMap[subQuiz.subQuizId.toString()] = subQuiz.options;
        subQuestions.push({
          questionId: subQuiz.subQuizId,
          questionText: subQuiz.question,
          answer: subQuiz.answer,
        });
      }

      optionsJson = JSON.stringify(optionsMap);
      questionsJson = JSON.stringify(subQuestions);
    }
    answer = "";
  } else if (quizType === "B") {
    mainQuestion = null;
    questionText = null;

    if (quiz.questions && quiz.questions.length > 0) {
      const subQuestions = quiz.questions.map(q => ({
        questionId: q.questionId,
        questionText: q.questionText,
        answer: q.answer,
      }));
      questionsJson = JSON.stringify(subQuestions);
    }

    if (quiz.options) {
      optionsJson = JSON.stringify(quiz.options);
    }
    answer = "";
  } else {
    questionText = quiz.question || null;
    mainQuestion = null;
    optionsJson = quiz.options ? JSON.stringify(quiz.options) : null;
    questionsJson = null;
  }

  const analysisPoint = quiz.analysis?.point || "";
  const analysisDiscuss = quiz.analysis?.discuss || "";

  return { quizId, quizType, mainQuestion, questionText, optionsJson, questionsJson, answer, analysisPoint, analysisDiscuss };
}

async function migrateQuizIndividual(pgClient: Client, quiz: QuizDocument) {
  const { quizId, quizType, mainQuestion, questionText, optionsJson, questionsJson, answer, analysisPoint, analysisDiscuss } = transformQuiz(quiz);

  await pgClient.query(
    `INSERT INTO "Quiz" (
      id, type, class, unit, question, "mainQuestion", answer, source,
      "extractedYear", "processedAt", "createdAt", options, questions,
      "analysis_point", "analysis_discuss"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      quizId,
      quizType,
      quiz.class,
      quiz.unit,
      questionText,
      mainQuestion,
      answer,
      quiz.source,
      quiz.extractedYear,
      quiz.processedAt,
      new Date(),
      optionsJson,
      questionsJson,
      analysisPoint,
      analysisDiscuss,
    ]
  );
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});