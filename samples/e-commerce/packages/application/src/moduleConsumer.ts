import type {
  AnyCommand,
  AnyEvent,
  AnyRecordedMessageMetadata,
  MessageConsumer,
  ReactorOptions,
  WorkflowProcessorContext,
  WorkflowProcessorOptions,
} from '@event-driven-io/emmett';
import type { ApplicationMessage } from './application';

export type ModuleConsumer = Pick<
  MessageConsumer<ApplicationMessage>,
  'start' | 'close' | 'whenStarted' | 'whenCaughtUp'
> & {
  reactor<MessageType extends ApplicationMessage>(
    options: ReactorOptions<
      MessageType,
      AnyRecordedMessageMetadata,
      WorkflowProcessorContext
    >,
  ): unknown;
  workflowProcessor<
    Input extends ApplicationMessage & (AnyEvent | AnyCommand),
    State,
    Output extends ApplicationMessage & (AnyEvent | AnyCommand),
  >(
    options: WorkflowProcessorOptions<
      Input,
      State,
      Output,
      AnyRecordedMessageMetadata,
      WorkflowProcessorContext
    >,
  ): unknown;
};
