import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+91\d{10}$/, {
    message: 'phone must match +91XXXXXXXXXX',
  })
  phone!: string;
}
