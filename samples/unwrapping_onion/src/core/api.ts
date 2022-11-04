import express, { Application, Router } from 'express';
import http from 'http';

export const getApplication = (router: Router) => {
  const app: Application = express();

  app.set('etag', false);
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    })
  );
  app.use(router);

  return app;
};

export const startAPI = (router: Router, port = 5000) => {
  const app = getApplication(router);

  const server = http.createServer(app);

  server.listen(port);

  server.on('listening', () => {
    console.info('server up listening');
  });
};
