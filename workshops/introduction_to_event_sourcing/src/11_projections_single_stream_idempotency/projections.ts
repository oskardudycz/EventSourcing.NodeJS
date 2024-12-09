import { EventHandler } from './tools/eventStore';
import { DocumentsCollection } from './tools/database';
import {
  ShoppingCartDetails,
  ShoppingCartEvent,
  ShoppingCartShortInfo,
  ShoppingCartStatus,
} from './projections.exercise.test';

export const getAndStore = <T>(
  collection: DocumentsCollection<T>,
  id: string,
  update: (document: T) => T,
) => {
  const document = collection.get(id) ?? ({} as T);

  collection.store(id, update(document));
};

export const ShoppingCartDetailsProjection = (
  collection: DocumentsCollection<ShoppingCartDetails>,
): EventHandler<ShoppingCartEvent> => {
  return ({ type, data: event }) => {
    switch (type) {
      case 'ShoppingCartOpened': {
        collection.store(event.shoppingCartId, {
          id: event.shoppingCartId,
          status: ShoppingCartStatus.Pending,
          clientId: event.clientId,
          productItems: [],
          openedAt: event.openedAt,
          totalAmount: 0,
          totalItemsCount: 0,
        });
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        getAndStore(collection, event.shoppingCartId, (document) => {
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

          document.totalAmount += productItem.quantity * productItem.unitPrice;
          document.totalItemsCount += productItem.quantity;

          return document;
        });
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        getAndStore(collection, event.shoppingCartId, (document) => {
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

          document.totalAmount -= productItem.quantity * productItem.unitPrice;
          document.totalItemsCount -= productItem.quantity;

          return document;
        });
        return;
      }
      case 'ShoppingCartConfirmed': {
        getAndStore(collection, event.shoppingCartId, (document) => {
          document.status = ShoppingCartStatus.Confirmed;
          document.confirmedAt = event.confirmedAt;

          return document;
        });
        return;
      }
      case 'ShoppingCartCanceled': {
        getAndStore(collection, event.shoppingCartId, (document) => {
          document.status = ShoppingCartStatus.Canceled;
          document.canceledAt = event.canceledAt;

          return document;
        });
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
  return ({ type, data: event }) => {
    switch (type) {
      case 'ShoppingCartOpened': {
        collection.store(event.shoppingCartId, {
          id: event.shoppingCartId,
          clientId: event.clientId,
          totalAmount: 0,
          totalItemsCount: 0,
        });
        return;
      }
      case 'ProductItemAddedToShoppingCart': {
        getAndStore(collection, event.shoppingCartId, (document) => {
          const { productItem } = event;

          document.totalAmount += productItem.quantity * productItem.unitPrice;
          document.totalItemsCount += productItem.quantity;

          return document;
        });
        return;
      }
      case 'ProductItemRemovedFromShoppingCart': {
        getAndStore(collection, event.shoppingCartId, (document) => {
          const { productItem } = event;

          document.totalAmount -= productItem.quantity * productItem.unitPrice;
          document.totalItemsCount -= productItem.quantity;

          return document;
        });
        return;
      }
      case 'ShoppingCartConfirmed': {
        collection.delete(event.shoppingCartId);
        return;
      }
      case 'ShoppingCartCanceled': {
        collection.delete(event.shoppingCartId);
        return;
      }
    }
  };
};
