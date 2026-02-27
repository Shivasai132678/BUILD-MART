import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+91\d{10}$/, {
    message: 'phone must match +91XXXXXXXXXX',
  })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'otp must be a 6-digit string',
  })
  otp!: string;
}
