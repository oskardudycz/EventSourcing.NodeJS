export type KafkaConnection = {
  bootstrapBrokers: string[];
  clientId?: string;
};

export const defaultKafkaClientId = 'e-commerce';
