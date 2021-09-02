import { Router } from 'express';
import { route as routePlaceAtWorkstation } from './placeAtWorkStation';

export const cashRegisterRouter = Router();
routePlaceAtWorkstation(cashRegisterRouter);
