import {
  EmmettAttributes,
  EmmettMetrics,
  currentDefaultObservability,
} from '@event-driven-io/emmett';
import { messageContracts } from '../documentation/allContracts';

const commandHandlingCount = 'emmett.command.handling.count';

export const registerMetricSeriesAtZero = () => {
  const meter = currentDefaultObservability()?.meter;

  if (!meter) return;

  const eventAppendingCount = meter.counter(EmmettMetrics.event.appendingCount);
  const commandCount = meter.counter(commandHandlingCount);

  for (const { type, kind } of messageContracts) {
    if (kind === 'event')
      eventAppendingCount.add(0, { [EmmettAttributes.event.type]: type });
    else
      for (const status of ['success', 'failure'])
        commandCount.add(0, {
          [EmmettAttributes.command.type]: type,
          [EmmettAttributes.command.status]: status,
        });
  }
};
