import app from './app';
import http from 'http';

const server = http.createServer(app);

const PORT = 5000;

server.listen(PORT);

server.on('listening', () => {
  console.info('server up listening');
});
