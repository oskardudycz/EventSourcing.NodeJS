import { contractSnapshotTests } from '../documentation/contractSnapshotTests';
import {
  shoppingCartBodyContracts,
  shoppingCartCheckedOutExternal,
  shoppingCartStoredContracts,
} from './shoppingCartContracts';

contractSnapshotTests({
  module: 'shoppingCarts',
  messages: [...shoppingCartStoredContracts, shoppingCartCheckedOutExternal],
  bodies: shoppingCartBodyContracts,
});
