import type { DocumentsCollection } from '../../../tools';
import type { GroupCheckout } from './groupCheckout';
import type { GroupCheckoutToDoList } from './groupCheckoutToDoList';

export const ScheduledGroupCheckoutToDoList = (options: {
  groupCheckouts: DocumentsCollection<GroupCheckout>;
  groupCheckoutToDoList: GroupCheckoutToDoList;
}) => {
  const { groupCheckouts, groupCheckoutToDoList } = options;

  return {
    handleAll: () => {
      for (const groupCheckout of groupCheckouts.findAll())
        groupCheckoutToDoList.tryComplete(groupCheckout);
    },
  };
};

export type ScheduledGroupCheckoutToDoList = ReturnType<
  typeof ScheduledGroupCheckoutToDoList
>;
