import { startAPI } from '#core/api';
import { disconnectFromMongoDB, getMongoDB } from '#core/mongodb';
import initApp from './app';

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

process.once('SIGTERM', disconnectFromMongoDB);

(async () => {
  const mongo = await getMongoDB();
  const app = initApp(mongo);
  startAPI(app);
})().catch(console.error);
