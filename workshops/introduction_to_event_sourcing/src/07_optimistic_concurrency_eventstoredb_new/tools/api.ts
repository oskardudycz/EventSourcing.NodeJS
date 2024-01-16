import express, {
  Application,
  NextFunction,
  Request,
  Response,
  Router,
} from 'express';
import 'express-async-errors';
import http from 'http';
import { ProblemDocument } from 'http-problem-details';
import { EventStoreErrors } from './eventStore';

export const getApplication = (...apis: ((router: Router) => void)[]) => {
  const app: Application = express();

  const router = Router();

  app.set('etag', false);
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    }),
  );

  for (const api of apis) {
    api(router);
  }
  app.use(router);

  app.use(problemDetailsMiddleware);

  return app;
};

export const startAPI = (app: Application, port = 5000) => {
  const server = http.createServer(app);

  server.listen(port);

  server.on('listening', () => {
    console.info('server up listening');
  });
};

export const problemDetailsMiddleware = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;

  // here could come the special mapping
  if (error.message === EventStoreErrors.WrongExpectedRevision) {
    statusCode = 412;
  }

  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/problem+json');
  response.json(
    new ProblemDocument({
      detail: error.message,
      status: statusCode,
    }),
  );
};

export const sendCreated = (
  response: Response,
  createdId: string,
  urlPrefix?: string,
): void => {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`,
  );
  response.status(201).json({ id: createdId });
};
