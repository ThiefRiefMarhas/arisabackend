import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // CLI commands (db push, migrate) use direct connection (port 5432)
    // Runtime app uses pooler (port 6543) via PrismaService
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
