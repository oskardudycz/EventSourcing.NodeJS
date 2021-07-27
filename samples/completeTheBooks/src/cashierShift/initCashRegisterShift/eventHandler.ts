// import { Result, success } from '#core/primitives';
// import { Event } from '#core/events';
// import {
//   getActiveCashierShiftStreamName,
//   SHIFT_ALREADY_INITIALIZED,
// } from '../cashierShift';
// import {
//   handleInitializeCashRegisterShift,
//   InitializeCashRegisterShift,
// } from './handler';
// import { isPlacedAtWorkStation } from '../../cashRegisters/placeAtWorkStation';
// import { updateCashierShift } from '../processCashierShift';

// export async function handleCashRegisterPlacedAtWorkStation(
//   event: Event
// ): Promise<Result<boolean, SHIFT_ALREADY_INITIALIZED>> {
//   if (!isPlacedAtWorkStation(event)) {
//     return success(false);
//   }

//   const cashRegisterId = event.data.cashRegisterId;

//   const command: InitializeCashRegisterShift = {
//     type: 'initialize-cash-register-shift',
//     data: {
//       cashRegisterId,
//     },
//   };

//   const streamName = getActiveCashierShiftStreamName(cashRegisterId);

//   const result = await updateCashierShift(
//     streamName,
//     command,
//     handleInitializeCashRegisterShift
//   );

//   if (result.isError) {
//     switch (result.error) {
//       case 'SHIFT_ALREADY_STARTED':
//       case 'FAILED_TO_APPEND_EVENT':
//         response.sendStatus(409);
//         return;
//       case 'STREAM_NOT_FOUND':
//         response.sendStatus(404);
//         return;
//       default:
//         response.sendStatus(500);
//         return;
//     }
//   }

//   return success(true);
// }
