import express, { Application, Router } from 'express';
import http from 'http';

export const startAPI = (router: Router) => {
  const app: Application = express();

  app.set('etag', false);
  app.use(express.json());
  app.use(
    express.urlencoded({
      extended: true,
    }),
  );
  app.use(router);

  const server = http.createServer(app);

  server.listen(5000);

  server.on('listening', () => {
    console.info('server up listening');
  });
};
