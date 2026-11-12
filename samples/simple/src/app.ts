import type { Application, Request, Response } from 'express';
import express from 'express';
import { getGreeting } from './greetings/getGreeting';

const app: Application = express();

app.get('/', (_req: Request, res: Response) => {
  res.json(getGreeting());
});

export default app;
