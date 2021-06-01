import { Router } from 'express';
import { route as routePlaceAtWorkstation } from './placeAtWorkStation';
import { route as routeStartingShift } from './startingShift';
import { route as routeRegisteringTransaction } from './registeringTransaction';
import { route as routeEndingShift } from './endingShift';

export const cashRegisterRouter = Router();
routePlaceAtWorkstation(cashRegisterRouter);
routeStartingShift(cashRegisterRouter);
routeRegisteringTransaction(cashRegisterRouter);
routeEndingShift(cashRegisterRouter);
