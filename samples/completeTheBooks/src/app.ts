import express, { Application } from 'express';
import { cashRegisterRouter } from './cashRegisters';
import { cashierShiftRouter } from './cashierShift';
import { handleErrors } from '#core/http/middlewares';

const app: Application = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cashRegisterRouter);
app.use(cashierShiftRouter);

app.use(handleErrors);

export default app;
