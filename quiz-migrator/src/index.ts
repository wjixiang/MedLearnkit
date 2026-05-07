import { MongoClient, ObjectId } from "mongodb";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const MONGODB_URI = "mongodb://127.0.0.1:27017";
const DATABASE_NAME = "quizbank";

interface QuizOption {
  oid: string;
  text: string;
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
  question: string;
  options: QuizOption[];
  answer: string;
  analysis?: QuizAnalysis;
  source: string;
  extractedYear: number;
  processedAt: Date;
  embedding?: number[];
  __v: number;
}

interface QuizSetDocument {
  _id: ObjectId;
  title: string;
  quizzes: Array<{
    quiz: QuizDocument;
  }>;
}

interface QuizTagDocument {
  _id: ObjectId;
  quizId: string;
  userId: string;
  tags: Array<{
    value: string;
    type: string;
    createdAt: Date;
    userId: string;
    quizId: string;
  }>;
}

async function main() {
  console.log("Connecting to MongoDB...");
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db(DATABASE_NAME);

  console.log("Connecting to Prisma (SQLite)...");
  const adapter = new PrismaBetterSqlite3({ url: "file:./data/quiz.db" });
  const prisma = new PrismaClient({ adapter });

  console.log("Running Prisma migrations...");
  // Note: For initial setup, use `npx prisma db push` instead of migrate
  // await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS _prisma_migrations...`;

  console.log("Clearing existing data...");
  await prisma.quizSetQuiz.deleteMany();
  await prisma.quizTag.deleteMany();
  await prisma.quizAnalysis.deleteMany();
  await prisma.quizOption.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.quizSet.deleteMany();

  console.log("Migrating quizzes...");
  const quizCollection = db.collection<QuizDocument>("quiz");
  const quizCount = await quizCollection.countDocuments();
  console.log(`Found ${quizCount} quizzes to migrate`);

  const batchSize = 100;
  let migrated = 0;

  const cursor = quizCollection.find({});
  let batch: QuizDocument[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (doc) {
      batch.push(doc);
    }

    if (batch.length >= batchSize) {
      await migrateBatch(prisma, batch);
      migrated += batch.length;
      console.log(`Migrated ${migrated}/${quizCount} quizzes`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await migrateBatch(prisma, batch);
    migrated += batch.length;
    console.log(`Migrated ${migrated}/${quizCount} quizzes`);
  }

  console.log("Migrating quiz sets...");
  const quizSetCollection = db.collection<QuizSetDocument>("quizSets");
  const quizSetCount = await quizSetCollection.countDocuments();
  console.log(`Found ${quizSetCount} quiz sets to migrate`);

  const quizSetCursor = quizSetCollection.find({});
  let quizSetBatch: QuizSetDocument[] = [];

  while (await quizSetCursor.hasNext()) {
    const doc = await quizSetCursor.next();
    if (doc) {
      quizSetBatch.push(doc);
    }

    if (quizSetBatch.length >= batchSize) {
      await migrateQuizSetBatch(prisma, quizSetBatch);
      console.log(`Migrated quiz sets...`);
      quizSetBatch = [];
    }
  }

  if (quizSetBatch.length > 0) {
    await migrateQuizSetBatch(prisma, quizSetBatch);
  }

  console.log("Migrating quiz tags...");
  const quizTagCollection = db.collection<QuizTagDocument>("quiztags");
  const tagCount = await quizTagCollection.countDocuments();
  console.log(`Found ${tagCount} tag entries to migrate`);

  const tagCursor = quizTagCollection.find({});
  let tagBatch: QuizTagDocument[] = [];

  while (await tagCursor.hasNext()) {
    const doc = await tagCursor.next();
    if (doc) {
      tagBatch.push(doc);
    }

    if (tagBatch.length >= batchSize) {
      await migrateTagBatch(prisma, tagBatch);
      console.log(`Migrated tags...`);
      tagBatch = [];
    }
  }

  if (tagBatch.length > 0) {
    await migrateTagBatch(prisma, tagBatch);
  }

  console.log("Migration complete!");

  await mongoClient.close();
  await prisma.$disconnect();
}

async function migrateBatch(prisma: PrismaClient, batch: QuizDocument[]) {
  for (const quiz of batch) {
    try {
      await prisma.quiz.create({
        data: {
          id: quiz._id.toString(),
          type: quiz.type,
          class: quiz.class,
          unit: quiz.unit,
          question: quiz.question,
          answer: quiz.answer,
          source: quiz.source,
          extractedYear: quiz.extractedYear,
          processedAt: quiz.processedAt,
          options: {
            create: quiz.options.map((opt) => ({
              oid: opt.oid,
              text: opt.text,
            })),
          },
          analysis: quiz.analysis
            ? {
                create: {
                  point: quiz.analysis.point,
                  discuss: quiz.analysis.discuss,
                },
              }
            : undefined,
        },
      });
    } catch (error) {
      console.error(`Failed to migrate quiz ${quiz._id}:`, error);
    }
  }
}

async function upsertQuiz(prisma: PrismaClient, quiz: QuizDocument) {
  const existing = await prisma.quiz.findUnique({
    where: { id: quiz._id.toString() },
  });

  if (existing) {
    return; // Already migrated
  }

  await prisma.quiz.create({
    data: {
      id: quiz._id.toString(),
      type: quiz.type,
      class: quiz.class,
      unit: quiz.unit,
      question: quiz.question,
      answer: quiz.answer,
      source: quiz.source,
      extractedYear: quiz.extractedYear,
      processedAt: quiz.processedAt,
      options: {
        create: quiz.options.map((opt) => ({
          oid: opt.oid,
          text: opt.text,
        })),
      },
      analysis: quiz.analysis
        ? {
            create: {
              point: quiz.analysis.point,
              discuss: quiz.analysis.discuss,
              links: JSON.stringify(quiz.analysis.link),
            },
          }
        : undefined,
    },
  });
}

async function migrateQuizSetBatch(
  prisma: PrismaClient,
  batch: QuizSetDocument[]
) {
  for (const quizSet of batch) {
    try {
      // First, ensure all embedded quizzes exist (upsert)
      for (const q of quizSet.quizzes) {
        try {
          await upsertQuiz(prisma, q.quiz);
        } catch (e) {
          // Quiz might already exist or have issues, continue
        }
      }

      // Then create the quiz set with junction entries
      const created = await prisma.quizSet.create({
        data: {
          title: quizSet.title,
          quizzes: {
            create: quizSet.quizzes.map((q) => ({
              quizId: q.quiz._id.toString(),
            })),
          },
        },
      });
    } catch (error) {
      console.error(`Failed to migrate quiz set ${quizSet._id}:`, error);
    }
  }
}

async function migrateTagBatch(prisma: PrismaClient, batch: QuizTagDocument[]) {
  for (const tagEntry of batch) {
    try {
      for (const tag of tagEntry.tags) {
        await prisma.quizTag.create({
          data: {
            quizId: tagEntry.quizId,
            userId: tagEntry.userId,
            value: tag.value,
            type: tag.type,
            createdAt: new Date(tag.createdAt),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to migrate tag entry ${tagEntry._id}:`, error);
    }
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
