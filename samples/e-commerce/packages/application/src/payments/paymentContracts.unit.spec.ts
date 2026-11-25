import { contractSnapshotTests } from '../documentation/contractSnapshotTests';
import {
  paymentRequestContracts,
  paymentResponseContracts,
  paymentStoredContracts,
} from './paymentContracts';

contractSnapshotTests({
  module: 'payments',
  messages: [
    ...paymentStoredContracts,
    ...paymentRequestContracts,
    ...paymentResponseContracts,
  ],
  bodies: [],
});
