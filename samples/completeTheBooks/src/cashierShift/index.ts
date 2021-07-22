import { Router } from 'express';
import { route as routeStartingShift } from './startingShift';
import { route as routeRegisteringTransaction } from './registeringTransaction';
import { route as routeEndingShift } from './endingShift';

export const cashierShiftRouter = Router();
routeStartingShift(cashierShiftRouter);
routeRegisteringTransaction(cashierShiftRouter);
routeEndingShift(cashierShiftRouter);
