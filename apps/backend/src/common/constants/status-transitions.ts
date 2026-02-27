import { OrderStatus } from '@prisma/client';

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function getAllowedOrderStatusTransitions(
  currentStatus: OrderStatus,
): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[currentStatus];
}

export function isValidOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}
