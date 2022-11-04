import { getApplication } from '#core/api';
import registerHandlers from './application/shoppingCarts';
import controllers from './controllers';

registerHandlers();
const app = getApplication(...controllers);

export default app;
