import express, { Application, Request, Response } from 'express';
import { getGreeting } from './greetings/getGreeting';
import http from 'http';

const app: Application = express();
const server = http.createServer(app);

app.get('/', (req: Request, res: Response) => {
  res.json(getGreeting());
});

const PORT = 5000;

server.listen(PORT);

server.on('listening', () => {
  console.info('server up listening');
});
