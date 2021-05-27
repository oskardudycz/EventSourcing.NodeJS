import express, { Application } from 'express';
import { cashRegisterRouter } from './cashiers';

const app: Application = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cashRegisterRouter);

export default app;
