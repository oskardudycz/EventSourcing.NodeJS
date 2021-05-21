import express, { Application, Request, Response } from 'express';
import { cashierRouter } from './cashiers';

const app: Application = express();

app.use(cashierRouter);

export default app;
