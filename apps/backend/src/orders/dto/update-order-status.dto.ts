import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message:
      'status must be one of: CONFIRMED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED',
  })
  status!: OrderStatus;
}
