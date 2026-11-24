import {
  EmmettError,
  consumer,
  defaultProcessorPartition,
  defaultProcessorVersion,
  getCheckpoint,
  getProcessorInstanceId,
  getWorkflowId,
  noopScope,
  reactor,
  workflowProcessor,
  type AnyCommand,
  type AnyEvent,
  type AnyMessage,
  type Checkpointer,
  type EventStore,
  type InMemoryProcessor,
  type InMemoryProjectorOptions,
  type Message,
  type MessageConsumer,
  type MessageConsumerOptions,
  type MessageProcessingScope,
  type MessageProcessor,
  type MessageSource,
  type ProcessorCheckpoint,
  type ReactorOptions,
  type WorkflowProcessorContext,
  type WorkflowProcessorOptions,
} from '@event-driven-io/emmett';
import type { AnyBrokerMessage, BrokerMessageMetadata } from './brokerMessage';
import type { DeliveryLedger } from './deliveryLedger';

export type BrokerProcessor<MessageType extends Message = AnyMessage> =
  MessageProcessor<
    MessageType,
    BrokerMessageMetadata,
    WorkflowProcessorContext
  >;

export type BrokerReactorFactory<ConsumerMessageType extends AnyMessage> = <
  MessageType extends ConsumerMessageType = ConsumerMessageType,
>(
  options: ReactorOptions<
    MessageType,
    BrokerMessageMetadata,
    WorkflowProcessorContext
  >,
) => BrokerProcessor<MessageType>;

export type BrokerProjectorFactory<ConsumerMessageType extends AnyMessage> = <
  EventType extends ConsumerMessageType & AnyEvent = ConsumerMessageType &
    AnyEvent,
>(
  options: InMemoryProjectorOptions<EventType>,
) => InMemoryProcessor<EventType>;

export type BrokerWorkflowProcessorFactory<
  ConsumerMessageType extends AnyMessage,
> = <
  Input extends ConsumerMessageType & (AnyEvent | AnyCommand),
  State,
  Output extends ConsumerMessageType & (AnyEvent | AnyCommand),
  StoredMessage extends AnyEvent | AnyCommand = Output,
>(
  options: WorkflowProcessorOptions<
    Input,
    State,
    Output,
    BrokerMessageMetadata,
    WorkflowProcessorContext,
    StoredMessage
  >,
) => BrokerProcessor<Input>;

export type BrokerQueueConsumer<
  ConsumerMessageType extends AnyMessage = AnyBrokerMessage,
> = MessageConsumer<
  ConsumerMessageType,
  BrokerReactorFactory<ConsumerMessageType>,
  BrokerProjectorFactory<ConsumerMessageType>,
  BrokerWorkflowProcessorFactory<ConsumerMessageType>
>;

export type BrokerQueueConsumerOptions<
  ConsumerMessageType extends AnyMessage = AnyBrokerMessage,
> = MessageConsumerOptions<ConsumerMessageType> & {
  messageStore: EventStore;
};

const ledgerCheckpointer = <MessageType extends AnyMessage, Delivery>(
  ledger: DeliveryLedger<Delivery>,
  startsAtEnd: () => Promise<ProcessorCheckpoint | null>,
): Checkpointer<
  MessageType,
  BrokerMessageMetadata,
  WorkflowProcessorContext
> => ({
  read: async ({ processorId }) => {
    ledger.processorStarted(processorId, await startsAtEnd());
    return { lastCheckpoint: null };
  },
  store: async ({ processorId, message }) => {
    const newCheckpoint = getCheckpoint(message);
    await ledger.processed(processorId, newCheckpoint);
    return { success: true, newCheckpoint };
  },
});

const ownsCheckpoints = (
  processorId: string | undefined,
  checkpoints: unknown,
) => {
  if (checkpoints !== undefined)
    throw new EmmettError(
      `Processor ${processorId ?? ''} can't set its checkpoints: a broker queue commits or acknowledges a message only after every processor handled it, so it keeps the checkpoints itself`,
    );
};

export type BrokerSource = (
  canBeHandled: (type: string) => boolean,
) => MessageSource<AnyBrokerMessage, BrokerMessageMetadata>;

export const brokerQueueConsumer = <Delivery>({
  source,
  ledger,
  endCheckpoint,
  messageStore,
  ...options
}: BrokerQueueConsumerOptions & {
  source: BrokerSource;
  ledger: DeliveryLedger<Delivery>;
  endCheckpoint: () => Promise<ProcessorCheckpoint | null>;
}): BrokerQueueConsumer => {
  const processingScope: MessageProcessingScope<WorkflowProcessorContext> = (
    handler,
    partialContext,
  ) =>
    handler({
      ...partialContext,
      session: { ...partialContext.session, messageStore },
      observabilityScope: partialContext.observabilityScope ?? noopScope,
    });

  const startsAtEnd = (startFrom: unknown) => () =>
    startFrom === 'END' ? endCheckpoint() : Promise.resolve(null);

  const tracked = <Processor extends { id: string; isActive: boolean }>(
    processor: Processor,
  ): Processor => {
    ledger.track(processor.id, () => processor.isActive);
    return processor;
  };

  const reactorFactory: BrokerReactorFactory<AnyBrokerMessage> = (
    reactorOptions,
  ) => {
    ownsCheckpoints(reactorOptions.processorId, reactorOptions.checkpoints);

    return tracked(
      reactor({
        ...reactorOptions,
        processorInstanceId:
          reactorOptions.processorInstanceId ??
          getProcessorInstanceId(reactorOptions.processorId),
        version: reactorOptions.version ?? defaultProcessorVersion,
        partition: reactorOptions.partition ?? defaultProcessorPartition,
        processingScope,
        checkpoints: ledgerCheckpointer<AnyBrokerMessage, Delivery>(
          ledger,
          startsAtEnd(reactorOptions.startFrom),
        ),
      }),
    );
  };

  const workflowProcessorFactory: BrokerWorkflowProcessorFactory<
    AnyBrokerMessage
  > = (workflowOptions) => {
    ownsCheckpoints(workflowOptions.processorId, workflowOptions.checkpoints);

    return tracked(
      workflowProcessor({
        ...workflowOptions,
        processorId:
          workflowOptions.processorId ??
          getWorkflowId({ workflowName: workflowOptions.workflow.name }),
        processingScope,
        checkpoints: ledgerCheckpointer<AnyBrokerMessage, Delivery>(
          ledger,
          startsAtEnd(workflowOptions.startFrom),
        ),
      }),
    );
  };

  const projectorFactory: BrokerProjectorFactory<AnyBrokerMessage> = () => {
    throw new EmmettError(
      'A broker queue has no projectors: a projector would not hold back the commit or acknowledgement of a message it has not handled. Use a reactor.',
    );
  };

  const queueConsumer: BrokerQueueConsumer = consumer({
    ...options,
    source: source(
      (type) =>
        queueConsumer.processors.length === 0 ||
        queueConsumer.processors.some(
          (processor) =>
            processor.canHandle === undefined ||
            processor.canHandle.includes(type),
        ),
    ),
    reactorFactory,
    projectorFactory,
    workflowProcessorFactory,
    scope: (handler) => handler({}),
  });

  return queueConsumer;
};
