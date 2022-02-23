// const checkpointResult = await loadCheckpoint(subscriptionId);

// if (checkpointResult.isError) {
//   return checkpointResult;
// }

// const currentPosition = checkpointResult.value;

// const subscription = eventStore.subscribeToAll(
//   {
//     fromPosition: currentPosition || START,
//     filter: excludeSystemEvents(),
//     ...options,
//   },
//   readableOptions
// );

// subscription.on(
//   'data',
//   handleEvent<TError>(subscription, handlers, (position) =>
//     storeCheckpoint(subscriptionId, position)
//   )
// );
