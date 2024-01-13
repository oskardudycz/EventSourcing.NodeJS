import express, {
  Application,
  NextFunction,
  Router,
  Request,
  Response,
} from 'express';
import http from 'http';
import 'express-async-errors';
import { ProblemDocument } from 'http-problem-details';

export const getApplication = (router: Router) => {
  const app: Application = express();

  app.set('etag', false);
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    }),
  );

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
  const statusCode = 500;

  // here could come the special mapping

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
