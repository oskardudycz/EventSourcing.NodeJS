import { startAPI } from '#core/api';
import { disconnectFromMongoDB } from '#core/mongodb';
import app from './app';

//////////////////////////////////////////////////////////
/// API
//////////////////////////////////////////////////////////

process.once('SIGTERM', disconnectFromMongoDB);
startAPI(app, 5000);
