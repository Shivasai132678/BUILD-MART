import { NotificationType, Prisma } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  metadata?: Prisma.InputJsonValue;
}
