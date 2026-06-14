import { PrismaClient } from "@prisma/client";

// A single shared Prisma client instance for the whole process
// (used by both the API server and the worker process).
export const prisma = new PrismaClient();
