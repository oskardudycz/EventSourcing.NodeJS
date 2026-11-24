import { soldOutDemoProduct } from './shop/demoProducts';
import { paymentWorkflowInbox } from './payments/paymentWorkflow';
import { sandboxPaymentGateway } from './payments/sandbox/sandboxPaymentGateway';
import { shipmentWorkflowInbox } from './shipments/shipmentWorkflow';
import { sandboxWarehouse } from './shipments/sandbox/sandboxWarehouse';
import type { ModuleStores } from './eventStore';

export const sandboxesOf = ({
  stores,
  now,
}: {
  stores: Pick<ModuleStores, 'payments' | 'shipments'>;
  now: () => Date;
}) => {
  const storeInPaymentInbox = paymentWorkflowInbox(now);
  const storeInShipmentInbox = shipmentWorkflowInbox(now);

  return {
    paymentGateway: sandboxPaymentGateway({
      now,
      deliver: (command) => storeInPaymentInbox(stores.payments.store, command),
    }),
    warehouse: sandboxWarehouse({
      now,
      outOfStock: [soldOutDemoProduct.id],
      deliver: (command) =>
        storeInShipmentInbox(stores.shipments.store, command),
    }),
  };
};

export type Sandboxes = ReturnType<typeof sandboxesOf>;
