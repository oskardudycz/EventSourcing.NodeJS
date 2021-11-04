import express, { Application } from 'express';
import { shoppingCartRouter } from './shoppingCarts';
import { handleErrors } from '#core/http/middlewares';

const app: Application = express();

app.set('etag', false);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(shoppingCartRouter);

app.use(handleErrors);

export default app;
