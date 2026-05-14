import "dotenv/config";

export const config = {
  database: {
    url: process.env.DATABASE_URL || "postgres://localhost:5432/medwiki",
  },
  server: {
    host: process.env.SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "8889", 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
  },
  oss: {
    bucket: process.env.OSS_BUCKET || "",
    region: process.env.OSS_REGION || "oss-cn-beijing",
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "",
    endpoint: process.env.OSS_ENDPOINT || "https://oss-cn-beijing.aliyuncs.com",
  },
} as const;
