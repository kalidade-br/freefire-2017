import type { IncomingMessage, ServerResponse } from 'node:http';
import { getServerlessApp } from '../server.ts';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getServerlessApp();
  app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1],
  );
}
