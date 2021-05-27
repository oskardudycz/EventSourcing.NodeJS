import { Router } from 'express';
import { route as routePlaceAtWorkstation } from './placeAtWorkStation';
import { route as routeStartingShift } from './startingShift';

export const cashRegisterRouter = Router();
routePlaceAtWorkstation(cashRegisterRouter);
routeStartingShift(cashRegisterRouter);
