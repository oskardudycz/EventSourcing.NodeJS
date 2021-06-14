import express, { Application } from 'express';
import { cashRegisterRouter } from './cashiers';
import { handleErrors } from './core/http/middlewares';

const app: Application = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cashRegisterRouter);

app.use(handleErrors);

export default app;
