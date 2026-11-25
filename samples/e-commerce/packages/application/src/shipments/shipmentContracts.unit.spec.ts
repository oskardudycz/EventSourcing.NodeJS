import { contractSnapshotTests } from '../documentation/contractSnapshotTests';
import {
  shipmentRequestContracts,
  shipmentResponseContracts,
  shipmentStoredContracts,
} from './shipmentContracts';

contractSnapshotTests({
  module: 'shipments',
  messages: [
    ...shipmentStoredContracts,
    ...shipmentRequestContracts,
    ...shipmentResponseContracts,
  ],
  bodies: [],
});
