import {
  EmmettAttributes,
  EmmettMetrics,
  currentDefaultObservability,
} from '@event-driven-io/emmett';
import { messageContracts } from '../documentation/allContracts';
import { shoppingCartCommandTypes } from '../shoppingCarts/shoppingCart';

const commandHandlingCount = 'emmett.command.handling.count';

export const registerMetricSeriesAtZero = () => {
  const meter = currentDefaultObservability()?.meter;

  if (!meter) return;

  const eventAppendingCount = meter.counter(EmmettMetrics.event.appendingCount);
  const commandCount = meter.counter(commandHandlingCount);
  const commandTypes = [
    ...shoppingCartCommandTypes,
    ...messageContracts
      .filter(({ kind }) => kind === 'command')
      .map(({ type }) => type),
  ];

  for (const { type } of messageContracts.filter(
    ({ kind }) => kind === 'event',
  ))
    eventAppendingCount.add(0, { [EmmettAttributes.event.type]: type });

  for (const type of commandTypes)
    for (const status of ['success', 'failure'])
      commandCount.add(0, {
        [EmmettAttributes.command.type]: type,
        [EmmettAttributes.command.status]: status,
      });
};
