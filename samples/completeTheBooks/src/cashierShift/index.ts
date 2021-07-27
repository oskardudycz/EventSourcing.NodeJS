import { Router } from 'express';
import { route as routeStartingShift } from './openingShift';
import { route as routeRegisteringTransaction } from './registeringTransaction';
import { route as routeEndingShift } from './closingShift';

export const cashierShiftRouter = Router();
routeStartingShift(cashierShiftRouter);
routeRegisteringTransaction(cashierShiftRouter);
routeEndingShift(cashierShiftRouter);
