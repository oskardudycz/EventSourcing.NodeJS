// import { getEventStore } from '#core/eventStore';
// import { appendToStream } from '#core/eventStore/appending';
// import { failure, Result, success } from '#core/primitives';
// import { NO_STREAM } from '@eventstore/db-client';
// import {
//   getActiveCashierShiftStreamName,
//   SHIFT_ALREADY_INITIALIZED,
// } from '../cashierShift';
// import { handleSetActiveShift, InitializeActiveShift } from './handler';

// export async function setActiveShift(
//   command: InitializeActiveShift
// ): Promise<Result<true, SHIFT_ALREADY_INITIALIZED>> {
//   const eventStore = getEventStore();

//   const event = handleSetActiveShift(command);

//   if (event.isError) return event;

//   const result = await appendToStream(
//     eventStore,
//     getActiveCashierShiftStreamName(command.data.cashRegisterId),
//     [event.value],
//     { expectedRevision: NO_STREAM }
//   );

//   if (result.isError) return failure('SHIFT_ALREADY_STARTED');

//   return success(true);
// }
