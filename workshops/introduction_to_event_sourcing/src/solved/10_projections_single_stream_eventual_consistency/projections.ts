import { EventHandler } from './tools/eventStore';
import { DocumentsCollection } from './tools/database';
import {
  ShoppingCartDetails,
  ShoppingCartEvent,
  ShoppingCartShortInfo,
  ShoppingCartStatus,
} from './projections.exercise.test';

export type VersionedDocument = {
  lastProcessedPosition: number;
};

export type RetryOptions = {
  maxRetries: number;
  delay: number;
};

const defaultRetryOptions: RetryOptions = {
  maxRetries: 5,
  delay: 10,
};

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export type RetryResult<T> =
  | { shouldRetry: true }
  | { shouldRetry: false; result: T };

export const retryAgain = <T>(): RetryResult<T> => {
  return { shouldRetry: true };
};
export const ok = <T>(result: T): RetryResult<T> => {
  return { shouldRetry: false, result };
};

export const retry = async <T>(
  handle: () => RetryResult<T>,
  { delay, maxRetries }: RetryOptions = defaultRetryOptions,
): Promise<T | undefined> => {
  let currentDelay = delay;
  let retryMade = 0;
  do {
    const handleResult = handle();

    if (!handleResult.shouldRetry) {
      return handleResult.result;
    }

    await sleep(currentDelay);
    retryMade++;
    currentDelay += delay;
  } while (retryMade < maxRetries);

  return undefined;
};

export const getWithRetries = async <T extends VersionedDocument>(
  collection: DocumentsCollection<T>,
  id: string,
  streamPosition: number,
) => {
  return retry((): RetryResult<{ isNewer: boolean; document: T }> => {
    const document = collection.get(id);

    if (document && document.lastProcessedPosition >= streamPosition) {
      return ok({ isNewer: true, document });
    }

    if (document && document.lastProcessedPosition == streamPosition - 1) {
      return ok({ isNewer: false, document });
    }

    return retryAgain();
  });
};

export const storeWithRetries = async <T extends VersionedDocument>(
  collection: DocumentsCollection<T>,
  id: string,
  document: T,
  streamPosition: number,
) => {
  return retry(() => {
    const updated = collection.store(id, document, {
      externalVersion: streamPosition,
    });

    return updated ? ok(true) : retryAgain();
  });
};

export const deleteWithRetries = async <T extends VersionedDocument>(
  collection: DocumentsCollection<T>,
  id: string,
) => {
  return retry(() => {
    const updated = collection.delete(id);

    return updated ? ok(true) : retryAgain();
  });
};

export const getAndStore = async <T extends VersionedDocument>(
  collection: DocumentsCollection<T>,
  id: string,
  streamPosition: number,
  update: (document: T) => T,
) => {
  const getResult = await getWithRetries(collection, id, streamPosition);

  if (getResult && getResult.isNewer) return;

  const document = getResult?.document ?? ({} as T);

  const updated = update(document);
  updated.lastProcessedPosition = streamPosition;

  const updateResult = await storeWithRetries(
    collection,
    id,
    updated,
    streamPosition,
  );

  if (!updateResult) throw new Error('Failed to update');
};

export const ShoppingCartDetailsProjection = (
  collection: DocumentsCollection<ShoppingCartDetails>,
): EventHandler<ShoppingCartEvent> => {
  return async ({ type, data: event, metadata: { streamPosition } }) => {
    switch (type) {
      case 'ShoppingCartOpened': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          () => {
            return {
              id: event.shoppingCartId,
              status: ShoppingCartStatus.Pending,
              clientId: event.clientId,
              productItems: [],
              openedAt: event.openedAt,
              totalAmount: 0,
              totalItemsCount: 0,
              lastProcessedPosition: streamPosition,
            };
          },
        );
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            const { productItem } = event;
            const existingProductItem = document.productItems.find(
              (p) =>
                p.productId === productItem.productId &&
                p.unitPrice === productItem.unitPrice,
            );

            if (existingProductItem == null) {
              document.productItems.push({ ...productItem });
            } else {
              document.productItems[
                document.productItems.indexOf(existingProductItem)
              ].quantity += productItem.quantity;
            }

            document.totalAmount +=
              productItem.quantity * productItem.unitPrice;
            document.totalItemsCount += productItem.quantity;

            return document;
          },
        );
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            const { productItem } = event;
            const existingProductItem = document.productItems.find(
              (p) =>
                p.productId === productItem.productId &&
                p.unitPrice === productItem.unitPrice,
            );

            if (existingProductItem == null) {
              // You may consider throwing exception here, depending on your strategy
              return document;
            }

            existingProductItem.quantity -= productItem.quantity;

            if (existingProductItem.quantity == 0) {
              document.productItems.splice(
                document.productItems.indexOf(existingProductItem),
                1,
              );
            }

            document.totalAmount -=
              productItem.quantity * productItem.unitPrice;
            document.totalItemsCount -= productItem.quantity;

            return document;
          },
        );
        return;
      }
      case 'ShoppingCartConfirmed': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            document.status = ShoppingCartStatus.Confirmed;
            document.confirmedAt = event.confirmedAt;

            return document;
          },
        );
        return;
      }
      case 'ShoppingCartCanceled': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            document.status = ShoppingCartStatus.Canceled;
            document.canceledAt = event.canceledAt;

            return document;
          },
        );
        return;
      }
      default: {
        return;
      }
    }
  };
};

export const ShoppingCartShortInfoProjection = (
  collection: DocumentsCollection<ShoppingCartShortInfo>,
): EventHandler<ShoppingCartEvent> => {
  return async ({ type, data: event, metadata: { streamPosition } }) => {
    switch (type) {
      case 'ShoppingCartOpened': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          () => {
            return {
              id: event.shoppingCartId,
              clientId: event.clientId,
              totalAmount: 0,
              totalItemsCount: 0,
              lastProcessedPosition: streamPosition,
            };
          },
        );
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            const { productItem } = event;

            document.totalAmount +=
              productItem.quantity * productItem.unitPrice;
            document.totalItemsCount += productItem.quantity;

            return document;
          },
        );
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        await getAndStore(
          collection,
          event.shoppingCartId,
          streamPosition,
          (document) => {
            const { productItem } = event;

            document.totalAmount -=
              productItem.quantity * productItem.unitPrice;
            document.totalItemsCount -= productItem.quantity;

            return document;
          },
        );
        return;
      }
      case 'ShoppingCartConfirmed': {
        await deleteWithRetries(collection, event.shoppingCartId);
        return;
      }
      case 'ShoppingCartCanceled': {
        await deleteWithRetries(collection, event.shoppingCartId);
        return;
      }
    }
  };
};
